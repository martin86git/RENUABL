/**
 * Server only. A job's site page's private link (/site/<token>, 24 Nov 2026, Martin: the install calendar event should
 * carry the panel layout and the deal's photos, and a calendar can't hold pictures). One a job, for good, made the
 * first time a member opens the job's event. Whoever has the event opens it with no sign-in: the 48 random
 * characters are the key. It shows the installer's side of the job card (never the customer's email) and the deal's
 * files. Under the tenant rule the link is made for a business id that only ever comes from the signed-in member.
 */
import { randomBytes } from "node:crypto";
import { query } from "./db";

const TOKEN = /^[a-f0-9]{48}$/;
export const isSiteToken = (t: string) => TOKEN.test(t);

/** The job's site page token, made once. */
export async function siteToken(businessId: string, jobId: string): Promise<string> {
  await query(
    `insert into design_site_links (token, business_id, job_id) values ($1, $2, $3)
     on conflict (business_id, job_id) do nothing`,
    [randomBytes(24).toString("hex"), businessId, jobId],
  );
  const rows = await query<{ token: string }>(`select token from design_site_links where business_id = $1 and job_id = $2`, [
    businessId,
    jobId,
  ]);
  return rows[0].token;
}

/** Whose job a link opens, or null for a link never made. */
export async function siteByToken(token: string): Promise<{ businessId: string; businessName: string; jobId: string } | null> {
  if (!isSiteToken(token)) return null;
  const rows = await query<{ businessId: string; businessName: string; jobId: string }>(
    `select l.business_id as "businessId", b.name as "businessName", l.job_id as "jobId"
       from design_site_links l join businesses b on b.id = l.business_id where l.token = $1`,
    [token],
  );
  return rows[0] ?? null;
}
