/**
 * Server only. Entries put on the install calendar by hand (domain/design/calendar-entries.ts), under the designer's
 * tenant rule: the business id first, from the signed-in member only. A tentative install may name one of the
 * business's own deals; one that isn't the business's is kept without it.
 */
import { randomBytes } from "node:crypto";
import type { CalendarEntry, EntryInput } from "@/lib/domain/design/calendar-entries";
import { query } from "./db";

const SELECT = `select e.id, e.kind, to_char(e.day_from, 'YYYY-MM-DD') as "from", to_char(e.day_to, 'YYYY-MM-DD') as "to",
                       e.title, e.note, e.who, j.id as "jobId", c.name as customer, e.by_email as by
                  from design_calendar_entries e
                  left join design_jobs j on j.business_id = e.business_id and j.id = e.job_id
                  left join design_customers c on c.business_id = j.business_id and c.id = j.customer_id`;

/** The business's entries touching any of the days from `from` to `to`. */
export async function listEntries(businessId: string, from: string, to: string): Promise<CalendarEntry[]> {
  return query<CalendarEntry>(
    `${SELECT} where e.business_id = $1 and e.day_from <= $3 and e.day_to >= $2 order by e.day_from, e.at limit 500`,
    [businessId, from, to],
  );
}

/** A deal of this business's, or null. */
async function ownJob(businessId: string, jobId: string | null): Promise<string | null> {
  if (!jobId) return null;
  const rows = await query<{ id: string }>(`select id from design_jobs where business_id = $1 and id = $2`, [businessId, jobId]);
  return rows[0]?.id ?? null;
}

export async function addEntry(businessId: string, by: string, entry: EntryInput): Promise<CalendarEntry> {
  const id = `ce_${randomBytes(10).toString("hex")}`;
  await query(
    `insert into design_calendar_entries (id, business_id, kind, day_from, day_to, title, note, who, job_id, by_email)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      businessId,
      entry.kind,
      entry.from,
      entry.to,
      entry.title,
      entry.note,
      entry.who,
      await ownJob(businessId, entry.jobId),
      by.toLowerCase(),
    ],
  );
  return (await query<CalendarEntry>(`${SELECT} where e.business_id = $1 and e.id = $2`, [businessId, id]))[0];
}

/** Changes one of the business's entries; null when there's no such entry. */
export async function updateEntry(businessId: string, id: string, entry: EntryInput): Promise<CalendarEntry | null> {
  const rows = await query<{ id: string }>(
    `update design_calendar_entries set kind = $3, day_from = $4, day_to = $5, title = $6, note = $7, who = $8, job_id = $9
      where business_id = $1 and id = $2 returning id`,
    [businessId, id, entry.kind, entry.from, entry.to, entry.title, entry.note, entry.who, await ownJob(businessId, entry.jobId)],
  );
  if (!rows.length) return null;
  return (await query<CalendarEntry>(`${SELECT} where e.business_id = $1 and e.id = $2`, [businessId, id]))[0];
}

export async function removeEntry(businessId: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_calendar_entries where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return rows.length > 0;
}
