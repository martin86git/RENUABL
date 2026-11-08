/**
 * Server only. Wave 5 of the copy from Primero: each deal's clock and temperature (domain/design/deal-heat.ts), the
 * emails sent from a deal and when they were opened (domain/design/email-opens.ts), and the files kept on a deal (its
 * Attachments tab). Under the designer's tenant rule (business id first, from the signed-in member only), and only for
 * deals the member may see; the one exception is a pixel's open, which carries only its own token.
 */
import { OPEN_STAGES } from "@/lib/domain/design/crm";
import type { DealViewer } from "@/lib/domain/design/account";
import { boardPriority, dealClock, dealHeat, rankPulses, type DealPulse } from "@/lib/domain/design/deal-heat";
import { cleanOpens, mailMark, withOpen, type MailMark } from "@/lib/domain/design/email-opens";
import { TEAM_FILE_TYPES, teamFileName } from "@/lib/domain/design/team-chat";
import { query, randomToken } from "./db";
import { jobById, listJobs } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// ── Email opens ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A new pixel token for an email about to go from a deal. */
export const newOpenToken = () => randomToken(16);

/** An email sent from a deal, remembered so its opens can be put against it (and the record line it was written as). */
export async function recordSent(businessId: string, token: string, jobId: string, activityId: string | null): Promise<void> {
  await query(`insert into design_email_opens (token, business_id, job_id, activity_id) values ($1,$2,$3,$4) on conflict do nothing`, [
    token,
    businessId,
    jobId,
    activityId,
  ]);
}

/**
 * A pixel loaded: the email it belongs to gets the time (two within a minute are one) and one more on its count, which
 * goes on past the times kept (`OPENS_EACH`). An email sent before the count was kept starts from the times it has.
 * Unknown tokens change nothing.
 */
export async function recordOpen(token: string, now = new Date(), notBusiness?: string): Promise<void> {
  // Loaded by someone signed in to the business that sent it: one of its own people, never the customer (8 Nov 2026).
  const rows = await query<{ opens: unknown }>(
    `select opens from design_email_opens where token = $1 and ($2::text is null or business_id <> $2)`,
    [token, notBusiness ?? null],
  );
  if (!rows[0]) return;
  const next = withOpen(cleanOpens(rows[0].opens), now);
  if (next)
    await query(
      `update design_email_opens set opens = $2::jsonb, open_count = coalesce(open_count, jsonb_array_length(opens)) + 1 where token = $1`,
      [token, JSON.stringify(next)],
    );
}

/** A deal's tracked emails by the record line they were written as: when each went and when it was opened. */
export async function opensForJob(businessId: string, jobId: string, viewer?: DealViewer): Promise<Record<string, string[]> | null> {
  if (!(await jobById(businessId, jobId, viewer))) return null;
  const rows = await query<{ activity: string | null; opens: unknown }>(
    `select activity_id as activity, opens from design_email_opens where business_id = $1 and job_id = $2`,
    [businessId, jobId],
  );
  return Object.fromEntries(rows.filter((r) => r.activity).map((r) => [r.activity as string, cleanOpens(r.opens)]));
}

/** How many times each of a deal's tracked emails was opened, by its record line (the caller has checked the deal). */
export async function openCountsForJob(businessId: string, jobId: string): Promise<Record<string, number>> {
  const rows = await query<{ activity: string | null; n: number }>(
    `select activity_id as activity, coalesce(open_count, jsonb_array_length(opens))::int as n from design_email_opens
      where business_id = $1 and job_id = $2 and activity_id is not null`,
    [businessId, jobId],
  );
  return Object.fromEntries(rows.map((r) => [r.activity as string, Number(r.n)]));
}

/** Every deal this member may see that an email has gone from, with the mark for its pipeline card (`mailMark`). */
export async function mailMarks(businessId: string, viewer?: DealViewer): Promise<Record<string, MailMark>> {
  const ids = (await listJobs(businessId, viewer)).map((j) => j.id);
  if (!ids.length) return {};
  const rows = await query<{ job: string; sent: string; opens: unknown }>(
    `select job_id as job, ${moment("sent_at")} as sent, opens from design_email_opens where business_id = $1 and job_id = any($2)`,
    [businessId, ids],
  );
  const byJob = new Map<string, { sentAt: string; opens: string[] }[]>();
  for (const r of rows) byJob.set(r.job, [...(byJob.get(r.job) ?? []), { sentAt: r.sent, opens: cleanOpens(r.opens) }]);
  const out: Record<string, MailMark> = {};
  for (const [job, emails] of byJob) {
    const mark = mailMark(emails);
    if (mark) out[job] = mark;
  }
  return out;
}

