/**
 * Server only. Bringing a business's deals across from HubSpot (domain/design/hubspot-import.ts has the rules). The
 * browser holds the business's private app token for the run and sends it with each call; nothing here keeps it, logs
 * it or sends it anywhere but api.hubapi.com. Each HubSpot deal brought in is noted in `design_imports` (business id
 * first, source `hubspot`) by HubSpot's id, so a deal never comes twice however often the import is run.
 */
import {
  CONTACT_PROPERTIES,
  DEAL_PROPERTIES,
  ENGAGEMENT_PROPERTIES,
  ENGAGEMENT_TYPES,
  HUBSPOT_API,
  HUBSPOT_BATCH,
  HUBSPOT_MAX_DEALS,
  HUBSPOT_WORDS,
  MAX_ENGAGEMENTS,
  dealFromHubSpot,
  engagementLine,
  fieldTargets,
  guessFields,
  guessStage,
  hubspotSaid,
  nextAfter,
  readAssociations,
  readOwners,
  readPipelines,
  readProperties,
  readRecords,
  type EngagementType,
  type FieldTarget,
  type HsLine,
  type HsListed,
  type HsOutcome,
  type HsOwner,
  type HsPipeline,
  type HsProperty,
  type HsRecord,
  type HubSpotMap,
} from "@/lib/domain/design/hubspot-import";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { newId, query, transaction } from "./db";
import { loadPrefs } from "./design-after-sale-repo";
import { createCustomer, createJob, record } from "./design-crm-repo";

/** Why HubSpot couldn't be read, in words for the business. */
export class HubSpotProblem extends Error {}

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= query(
    `create table if not exists design_imports (
       business_id text not null references businesses(id) on delete cascade,
       source text not null,
       ref text not null,
       job_id text,
       reference text,
       by_email text not null,
       at timestamptz not null default now(),
       primary key (business_id, source, ref)
     )`,
  ).then(
    () => undefined,
    (e) => {
      ready = null;
      throw e;
    },
  );
  return ready;
}

/** One call to HubSpot with the business's token. Waits once when HubSpot asks us to slow down. A 404 answers null. */
async function hs(path: string, token: string, body?: unknown, retried = false): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${HUBSPOT_API}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    console.error(`[hubspot-import] no answer from HubSpot for ${path.split("?")[0]}`);
    throw new HubSpotProblem("HubSpot couldn't be reached just now. Try again in a minute.");
  }
  if (res.status === 401) throw new HubSpotProblem(HUBSPOT_WORDS.refused);
  if (res.status === 429) {
    if (retried) throw new HubSpotProblem(HUBSPOT_WORDS.busy);
    const wait = Math.min(Number(res.headers.get("retry-after")) || 10, 15);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return hs(path, token, body, true);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const said = (await res.json().catch(() => null)) as { message?: unknown; category?: unknown } | null;
    const message = typeof said?.message === "string" ? said.message : "";
    console.error(
      `[hubspot-import] HubSpot answered ${res.status} for ${path.split("?")[0]}${message ? `: ${message.slice(0, 200)}` : ""}`,
    );
    if (res.status === 403)
      throw new HubSpotProblem(`${HUBSPOT_WORDS.noRead}${message ? ` (${message.slice(0, 160)})` : ""}`, { cause: 403 });
    throw new HubSpotProblem(hubspotSaid(res.status, message));
  }
  return res.json().catch(() => {
    throw new HubSpotProblem("HubSpot's answer couldn't be read.");
  });
}

const missingScope = (e: unknown) => e instanceof HubSpotProblem && e.cause === 403;

async function owners(token: string): Promise<HsOwner[]> {
  const out: HsOwner[] = [];
  let after: string | null = null;
  for (let page = 0; page < 10; page++) {
    const raw = await hs(`/crm/v3/owners?limit=500${after ? `&after=${after}` : ""}`, token).catch((e) => {
      // Without the owners scope the deals still come across, just without their owner.
      if (missingScope(e)) return null;
      throw e;
    });
    if (!raw) break;
    out.push(...readOwners(raw));
    after = nextAfter(raw);
    if (!after) break;
  }
  return out;
}

