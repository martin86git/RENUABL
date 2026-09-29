/** Server only. Jobs (made from reservations) and their offers, in the database. */
import type { PlacedPanel } from "@/lib/domain/panel-plan";
import type { JobRequest, JobStatus, StoredJob } from "@/lib/domain/jobs";
import { newId, query, randomToken } from "./db";

interface JobRow {
  id: string;
  reference: string;
  record_key: string;
  customer: StoredJob["customer"];
  customer_email: string;
  address: StoredJob["address"];
  system: StoredJob["system"];
  site: StoredJob["site"];
  package_name: string;
  value: string;
  solar_victoria: boolean;
  install_date: string | null;
  status: JobStatus;
  partner_id: string | null;
  created_at: Date | string;
  layout: StoredJob["layout"];
}

const cols = (t = "jobs") =>
  `${t}.id, ${t}.reference, ${t}.record_key, ${t}.customer, ${t}.customer_email, ${t}.address, ${t}.system, ${t}.site, ${t}.package_name,
  ${t}.value, ${t}.solar_victoria, to_char(${t}.install_date, 'YYYY-MM-DD') as install_date, ${t}.status, ${t}.partner_id, ${t}.created_at, ${t}.layout`;
const COLUMNS = cols();

export interface JobWithPartner extends StoredJob {
  partnerId: string | null;
  customerEmail: string;
}

function toJob(r: JobRow): JobWithPartner {
  return {
    id: r.id,
    reference: r.reference,
    recordKey: r.record_key,
    customer: r.customer,
    customerEmail: r.customer_email,
    address: r.address,
    system: r.system,
    site: r.site,
    packageName: r.package_name,
    value: Number(r.value),
    solarVictoria: r.solar_victoria,
    installDate: r.install_date,
    status: r.status,
    partnerId: r.partner_id,
    createdAt: new Date(r.created_at).toISOString(),
    layout: r.layout ?? null,
  };
}

/** Saves a reserved job with its reservation reference, unassigned until it's offered. */
export async function createJob(
  reference: string,
  customer: { name: string; phone: string; email: string },
  req: JobRequest,
): Promise<JobWithPartner> {
  const rows = await query<JobRow>(
    `insert into jobs (id, reference, record_key, customer, customer_email, address, system, site, package_name, value, solar_victoria, install_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning ${COLUMNS}`,
    [
      newId("job"),
      reference,
      randomToken(20),
      JSON.stringify(customer),
      customer.email.toLowerCase(),
      JSON.stringify(req.address),
      JSON.stringify(req.system),
      JSON.stringify(req.site),
      req.packageName,
      req.value,
      req.solarVictoria,
      req.installDate,
    ],
  );
  return toJob(rows[0]);
}

export async function referenceTaken(reference: string) {
  return (await query(`select 1 from jobs where reference = $1`, [reference])).length > 0;
}

export async function getJobRow(id: string): Promise<JobWithPartner | null> {
  const r = (await query<JobRow>(`select ${COLUMNS} from jobs where id = $1`, [id]))[0];
  return r ? toJob(r) : null;
}

export async function listAllJobs(): Promise<(JobWithPartner & { offer: OfferRow | null })[]> {
  const rows = await query<JobRow & { offer: OfferRow | null }>(
    `select ${COLUMNS}, (select row_to_json(o) from offers o where o.job_id = jobs.id order by offered_at desc limit 1) as offer
     from jobs order by jobs.created_at desc limit 500`,
  );
  return rows.map((r) => ({ ...toJob(r), offer: r.offer }));
}

/** A partner's jobs: those assigned to them, plus any open offer to them. Nobody else's. */
export async function jobsForPartner(partnerId: string): Promise<{ job: JobWithPartner; offer: OfferRow | null }[]> {
  const rows = await query<JobRow & { offer_id: string | null; expires_at: Date | null }>(
    `select ${COLUMNS}, o.id as offer_id, o.expires_at
     from jobs
     left join offers o on o.job_id = jobs.id and o.partner_id = $1 and o.status = 'offered'
     where jobs.partner_id = $1 or (o.id is not null and jobs.status = 'offered')
     order by install_date nulls last, jobs.created_at`,
    [partnerId],
  );
  return rows.map((r) => ({
    job: toJob(r),
    offer: r.offer_id ? ({ id: r.offer_id, expires_at: r.expires_at, status: "offered" } as OfferRow) : null,
  }));
}

export async function jobsForCustomer(email: string): Promise<JobWithPartner[]> {
  const rows = await query<JobRow>(`select ${COLUMNS} from jobs where customer_email = $1 order by created_at desc`, [email.toLowerCase()]);
  return rows.map(toJob);
}

/** The customer moves their install day: only for their own reservation (reference and email must match). Returns whether it changed. */
export async function moveInstallDate(reference: string, email: string, date: string): Promise<boolean> {
  const rows = await query(`update jobs set install_date = $3 where reference = $1 and customer_email = $2 returning id`, [
    reference,
    email.toLowerCase(),
    date,
  ]);
  return rows.length > 0;
}

/** Whether this partner may write to the job record with this key (it's their job). */
export async function partnerOwnsRecord(partnerId: string, recordKey: string) {
  return (await query(`select 1 from jobs where record_key = $1 and partner_id = $2`, [recordKey, partnerId])).length > 0;
}

