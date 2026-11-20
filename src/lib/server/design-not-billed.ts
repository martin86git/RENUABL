/**
 * Server only. A business RENUABL doesn't bill (20 Nov 2026, Martin: Primero Solar uses RENUABL Business as an ordinary
 * retailer, with an ordinary login, but isn't to be charged). Set by RENUABL's staff on /admin, never by a business:
 * the owner isn't stopped at the plan step, Sol's credits and design jobs are never refused, and every add-on is
 * included as it is for RENUABL's own business. Kept on `businesses` (who set it and when), business id first.
 */
import { query } from "./db";

let ready: Promise<unknown> | null = null;

export function ensureNotBilled(): Promise<unknown> {
  ready ??= query(
    `alter table businesses add column if not exists not_billed_by text, add column if not exists not_billed_at timestamptz`,
  ).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/** Whether RENUABL has set this business as not billed. */
export async function isNotBilled(businessId: string): Promise<boolean> {
  await ensureNotBilled();
  const rows = await query<{ at: string | null }>(`select not_billed_at as at from businesses where id = $1`, [businessId]);
  return Boolean(rows[0]?.at);
}

/** Staff only (the route checks): set a business as not billed, or billed again. */
export async function setNotBilled(businessId: string, on: boolean, by: string): Promise<boolean> {
  await ensureNotBilled();
  const rows = await query(
    on
      ? `update businesses set not_billed_by = $2, not_billed_at = now() where id = $1 returning id`
      : `update businesses set not_billed_by = null, not_billed_at = null where id = $1 and $2::text is not null returning id`,
    [businessId, by],
  );
  return rows.length > 0;
}
