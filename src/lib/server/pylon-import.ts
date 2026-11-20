/**
 * Server only. Bringing a business's sold jobs across from Pylon (domain/design/pylon-import.ts has the rules). The
 * browser holds the business's Pylon key for the run and sends it with each call; nothing here keeps it, logs it or
 * sends it anywhere but api.getpylon.com. Each Pylon project brought in is noted in `design_imports` (business id
 * first) by Pylon's id, so a project is never brought in twice, however often the import is run.
 */
import {
  PYLON_BATCH,
  PYLON_CSV_BATCH,
  csvStage,
  dealFromCsv,
  PYLON_MAX_PROJECTS,
  PYLON_WORDS,
  dealFromPylon,
  designUrl,
  isPylonPage,
  pdfName,
  projectUrl,
  readProjectPage,
  signedDesignId,
  soldProjectsUrl,
  type PylonCsvRow,
  type PylonDeal,
  type PylonListed,
  type PylonOutcome,
  type PylonStage,
} from "@/lib/domain/design/pylon-import";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { query, transaction } from "./db";
import { loadPrefs } from "./design-after-sale-repo";
import { createCustomer, createJob, record } from "./design-crm-repo";
import { addDealFiles } from "./design-pulse-repo";
import { safeFetch } from "./safe-fetch";

/** Why Pylon couldn't be read, in words for the business. */
export class PylonProblem extends Error {}

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

/** One read from Pylon's API with the business's key. Waits once when Pylon asks us to slow down. */
async function pylonGet(url: string, key: string, retried = false): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PylonProblem(PYLON_WORDS.down);
  }
  if (res.status === 401) throw new PylonProblem(PYLON_WORDS.refused);
  if (res.status === 403) throw new PylonProblem(PYLON_WORDS.noRead);
  if (res.status === 429) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 5, 15);
    if (retried) throw new PylonProblem(PYLON_WORDS.busy);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return pylonGet(url, key, true);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new PylonProblem(PYLON_WORDS.down);
  return res.json().catch(() => {
    throw new PylonProblem(PYLON_WORDS.down);
  });
}

export interface PylonCheck {
  projects: PylonListed[];
  /** Pylon ids already brought in to this business. */
  already: string[];
  /** Whether there were more sold jobs than one import reads. */
  more: boolean;
}

/** Checks the key and lists every sold project (following Pylon's pages), with those already brought in. */
export async function listSoldProjects(businessId: string, key: string): Promise<PylonCheck> {
  await ensureTable();
  const projects: PylonListed[] = [];
  let next: string | null = soldProjectsUrl();
  let more = false;
  for (let page = 0; next; page++) {
    if (projects.length >= PYLON_MAX_PROJECTS || page > 400) {
      more = true;
      break;
    }
    if (!isPylonPage(next)) break;
    const read = readProjectPage(await pylonGet(next, key));
    projects.push(...read.projects);
    next = read.next;
  }
  const seen = new Set<string>();
  const unique = projects.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, PYLON_MAX_PROJECTS);
  const already = await query<{ ref: string }>(`select ref from design_imports where business_id = $1 and source = 'pylon'`, [businessId]);
  const have = new Set(already.map((r) => r.ref));
  return { projects: unique, already: unique.filter((p) => have.has(p.id)).map((p) => p.id), more };
}

