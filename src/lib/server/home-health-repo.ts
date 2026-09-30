/**
 * Server only. Home Health checks (answers and the plan, linked to an order
 * when there is one) and the healthy home quote requests staff follow up
 * before the install date. The allergies answer is stored only with consent.
 */
import type { HealthAnswers, HealthItemId, HealthPlan } from "@/lib/domain/home-health";
import { newId, query } from "./db";

export interface HealthRecord {
  id: string;
  job_reference: string | null;
  email: string | null;
  answers: HealthAnswers;
  plan: HealthPlan;
  created_at: string;
}

/** Saves a check. With an order it replaces that order's earlier check; a public check links to the customer's latest order by email. */
export async function saveHealthCheck(o: {
  reference: string | null;
  email: string | null;
  address: string | null;
  answers: HealthAnswers;
  plan: HealthPlan;
  sensitiveConsent: boolean;
}): Promise<{ id: string; reference: string | null }> {
  let reference = o.reference;
  if (!reference && o.email) {
    const rows = await query<{ reference: string }>(
      `select reference from jobs where customer_email = $1 and status <> 'cancelled' order by created_at desc limit 1`,
      [o.email.toLowerCase()],
    );
    reference = rows[0]?.reference ?? null;
  }
  const id = newId("hh");
  const rows = await query<{ id: string }>(
    `insert into home_health (id, job_reference, email, address, answers, plan, sensitive_consent)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (job_reference) do update set answers = excluded.answers, plan = excluded.plan,
       sensitive_consent = excluded.sensitive_consent, email = coalesce(excluded.email, home_health.email), updated_at = now()
     returning id`,
    [id, reference, o.email?.toLowerCase() ?? null, o.address, JSON.stringify(o.answers), JSON.stringify(o.plan), o.sensitiveConsent],
  );
  return { id: rows[0]?.id ?? id, reference };
}

export async function healthRecord(id: string): Promise<HealthRecord | null> {
  const rows = await query<HealthRecord>(`select id, job_reference, email, answers, plan, created_at from home_health where id = $1`, [id]);
  return rows[0] ?? null;
}

/** The customer's latest check (for My RENUABL). */
export async function latestHealthFor(email: string): Promise<HealthRecord | null> {
  const rows = await query<HealthRecord>(
    `select id, job_reference, email, answers, plan, created_at from home_health where email = $1 order by updated_at desc limit 1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

/** "Add to my plan — we'll quote it": one request per item per check. */
export async function addHealthQuote(record: HealthRecord, item: HealthItemId): Promise<boolean> {
  const rows = await query(
    `insert into health_quotes (id, job_reference, email, item) values ($1, $2, $3, $4)
     on conflict (job_reference, item) do nothing returning id`,
    [newId("hq"), record.job_reference ?? record.id, record.email, item],
  );
  return rows.length > 0;
}

export async function quotedItems(record: HealthRecord): Promise<string[]> {
  const rows = await query<{ item: string }>(`select item from health_quotes where job_reference = $1`, [
    record.job_reference ?? record.id,
  ]);
  return rows.map((r) => r.item);
}

export interface QuoteRow {
  id: string;
  item: string;
  status: string;
  email: string | null;
  job_reference: string | null;
  install_date: string | null;
  interest: boolean | null;
  name: string | null;
  created_at: string;
}

/** Staff list: orders that ticked "interested" first, then the soonest install date. */
export async function listHealthQuotes(): Promise<QuoteRow[]> {
  return query<QuoteRow>(
    `select q.id, q.item, q.status, q.email, j.reference as job_reference, to_char(j.install_date, 'YYYY-MM-DD') as install_date,
            j.healthy_home_interest as interest, j.customer->>'name' as name, q.created_at
     from health_quotes q left join jobs j on j.reference = q.job_reference
     order by coalesce(j.healthy_home_interest, false) desc, j.install_date asc nulls last, q.created_at asc`,
  );
}

export async function setQuoteStatus(id: string, status: "requested" | "contacted" | "quoted"): Promise<boolean> {
  return (await query(`update health_quotes set status = $2 where id = $1 returning id`, [id, status])).length > 0;
}

/** Orders reserved 2+ days ago without a check or a reminder yet. */
export async function dueHealthReminders(): Promise<{ reference: string; email: string; name: string | null }[]> {
  return query(
    `select j.reference, j.customer_email as email, j.customer->>'name' as name from jobs j
     where j.created_at < now() - interval '2 days' and j.health_reminded_at is null and j.status <> 'cancelled'
       and not exists (select 1 from home_health h where h.job_reference = j.reference)
     limit 50`,
  );
}

export async function markHealthReminded(reference: string) {
  await query(`update jobs set health_reminded_at = now() where reference = $1`, [reference]);
}