export async function setJobStatus(id: string, status: JobStatus, partnerId?: string | null) {
  await query(`update jobs set status = $2, partner_id = case when $4 then $3 else partner_id end where id = $1`, [
    id,
    status,
    partnerId ?? null,
    partnerId !== undefined,
  ]);
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export interface OfferRow {
  id: string;
  job_id?: string;
  partner_id?: string;
  status: "offered" | "accepted" | "declined" | "expired" | "withdrawn";
  offered_at?: string;
  expires_at: Date | string | null;
  decided_at?: string | null;
}

export async function createOffer(jobId: string, partnerId: string, expiresAt: Date): Promise<OfferRow> {
  const rows = await query<OfferRow>(
    `insert into offers (id, job_id, partner_id, expires_at) values ($1,$2,$3,$4) returning id, job_id, partner_id, status, offered_at, expires_at`,
    [newId("of"), jobId, partnerId, expiresAt.toISOString()],
  );
  await setJobStatus(jobId, "offered");
  return rows[0];
}

export async function partnersOffered(jobId: string): Promise<Set<string>> {
  const rows = await query<{ partner_id: string }>(`select partner_id from offers where job_id = $1`, [jobId]);
  return new Set(rows.map((r) => r.partner_id));
}

/**
 * The partner accepts their open offer, if it hasn't expired: the job becomes
 * theirs. Null when there's no such open offer (already answered, expired or not theirs).
 */
export async function acceptOffer(offerId: string, partnerId: string): Promise<string | null> {
  const rows = await query<{ job_id: string }>(
    `update offers set status = 'accepted', decided_at = now()
     where id = $1 and partner_id = $2 and status = 'offered' and expires_at > now() returning job_id`,
    [offerId, partnerId],
  );
  const jobId = rows[0]?.job_id;
  if (!jobId) return null;
  await setJobStatus(jobId, "accepted", partnerId);
  return jobId;
}

export async function declineOffer(offerId: string, partnerId: string): Promise<string | null> {
  const rows = await query<{ job_id: string }>(
    `update offers set status = 'declined', decided_at = now() where id = $1 and partner_id = $2 and status = 'offered' returning job_id`,
    [offerId, partnerId],
  );
  return rows[0]?.job_id ?? null;
}

/** Marks lapsed offers expired; returns their jobs (to offer to the next partner). */
export async function expireOffers(): Promise<string[]> {
  const rows = await query<{ job_id: string }>(
    `update offers set status = 'expired', decided_at = now() where status = 'offered' and expires_at <= now() returning job_id`,
  );
  return rows.map((r) => r.job_id);
}

/** Jobs waiting for a partner (none could take them when they came in). */
export async function unassignedJobIds(): Promise<string[]> {
  return (await query<{ id: string }>(`select id from jobs where status = 'unassigned'`)).map((r) => r.id);
}

const NEXT_STATUS: Partial<Record<JobStatus, JobStatus[]>> = {
  accepted: ["scheduled"],
  scheduled: ["in-progress", "completed"],
  "in-progress": ["completed"],
};

/** The partner moves their own job forward (confirm schedule, start, complete). False if not theirs or not allowed. */
export async function advancePartnerJob(partnerId: string, jobId: string, status: JobStatus): Promise<boolean> {
  const from = Object.entries(NEXT_STATUS)
    .filter(([, to]) => to?.includes(status))
    .map(([f]) => f);
  if (!from.length) return false;
  const rows = await query(`update jobs set status = $3 where id = $1 and partner_id = $2 and status = any($4) returning id`, [
    jobId,
    partnerId,
    status,
    from,
  ]);
  return rows.length > 0;
}

/** The home's address (with coordinates) for a job that's this partner's, or offered to them. */
export async function jobAddressForPartner(partnerId: string, jobId: string): Promise<StoredJob["address"] | null> {
  const rows = await query<{ address: StoredJob["address"] }>(
    `select j.address from jobs j
     where j.id = $1 and (j.partner_id = $2 or exists (select 1 from offers o where o.job_id = j.id and o.partner_id = $2 and o.status = 'offered'))`,
    [jobId, partnerId],
  );
  return rows[0]?.address ?? null;
}

/** Saves the partner's panel layout on their own job. False if it isn't theirs. */
export async function saveJobLayout(
  partnerId: string,
  recordKey: string,
  layout: { panels: PlacedPanel[]; arrays: number },
): Promise<boolean> {
  const rows = await query(`update jobs set layout = $3 where record_key = $1 and partner_id = $2 returning id`, [
    recordKey,
    partnerId,
    JSON.stringify({ ...layout, updatedAt: new Date().toISOString() }),
  ]);
  return rows.length > 0;
}

/** A job's saved layout and home, by its private record key (callers check who may see it). */
export async function jobLayoutByRecord(
  recordKey: string,
): Promise<{ layout: StoredJob["layout"]; address: StoredJob["address"]; panelCount: number } | null> {
  const rows = await query<{ layout: StoredJob["layout"]; address: StoredJob["address"]; system: StoredJob["system"] }>(
    `select layout, address, system from jobs where record_key = $1`,
    [recordKey],
  );
  const r = rows[0];
  return r ? { layout: r.layout ?? null, address: r.address, panelCount: r.system.panelCount } : null;
}

/** Saves the roof obstruction check on the partner's own job. */
export async function saveObstructions(partnerId: string, recordKey: string, check: unknown): Promise<boolean> {
  const rows = await query(`update jobs set obstructions = $3 where record_key = $1 and partner_id = $2 returning id`, [
    recordKey,
    partnerId,
    JSON.stringify(check),
  ]);
  return rows.length > 0;
}

export async function obstructionsFor(recordKey: string): Promise<unknown> {
  return (
    (await query<{ obstructions: unknown }>(`select obstructions from jobs where record_key = $1`, [recordKey]))[0]?.obstructions ?? null
  );
}