/** A PDF from a link Pylon gave us (public https only, checked by its own bytes), or null. */
async function fetchPdf(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  const got = await safeFetch(url, 10 * 1024 * 1024, "picture").catch(() => null);
  if (!got || got.bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  return got.bytes;
}

/** How a kept deal is dated, and who looks after it. */
interface KeepAs {
  /** The day it was sold (YYYY-MM-DD, Melbourne), when the source says; else today. */
  wonOn?: string;
  /** Installed is dated today (the key import, which knows no dates); the export leaves it undated. */
  installedNow?: boolean;
  /** Its owner, when that email is in the business. */
  owner?: string;
}

/**
 * Keeps one Pylon project as a customer and a deal with its note, and notes it as brought in, so it never comes twice.
 * The same person already in the CRM (by email, else phone) gets the job; nobody is made twice or overwritten.
 */
async function keepDeal(
  businessId: string,
  deal: PylonDeal,
  by: string,
  as: KeepAs,
  fields?: ReturnType<typeof typedFields>,
): Promise<{ ok: true; jobId: string; customerId: string } | { ok: false; why: string }> {
  const typed = fields ?? typedFields((await loadPrefs(businessId)).dealFields);
  let customerIn = cleanCustomerInput({ ...deal.customer, lat: null, lng: null, notes: "" });
  // An email or phone the CRM won't take doesn't stop the job: the person comes without it.
  if (!customerIn.ok) customerIn = cleanCustomerInput({ ...deal.customer, email: "", phone: "", lat: null, lng: null, notes: "" });
  if (!customerIn.ok) return { ok: false, why: customerIn.message };
  let jobIn = cleanJobInput({ ...deal.job }, undefined, typed);
  // A place Pylon has that the CRM won't take doesn't stop the job: it comes without the map.
  if (!jobIn.ok) jobIn = cleanJobInput({ ...deal.job, lat: null, lng: null }, undefined, typed);
  if (!jobIn.ok) return { ok: false, why: jobIn.message };

  const email = customerIn.value.email ?? "";
  const phoneDigits = (customerIn.value.phone ?? "").replace(/\D/g, "");
  const found = email
    ? await query<{ id: string }>(`select id from design_customers where business_id = $1 and lower(email) = $2 limit 1`, [
        businessId,
        email.toLowerCase(),
      ])
    : phoneDigits.length >= 8
      ? await query<{ id: string }>(
          `select id from design_customers where business_id = $1 and regexp_replace(phone, '\\D', '', 'g') = $2 limit 1`,
          [businessId, phoneDigits],
        )
      : [];

  let customerId: string;
  let jobId: string;
  if (found[0]) {
    const made = await createJob(businessId, found[0].id, jobIn.value, by);
    if (typeof made === "string")
      return { ok: false, why: made === "full" ? "That customer has too many jobs." : "The deal couldn't be made." };
    customerId = found[0].id;
    jobId = made.id;
  } else {
    const made = await createCustomer(businessId, customerIn.value, jobIn.value, by);
    if (made === "full" || !made.job) return { ok: false, why: "The CRM is full." };
    customerId = made.customer.id;
    jobId = made.job.id;
  }

  await transaction(async (q) => {
    await q(
      `update design_jobs set kw = $3,
              won_at = case when $4::text is not null then ($4::date + time '12:00') at time zone 'Australia/Melbourne' else coalesce(won_at, now()) end,
              installed_at = coalesce(installed_at, case when $5::boolean then now() end),
              owner_email = coalesce((select m.email from business_members m where m.business_id = $1 and lower(m.email) = $6 limit 1), owner_email),
              updated_at = now()
        where business_id = $1 and id = $2`,
      [businessId, jobId, deal.job.kw, as.wonOn || null, Boolean(as.installedNow), (as.owner ?? "").toLowerCase()],
    );
    await record(q, businessId, { customerId, jobId, kind: "note", text: deal.note, by: by.toLowerCase() });
    await q(
      `insert into design_imports (business_id, source, ref, job_id, reference, by_email) values ($1, 'pylon', $2, $3, $4, $5)
       on conflict do nothing`,
      [businessId, deal.pylonId, jobId, deal.reference || null, by.toLowerCase()],
    );
  });
  return { ok: true, jobId, customerId };
}

/** Brings one Pylon project across as a customer and a deal, with its signed PDF on the deal. */
async function bringIn(businessId: string, key: string, id: string, stage: PylonStage, by: string): Promise<PylonOutcome> {
  const done = await query(`select 1 from design_imports where business_id = $1 and source = 'pylon' and ref = $2`, [businessId, id]);
  if (done.length) return { id, result: "already" };

  const project = await pylonGet(projectUrl(id), key);
  if (!project) return { id, result: "failed", why: "Pylon no longer has this project." };
  const designId = signedDesignId(project);
  const design = designId ? await pylonGet(designUrl(designId), key) : null;
  const deal = dealFromPylon(project, design, stage);
  if (!deal) return { id, result: "failed", why: "Pylon's answer for this project couldn't be read." };

  const kept = await keepDeal(businessId, deal, by, { installedNow: stage === "installed" });
  if (!kept.ok) return { id, result: "failed", why: kept.why };
  const { jobId } = kept;

  // The signed PDF (its link lasts an hour, so it is fetched now), else the proposal PDF. A PDF that can't be had
  // doesn't undo the deal: the note says where it came from.
  let pdf = false;
  const signed = await fetchPdf(deal.signedPdf);
  const bytes = signed ?? (await fetchPdf(deal.proposalPdf));
  if (bytes) {
    const file = new File([new Uint8Array(bytes)], pdfName(deal, Boolean(signed)), { type: "application/pdf" });
    pdf = Boolean(await addDealFiles(businessId, jobId, [file], by).catch(() => null));
  }
  return { id, result: "in", jobId, customer: `${deal.customer.firstName} ${deal.customer.lastName}`.trim(), pdf };
}

/** Brings a few of the projects listed across, one after another (Pylon's limits are the team's, so not at once). */
export async function bringInProjects(
  businessId: string,
  key: string,
  ids: readonly string[],
  stage: PylonStage,
  by: string,
): Promise<PylonOutcome[]> {
  await ensureTable();
  const out: PylonOutcome[] = [];
  for (const id of ids.slice(0, PYLON_BATCH)) {
    try {
      out.push(await bringIn(businessId, key, id, stage, by));
    } catch (e) {
      // A key refused or Pylon out of reach stops the run; anything else is this project's own trouble.
      if (e instanceof PylonProblem) throw e;
      console.error("[pylon-import] a project couldn't be brought in");
      out.push({ id, result: "failed", why: "Something went wrong bringing this one in." });
    }
  }
  return out;
}

/** Which of these Pylon ids this business has already brought in (by either import). */
export async function alreadyBroughtIn(businessId: string, ids: readonly string[]): Promise<string[]> {
  await ensureTable();
  if (!ids.length) return [];
  const rows = await query<{ ref: string }>(
    `select ref from design_imports where business_id = $1 and source = 'pylon' and ref = any($2::text[])`,
    [businessId, ids.slice(0, 5000)],
  );
  return rows.map((r) => r.ref);
}

/**
 * A batch of sold rows from Pylon's export (already read again by `cleanCsvRow`) kept as customers and deals, each dated
 * the day it was sold and owned by whoever sold it when they are in the business; Won or Installed by `csvStage`.
 */
export async function bringInCsvRows(
  businessId: string,
  rows: readonly PylonCsvRow[],
  today: string,
  wonWeeks: number,
  by: string,
): Promise<PylonOutcome[]> {
  await ensureTable();
  const fields = typedFields((await loadPrefs(businessId)).dealFields);
  const out: PylonOutcome[] = [];
  for (const row of rows.slice(0, PYLON_CSV_BATCH)) {
    try {
      const done = await query(`select 1 from design_imports where business_id = $1 and source = 'pylon' and ref = $2`, [
        businessId,
        row.id,
      ]);
      if (done.length) {
        out.push({ id: row.id, result: "already" });
        continue;
      }
      const deal = dealFromCsv(row, csvStage(row.soldOn, today, wonWeeks));
      const kept = await keepDeal(businessId, deal, by, { wonOn: row.soldOn || undefined, owner: row.ownerEmail }, fields);
      out.push(
        kept.ok
          ? {
              id: row.id,
              result: "in",
              jobId: kept.jobId,
              customer: `${deal.customer.firstName} ${deal.customer.lastName}`.trim(),
              pdf: false,
            }
          : { id: row.id, result: "failed", why: kept.why },
      );
    } catch {
      console.error("[pylon-import] an export row couldn't be brought in");
      out.push({ id: row.id, result: "failed", why: "Something went wrong bringing this one in." });
    }
  }
  return out;
}