export interface HubSpotLook {
  pipelines: HsPipeline[];
  properties: HsProperty[];
  targets: FieldTarget[];
  /** Our guesses, for the business to check. */
  guess: HubSpotMap;
  deals: HsListed[];
  /** HubSpot ids already brought in to this business. */
  already: string[];
  /** Whether there were more deals than one import reads. */
  more: boolean;
  /** Engagement types the token can't read (a scope not ticked), found before anything is brought in. */
  unread: EngagementType[];
}

/** Checks the token and reads the pipelines, the deal properties and every deal's name and stage, with our guesses. */
export async function lookAtHubSpot(businessId: string, token: string): Promise<HubSpotLook> {
  await ensureTable();
  const pipelines = readPipelines(await hs("/crm/v3/pipelines/deals", token));
  const properties = readProperties(await hs("/crm/v3/properties/deals", token));
  const targets = fieldTargets((await loadPrefs(businessId)).dealFields);

  const deals: HsListed[] = [];
  let after: string | null = null;
  let more = false;
  for (let page = 0; ; page++) {
    if (deals.length >= HUBSPOT_MAX_DEALS) {
      more = true;
      break;
    }
    const raw = await hs(
      `/crm/v3/objects/deals?limit=100&archived=false&properties=dealname,pipeline,dealstage${after ? `&after=${after}` : ""}`,
      token,
    );
    for (const d of readRecords(raw))
      deals.push({
        id: d.id,
        name: d.properties.dealname ?? "",
        pipeline: d.properties.pipeline ?? "",
        stage: d.properties.dealstage ?? "",
      });
    after = nextAfter(raw);
    if (!after || page > 400) break;
  }

  const have = new Set(
    (await query<{ ref: string }>(`select ref from design_imports where business_id = $1 and source = 'hubspot'`, [businessId])).map(
      (r) => r.ref,
    ),
  );
  const unread: EngagementType[] = [];
  for (const type of ENGAGEMENT_TYPES)
    await hs(`/crm/v3/objects/${type}?limit=1`, token).catch((e) => {
      if (!missingScope(e)) throw e;
      unread.push(type);
    });
  const stages: HubSpotMap["stages"] = {};
  for (const p of pipelines) for (const s of p.stages) stages[s.id] = guessStage(s);
  return {
    pipelines,
    properties,
    targets,
    guess: { stages, fields: guessFields(targets, properties) },
    deals: deals.slice(0, HUBSPOT_MAX_DEALS),
    already: deals.filter((d) => have.has(d.id)).map((d) => d.id),
    more,
    unread,
  };
}

/** Reads records of one type by id, 100 at a time. */
async function batchRead(type: string, ids: readonly string[], properties: readonly string[], token: string): Promise<HsRecord[]> {
  const out: HsRecord[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const raw = await hs(`/crm/v3/objects/${type}/batch/read`, token, {
      inputs: ids.slice(i, i + 100).map((id) => ({ id })),
      properties,
    });
    out.push(...readRecords(raw));
  }
  return out;
}

async function associations(to: string, dealIds: readonly string[], token: string): Promise<Map<string, string[]>> {
  const raw = await hs(`/crm/v4/associations/deals/${to}/batch/read`, token, { inputs: dealIds.map((id) => ({ id })) });
  return readAssociations(raw);
}

/** Each deal's notes, emails, calls and meetings as record lines, newest first; a type the token can't read is passed over. */
async function engagementLines(dealIds: readonly string[], token: string, ownerList: readonly HsOwner[]) {
  const byDeal = new Map<string, HsLine[]>();
  const unread: EngagementType[] = [];
  for (const type of ENGAGEMENT_TYPES) {
    try {
      const joined = await associations(type, dealIds, token);
      const ids = [...new Set([...joined.values()].flat())].slice(0, MAX_ENGAGEMENTS * dealIds.length);
      if (!ids.length) continue;
      const records = new Map((await batchRead(type, ids, ENGAGEMENT_PROPERTIES[type], token)).map((r) => [r.id, r]));
      for (const [dealId, list] of joined) {
        const lines = list.flatMap((id) => {
          const r = records.get(id);
          const line = r ? engagementLine(type, r, ownerList) : null;
          return line ? [line] : [];
        });
        byDeal.set(dealId, [...(byDeal.get(dealId) ?? []), ...lines]);
      }
    } catch (e) {
      if (!missingScope(e)) throw e;
      unread.push(type);
    }
  }
  for (const [id, lines] of byDeal) byDeal.set(id, lines.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ENGAGEMENTS));
  return { byDeal, unread };
}

