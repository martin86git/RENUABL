/**
 * Server only. Guided briefs: one row per private link staff text to a lead.
 * The answers save as the lead goes, so they can stop and come back.
 */
import { cleanBriefAnswers, type BriefAnswers } from "@/lib/domain/brief";
import { plainText } from "@/lib/domain/emails";
import { query, randomToken } from "./db";

export type BriefStatus = "sent" | "started" | "booked";

export interface BriefRow {
  key: string;
  first_name: string;
  mobile: string | null;
  email: string | null;
  created_by: string | null;
  answers: BriefAnswers;
  summary: BriefSummary | null;
  status: BriefStatus;
  call_label: string | null;
  created_at: string;
  updated_at: string;
  booked_at: string | null;
  /** YYYY-MM-DD in Melbourne time (listBriefs only). */
  updated_on?: string;
}

/** What the lead saw, in plain words (built in the browser, cleaned here): for the staff note and /admin. */
export interface BriefSummary {
  home?: string;
  usage?: string;
  system?: string;
  price?: string;
  rebates?: string;
  installDate?: string;
  billRead?: boolean;
}

const FIELDS = ["home", "usage", "system", "price", "rebates", "installDate"] as const;

export function cleanSummary(raw: unknown): BriefSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: BriefSummary = {};
  for (const f of FIELDS) {
    const v = plainText(r[f], 200);
    if (v) out[f] = v;
  }
  if (r.billRead === true) out.billRead = true;
  return Object.keys(out).length ? out : null;
}

export async function createBrief(o: { firstName: string; mobile: string | null; email: string | null; createdBy: string }) {
  const key = randomToken(20);
  await query(`insert into briefs (key, first_name, mobile, email, created_by) values ($1, $2, $3, $4, $5)`, [
    key,
    o.firstName,
    o.mobile,
    o.email,
    o.createdBy,
  ]);
  return key;
}

export async function getBrief(key: string): Promise<BriefRow | null> {
  const rows = await query<BriefRow>(`select * from briefs where key = $1`, [key]);
  return rows[0] ?? null;
}

export async function saveBriefProgress(key: string, answers: unknown, summary: unknown): Promise<boolean> {
  const rows = await query<{ key: string }>(
    `update briefs set answers = $2, summary = coalesce($3, summary), updated_at = now(),
       status = case when status = 'sent' then 'started' else status end
     where key = $1 returning key`,
    [key, JSON.stringify(cleanBriefAnswers(answers)), cleanSummary(summary) ? JSON.stringify(cleanSummary(summary)) : null],
  );
  return rows.length > 0;
}

export async function markBriefBooked(key: string, callLabel: string) {
  await query(`update briefs set status = 'booked', call_label = $2, booked_at = now(), updated_at = now() where key = $1`, [
    key,
    callLabel,
  ]);
}

export async function listBriefs(limit = 50): Promise<BriefRow[]> {
  return query<BriefRow>(
    `select *, to_char(updated_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD') as updated_on from briefs order by created_at desc limit $1`,
    [limit],
  );
}