// ── Pulses ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The clock and temperature of every deal this member may see that is still being sold, ranked for the board. */
export async function dealPulses(businessId: string, viewer?: DealViewer, now = new Date()): Promise<Record<string, DealPulse>> {
  const jobs = (await listJobs(businessId, viewer)).filter((j) => OPEN_STAGES.includes(j.stage));
  if (!jobs.length) return {};
  const ids = jobs.map((j) => j.id);
  const [activity, messages, proposals, opens] = await Promise.all([
    query<{ job: string; kind: string; at: string }>(
      `select job_id as job, kind, ${moment("at")} as at from design_activity where business_id = $1 and job_id = any($2) and kind in ('email','call')`,
      [businessId, ids],
    ),
    query<{ job: string; theirs: boolean; text: string; at: string }>(
      `select job_id as job, from_customer as theirs, text, ${moment("at")} as at from design_messages where business_id = $1 and job_id = any($2)`,
      [businessId, ids],
    ),
    query<{ job: string; opened: boolean }>(
      `select p.job_id as job, bool_or(v.opened_at is not null) as opened
         from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
        where p.business_id = $1 and p.job_id = any($2) and p.withdrawn_at is null group by p.job_id`,
      [businessId, ids],
    ),
    query<{ job: string }>(
      `select distinct job_id as job from design_email_opens where business_id = $1 and job_id = any($2) and jsonb_array_length(opens) > 0`,
      [businessId, ids],
    ),
  ]);
  const opened = new Set(opens.map((o) => o.job));
  const out: Record<string, DealPulse> = {};
  for (const j of jobs) {
    const clock = dealClock(j.createdAt, now);
    if (!clock) continue;
    const proposal = proposals.find((p) => p.job === j.id);
    const heat = dealHeat({
      now,
      clock,
      theirs: messages.filter((m) => m.job === j.id && m.theirs).map((m) => ({ at: m.at, text: m.text })),
      ours: [
        ...messages.filter((m) => m.job === j.id && !m.theirs).map((m) => ({ at: m.at })),
        ...activity.filter((a) => a.job === j.id && a.kind === "email").map((a) => ({ at: a.at })),
      ],
      calls: activity.filter((a) => a.job === j.id && a.kind === "call").map((a) => ({ at: a.at })),
      proposalOut: Boolean(proposal),
      proposalOpened: Boolean(proposal?.opened),
      emailOpened: opened.has(j.id),
    });
    out[j.id] = { heat, clock, priority: boardPriority(heat, clock) };
  }
  return rankPulses(out);
}

// ── Attachments ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface DealFile {
  id: string;
  name: string;
  type: string;
  size: number;
  by: string;
  at: string;
}

/** Up to 10 MB a file, the same kinds the team chat takes. */
export const DEAL_FILE_BYTES = 10 * 1024 * 1024;
export const DEAL_FILES_MAX = 100;

export class DealFileRefusal extends Error {}

export async function listDealFiles(businessId: string, jobId: string, viewer?: DealViewer): Promise<DealFile[] | null> {
  if (!(await jobById(businessId, jobId, viewer))) return null;
  return query<DealFile>(
    `select id, name, type, size, by_email as by, ${moment("at")} as at from design_deal_files where business_id = $1 and job_id = $2 order by at desc`,
    [businessId, jobId],
  );
}

/** Keeps files on a deal the member may see. Each is checked by type and size. */
export async function addDealFiles(
  businessId: string,
  jobId: string,
  files: readonly File[],
  by: string,
  viewer?: DealViewer,
): Promise<DealFile[] | null> {
  if (!(await jobById(businessId, jobId, viewer))) return null;
  if (!files.length) throw new DealFileRefusal("Choose a file first.");
  for (const f of files) {
    if (!TEAM_FILE_TYPES[f.type]) throw new DealFileRefusal("Keep pictures, PDFs, Word, Excel, CSV or text files.");
    if (f.size === 0) throw new DealFileRefusal(`${f.name} is empty.`);
    if (f.size > DEAL_FILE_BYTES) throw new DealFileRefusal(`${f.name} is over 10 MB.`);
  }
  const have = await query<{ n: string }>(`select count(*) as n from design_deal_files where business_id = $1 and job_id = $2`, [
    businessId,
    jobId,
  ]);
  if (Number(have[0]?.n ?? 0) + files.length > DEAL_FILES_MAX) throw new DealFileRefusal(`A deal keeps up to ${DEAL_FILES_MAX} files.`);
  for (const f of files)
    await query(
      `insert into design_deal_files (business_id, id, job_id, name, type, size, bytes, by_email) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        businessId,
        `df_${randomToken(10)}`,
        jobId,
        teamFileName(f.name, f.type),
        f.type,
        f.size,
        Buffer.from(await f.arrayBuffer()),
        by.toLowerCase(),
      ],
    );
  return listDealFiles(businessId, jobId, viewer);
}

export async function dealFile(
  businessId: string,
  jobId: string,
  fileId: string,
  viewer?: DealViewer,
): Promise<{ name: string; type: string; bytes: Buffer } | null> {
  if (!(await jobById(businessId, jobId, viewer))) return null;
  const rows = await query<{ name: string; type: string; bytes: Buffer }>(
    `select name, type, bytes from design_deal_files where business_id = $1 and job_id = $2 and id = $3`,
    [businessId, jobId, fileId],
  );
  return rows[0] ?? null;
}

export async function removeDealFile(businessId: string, jobId: string, fileId: string, viewer?: DealViewer): Promise<boolean> {
  if (!(await jobById(businessId, jobId, viewer))) return false;
  const rows = await query(`delete from design_deal_files where business_id = $1 and job_id = $2 and id = $3 returning id`, [
    businessId,
    jobId,
    fileId,
  ]);
  return rows.length > 0;
}
