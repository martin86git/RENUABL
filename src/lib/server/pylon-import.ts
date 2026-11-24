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
  fillFromPylon,
  pylonSaid,
  isPylonPage,
  pdfName,
  projectUrl,
  readProjectPage,
  signedDesignId,
  soldProjectsUrl,
  type PylonCsvRow,
  type PylonDeal,
  type PylonFillOutcome,
  type PylonListed,
  type PylonOutcome,
  type PylonStage,
} from "@/lib/domain/design/pylon-import";
import { WON_STAGES, cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { batteryOf } from "@/lib/domain/design/deal-feed";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { query, transaction } from "./db";
import { loadPrefs } from "./design-after-sale-repo";
import { createCustomer, createJob, record, updateJob } from "./design-crm-repo";
import { addDealFiles } from "./design-pulse-repo";
import { safeFetch } from "./safe-fetch";

/** Why Pylon couldn't be read, in words for the business. */
export class PylonProblem extends Error {
  /** Pylon was slow, failing or gave an answer that couldn't be read: worth trying that one again later. */
  constructor(
    message: string,
    readonly passing = false,
  ) {
    super(message);
  }
}

/** Which of Pylon's addresses was asked, for a message: "a project", "a design". */
const askedFor = (url: string) => (new URL(url).pathname.includes("solar_designs") ? "a design" : "a project");

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
     );
     alter table design_imports add column if not exists equipment_at timestamptz;
     alter table design_imports add column if not exists pdf_at timestamptz;
     alter table design_imports add column if not exists fill_tries integer not null default 0`,
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
  } catch (e) {
    const slow = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(
      `[pylon-import] no answer from Pylon for ${new URL(url).pathname}: ${slow ? "timed out" : e instanceof Error ? e.message : "failed"}`,
    );
    throw new PylonProblem(`Pylon didn't answer for ${askedFor(url)}${slow ? " in time" : ""}.`, true);
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
  if (!res.ok) {
    // Pylon answers in RFC 7807 problem details: its own words say what it didn't like.
    const said = await res.json().catch(() => null);
    const title =
      said && typeof said === "object" && typeof (said as { title?: unknown }).title === "string" ? (said as { title: string }).title : "";
    console.error(`[pylon-import] Pylon answered ${res.status} for ${new URL(url).pathname}${title ? `: ${title}` : ""}`);
    if (res.status >= 500) throw new PylonProblem(`Pylon answered ${res.status} for ${askedFor(url)}${title ? `: ${title}` : ""}.`, true);
    throw new PylonProblem(pylonSaid(res.status, title));
  }
  return res.json().catch(() => {
    console.error(`[pylon-import] Pylon's answer for ${new URL(url).pathname} wasn't JSON`);
    throw new PylonProblem(`Pylon's answer for ${askedFor(url)} couldn't be read.`, true);
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
              owner_email = coalesce((select e from (select m.email as e from business_members m where m.business_id = $1 union all select o.email from design_owner_only o where o.business_id = $1) x where lower(e) = $6 limit 1), owner_email),
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

/** How many times a project Pylon chokes on is asked again before it is passed over. */
const FILL_TRIES = 3;

/** How many deals brought in from Pylon are still to be filled in (and, with `pdfs`, still to get their PDF). */
export async function fillLeft(businessId: string, pdfs: boolean): Promise<number> {
  await ensureTable();
  const rows = await query<{ n: string }>(
    `select count(*) as n from design_imports i
       join design_jobs j on j.business_id = i.business_id and j.id = i.job_id
      where i.business_id = $1 and i.source = 'pylon' and (i.equipment_at is null or ($2::boolean and i.pdf_at is null)) and i.fill_tries < ${FILL_TRIES}`,
    [businessId, pdfs],
  );
  return Number(rows[0]?.n ?? 0);
}

/** Marks one brought-in project as filled in (and its PDF looked for), so a run never asks Pylon for it again. */
const markDone = (businessId: string, ref: string, what: "filled" | "pdf" | "both") =>
  query(
    `update design_imports set
            equipment_at = case when $3 in ('filled', 'both') then coalesce(equipment_at, now()) else equipment_at end,
            pdf_at = case when $3 in ('pdf', 'both') then coalesce(pdf_at, now()) else pdf_at end
      where business_id = $1 and source = 'pylon' and ref = $2`,
    [businessId, ref, what],
  );

/** Whether a deal already has a proposal PDF from Pylon on it. */
async function hasPylonPdf(businessId: string, jobId: string): Promise<boolean> {
  const rows = await query(
    `select 1 from design_deal_files where business_id = $1 and job_id = $2 and type = 'application/pdf' and name like '%(Pylon%' limit 1`,
    [businessId, jobId],
  );
  return rows.length > 0;
}

/** One deal read again from Pylon and filled in (fillFromPylon: never over what a person typed). */
async function fillOne(
  businessId: string,
  key: string,
  t: { ref: string; jobId: string; needFill: boolean },
  wantPdf: boolean,
  by: string,
  fields: ReturnType<typeof typedFields>,
): Promise<PylonFillOutcome> {
  const project = await pylonGet(projectUrl(t.ref), key);
  if (!project) {
    await markDone(businessId, t.ref, "both");
    return { id: t.ref, result: "gone" };
  }
  const designId = signedDesignId(project);
  const design = designId ? await pylonGet(designUrl(designId), key) : null;
  const deal = dealFromPylon(project, design, "won");
  if (!deal) {
    await markDone(businessId, t.ref, "both");
    return { id: t.ref, result: "failed", why: "Pylon's answer for this project couldn't be read." };
  }

  let filled = 0;
  if (t.needFill) {
    const saved = await updateJob(
      businessId,
      t.jobId,
      (current) => {
        const fill = fillFromPylon(
          { title: current.title, details: current.details ?? {}, address: current.address, lat: current.lat },
          deal,
        );
        filled = fill.filled.length;
        return cleanJobInput(
          {
            title: fill.title,
            details: fill.details,
            ...(fill.place ? { address: fill.place.address, lat: fill.place.lat, lng: fill.place.lng } : {}),
            ...(current.kw == null && deal.job.kw !== null ? { kw: deal.job.kw } : {}),
          },
          current,
          fields,
        );
      },
      by,
    );
    if (!saved) {
      await markDone(businessId, t.ref, "both");
      return { id: t.ref, result: "gone" };
    }
    await markDone(businessId, t.ref, "filled");
    if ("refused" in saved) return { id: t.ref, result: "failed", why: saved.refused };
  }

  let pdf = false;
  if (wantPdf) {
    if (!(await hasPylonPdf(businessId, t.jobId))) {
      const signed = await fetchPdf(deal.signedPdf);
      const bytes = signed ?? (await fetchPdf(deal.proposalPdf));
      if (bytes) {
        const file = new File([new Uint8Array(bytes)], pdfName(deal, Boolean(signed)), { type: "application/pdf" });
        pdf = Boolean(await addDealFiles(businessId, t.jobId, [file], by).catch(() => null));
      }
    }
    await markDone(businessId, t.ref, "pdf");
  }
  const battery = Boolean(deal.job.details.battery || deal.job.details.batteryStorage);
  return { id: t.ref, result: "filled", filled, battery, pdf, design: Boolean(design) };
}

/**
 * The next few deals brought in from Pylon read again with the business's key and filled in: their equipment, site
 * details and place on the map, and with `pdfs` their signed PDF. Each is marked done, so a run can stop and carry on.
 */
export async function fillFromPylonRun(
  businessId: string,
  key: string,
  pdfs: boolean,
  by: string,
): Promise<{ results: PylonFillOutcome[]; left: number }> {
  await ensureTable();
  const fields = typedFields((await loadPrefs(businessId)).dealFields);
  const todo = await query<{ ref: string; job_id: string; need_fill: boolean }>(
    `select i.ref, i.job_id, i.equipment_at is null as need_fill from design_imports i
       join design_jobs j on j.business_id = i.business_id and j.id = i.job_id
      where i.business_id = $1 and i.source = 'pylon' and (i.equipment_at is null or ($2::boolean and i.pdf_at is null)) and i.fill_tries < ${FILL_TRIES}
      order by i.fill_tries, i.at, i.ref limit $3`,
    [businessId, pdfs, PYLON_BATCH],
  );
  const results: PylonFillOutcome[] = [];
  let passing: PylonProblem | null = null;
  for (const row of todo) {
    try {
      results.push(await fillOne(businessId, key, { ref: row.ref, jobId: row.job_id, needFill: row.need_fill }, pdfs, by, fields));
    } catch (e) {
      // One project Pylon chokes on is tried again later (up to FILL_TRIES) and the run goes on;
      // a refused key, or every project in the batch failing, stops it.
      if (e instanceof PylonProblem && e.passing) {
        passing = e;
        await query(`update design_imports set fill_tries = fill_tries + 1 where business_id = $1 and source = 'pylon' and ref = $2`, [
          businessId,
          row.ref,
        ]).catch(() => undefined);
        results.push({ id: row.ref, result: "failed", why: e.message });
        continue;
      }
      if (e instanceof PylonProblem) throw e;
      console.error("[pylon-import] a deal couldn't be filled in");
      // Marked done so one deal that always fails doesn't hold every run up.
      await markDone(businessId, row.ref, "both").catch(() => undefined);
      results.push({ id: row.ref, result: "failed", why: "Something went wrong filling this one in." });
    }
  }
  if (passing && todo.length && results.every((r) => r.result === "failed")) throw passing;
  return { results, left: await fillLeft(businessId, pdfs) };
}

/** A sold deal brought in from Pylon, for the Closed list beside the proposals signed here. */
export interface ImportedSale {
  jobId: string;
  customer: string;
  title: string;
  address: string;
  kw: number;
  batteryKwh: number;
  value: number;
  /** When it sold (the export's sold day), else when it came in. */
  soldAt: string;
  /** Pylon's own reference, when it had one. */
  reference: string;
  /** The signed proposal PDF kept on the deal, when one was brought in. */
  pdf: string | null;
}

/**
 * Every sold deal brought in from Pylon (23 Nov 2026, Martin: "there should be a list of all the sold proposals data I
 * brought in from pylon"), still at a sold stage, newest first. Read only; nothing before the table exists.
 */
export async function importedSales(businessId: string): Promise<ImportedSale[]> {
  const there = await query<{ t: string | null }>(`select to_regclass('design_imports') as t`, []);
  if (!there[0]?.t) return [];
  const rows = await query<{
    job_id: string;
    customer: string;
    title: string;
    address: string;
    kw: string | number | null;
    value: string | number | null;
    details: Record<string, string> | null;
    sold_at: Date | string;
    reference: string | null;
    file_id: string | null;
  }>(
    `select j.id as job_id, c.name as customer, j.title, j.address, j.kw, j.value, j.details,
            coalesce(j.won_at, i.at) as sold_at, i.reference,
            (select f.id from design_deal_files f
              where f.business_id = j.business_id and f.job_id = j.id and f.type = 'application/pdf' and f.name like '%(Pylon%'
              order by f.at desc limit 1) as file_id
       from design_imports i
       join design_jobs j on j.business_id = i.business_id and j.id = i.job_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where i.business_id = $1 and i.source = 'pylon' and j.stage = any($2::text[])
      order by coalesce(j.won_at, i.at) desc`,
    [businessId, [...WON_STAGES]],
  );
  return rows.map((r) => ({
    jobId: r.job_id,
    customer: r.customer,
    title: r.title,
    address: r.address,
    kw: Number(r.kw) || 0,
    batteryKwh: batteryOf(r.details ?? {}) ?? 0,
    value: Number(r.value) || 0,
    soldAt: new Date(r.sold_at).toISOString(),
    reference: r.reference ?? "",
    pdf: r.file_id ? `/api/design/jobs/${encodeURIComponent(r.job_id)}/files/${encodeURIComponent(r.file_id)}` : null,
  }));
}

/**
 * Gives deals already brought in to whoever sold them (24 Nov 2026, Martin: deals imported before their salesperson
 * was added, members or people kept to own deals without an invite). Each pair is a project's id in the import and its
 * seller's email, read from the export again. A deal changes hands only while it has no owner, or is still owned by
 * whoever brought it in (an import's deals default to them), and only to someone the business has: a member or one
 * kept to own deals. Written on each deal's record. Answers how many deals changed hands.
 */
export async function giveImportedDeals(
  businessId: string,
  source: "pylon" | "hubspot" | "sheet",
  pairs: readonly { ref: string; email: string }[],
  by: string,
): Promise<number> {
  await ensureTable();
  const wanted = pairs.filter((p) => p.ref && p.email).slice(0, 2_000);
  if (!wanted.length) return 0;
  return transaction(async (q) => {
    const changed = await q<{ id: string; customerId: string; owner: string }>(
      `with pairs as (select * from unnest($3::text[], $4::text[]) as p(ref, email)),
            people as (
              select lower(email) as email from business_members where business_id = $1
              union select email from design_owner_only where business_id = $1
            )
       update design_jobs j set owner_email = people.email, updated_at = now()
         from design_imports i
         join pairs on pairs.ref = i.ref
         join people on people.email = lower(pairs.email)
        where i.business_id = $1 and i.source = $2 and j.business_id = $1 and j.id = i.job_id
          and (j.owner_email is null or lower(j.owner_email) = lower(i.by_email))
          and lower(coalesce(j.owner_email, '')) <> people.email
       returning j.id, j.customer_id as "customerId", j.owner_email as owner`,
      [businessId, source, wanted.map((p) => p.ref), wanted.map((p) => p.email.toLowerCase())],
    );
    for (const c of changed)
      await record(q, businessId, {
        customerId: c.customerId,
        jobId: c.id,
        kind: "note",
        text: `Deal given to ${c.owner.split("@")[0]}, who sold it`,
        by: by.toLowerCase(),
      });
    return changed.length;
  });
}