async function findCustomer(businessId: string, email: string, phone: string): Promise<string | null> {
  if (email) {
    const rows = await query<{ id: string }>(`select id from design_customers where business_id = $1 and lower(email) = $2 limit 1`, [
      businessId,
      email,
    ]);
    if (rows[0]) return rows[0].id;
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8) {
    const rows = await query<{ id: string }>(
      `select id from design_customers where business_id = $1 and regexp_replace(phone, '\\D', '', 'g') = $2 and ($3 = '' or coalesce(email, '') = '') limit 1`,
      [businessId, digits, email],
    );
    if (rows[0]) return rows[0].id;
  }
  return null;
}

export interface HubSpotRun {
  results: HsOutcome[];
  /** Engagement types the token couldn't read (a scope not ticked). */
  unread: EngagementType[];
}

/**
 * Brings a batch of HubSpot deals across as customers and deals with their record, by the business's match. A deal at
 * a stage left out is passed over (and not noted, so matching it later still brings it in).
 */
export async function bringInHubSpotDeals(
  businessId: string,
  token: string,
  ids: readonly string[],
  map: HubSpotMap,
  by: string,
): Promise<HubSpotRun> {
  await ensureTable();
  const batch = ids.slice(0, HUBSPOT_BATCH);
  const doneRows = await query<{ ref: string }>(
    `select ref from design_imports where business_id = $1 and source = 'hubspot' and ref = any($2::text[])`,
    [businessId, batch],
  );
  const done = new Set(doneRows.map((r) => r.ref));
  const todo = batch.filter((id) => !done.has(id));
  const results: HsOutcome[] = batch.filter((id) => done.has(id)).map((id) => ({ id, result: "already" as const }));
  if (!todo.length) return { results, unread: [] };

  const prefs = await loadPrefs(businessId);
  const targets = fieldTargets(prefs.dealFields);
  const typed = typedFields(prefs.dealFields);
  const [pipelines, properties, ownerList] = [
    readPipelines(await hs("/crm/v3/pipelines/deals", token)),
    readProperties(await hs("/crm/v3/properties/deals", token)),
    await owners(token),
  ];
  const wanted = [...new Set([...DEAL_PROPERTIES, ...properties.map((p) => p.name)])];
  const deals = await batchRead("deals", todo, wanted, token);
  const live = deals.filter((d) => {
    const s = map.stages[d.properties.dealstage ?? ""];
    return s && s !== "skip";
  });
  const contactsOf = live.length
    ? await associations(
        "contacts",
        live.map((d) => d.id),
        token,
      )
    : new Map<string, string[]>();
  const firstContacts = [...new Set(live.map((d) => contactsOf.get(d.id)?.[0]).filter(Boolean) as string[])];
  const contacts = new Map((await batchRead("contacts", firstContacts, CONTACT_PROPERTIES, token)).map((c) => [c.id, c]));
  const { byDeal, unread } = live.length
    ? await engagementLines(
        live.map((d) => d.id),
        token,
        ownerList,
      )
    : { byDeal: new Map(), unread: [] };

  const read = new Set(deals.map((d) => d.id));
  for (const id of todo) {
    if (!read.has(id)) results.push({ id, result: "failed", why: "HubSpot no longer has this deal." });
  }
  for (const d of deals) {
    try {
      const contactId = contactsOf.get(d.id)?.[0];
      const deal = dealFromHubSpot(d, contactId ? (contacts.get(contactId) ?? null) : null, {
        map,
        targets,
        props: properties,
        pipelines,
        owners: ownerList,
      });
      if (!deal) {
        results.push({ id: d.id, result: "skipped" });
        continue;
      }
      let customerIn = cleanCustomerInput({ ...deal.customer, lat: null, lng: null, notes: "" });
      if (!customerIn.ok) customerIn = cleanCustomerInput({ ...deal.customer, email: "", phone: "", lat: null, lng: null, notes: "" });
      if (!customerIn.ok) {
        results.push({ id: d.id, result: "failed", why: customerIn.message });
        continue;
      }
      let jobIn = cleanJobInput({ ...deal.job }, undefined, typed);
      if (!jobIn.ok) jobIn = cleanJobInput({ ...deal.job, installDate: null }, undefined, typed);
      if (!jobIn.ok) {
        results.push({ id: d.id, result: "failed", why: jobIn.message });
        continue;
      }

      const found = await findCustomer(businessId, customerIn.value.email ?? "", customerIn.value.phone ?? "");
      let customerId: string;
      let jobId: string;
      if (found) {
        const made = await createJob(businessId, found, jobIn.value, by);
        if (typeof made === "string") {
          results.push({
            id: d.id,
            result: "failed",
            why: made === "full" ? "That customer has too many jobs." : "The deal couldn't be made.",
          });
          continue;
        }
        customerId = found;
        jobId = made.id;
      } else {
        const made = await createCustomer(businessId, customerIn.value, jobIn.value, by);
        if (made === "full" || !made.job) {
          results.push({ id: d.id, result: "failed", why: "The CRM is full." });
          continue;
        }
        customerId = made.customer.id;
        jobId = made.job.id;
      }

      const lines: HsLine[] = byDeal.get(d.id) ?? [];
      await transaction(async (q) => {
        await q(
          `update design_jobs set
              won_at = case when $3::text is not null then ($3::date + time '12:00') at time zone 'Australia/Melbourne'
                            when stage = any($6::text[]) then coalesce(won_at, now()) else won_at end,
              installed_at = case when stage = any($7::text[]) then coalesce(installed_at, ($3::date + time '12:00') at time zone 'Australia/Melbourne', now()) else installed_at end,
              created_at = coalesce($4::timestamptz, created_at),
              owner_email = coalesce((select e from (select m.email as e from business_members m where m.business_id = $1 union all select o.email from design_owner_only o where o.business_id = $1) x where lower(e) = $5 limit 1), owner_email),
              updated_at = now()
            where business_id = $1 and id = $2`,
          [
            businessId,
            jobId,
            deal.wonOn,
            deal.createdAt,
            deal.owner,
            ["won", "ordered", "scheduled", "installed", "inspection", "coes", "grid", "claimed"],
            ["installed", "inspection", "coes", "grid", "claimed"],
          ],
        );
        // A customer made here is dated when their deal was made in HubSpot, so the import isn't a day of new leads.
        if (!found && deal.createdAt)
          await q(`update design_customers set created_at = least(created_at, $3::timestamptz) where business_id = $1 and id = $2`, [
            businessId,
            customerId,
            deal.createdAt,
          ]);
        for (const line of lines)
          await q(
            `insert into design_activity (id, business_id, customer_id, job_id, kind, text, by_email, at) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [newId("act"), businessId, customerId, jobId, line.kind, line.text, line.by.toLowerCase(), line.at],
          );
        await record(q, businessId, { customerId, jobId, kind: "note", text: deal.note, by: by.toLowerCase() });
        await q(
          `insert into design_imports (business_id, source, ref, job_id, by_email) values ($1, 'hubspot', $2, $3, $4) on conflict do nothing`,
          [businessId, deal.hubspotId, jobId, by.toLowerCase()],
        );
      });
      results.push({
        id: d.id,
        result: "in",
        customer: `${deal.customer.firstName} ${deal.customer.lastName}`.trim(),
        lines: lines.length,
      });
    } catch {
      console.error("[hubspot-import] a deal couldn't be brought in");
      results.push({ id: d.id, result: "failed", why: "Something went wrong bringing this one in." });
    }
  }
  return { results, unread };
}
