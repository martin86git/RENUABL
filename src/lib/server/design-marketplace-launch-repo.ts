/**
 * Server only. The Marketplace's waiting list (domain/design/marketplace-launch.ts), kept as sales leads of kind
 * "marketplace" (design_leads, the same as the sign-up page's interest box): one place for everyone who asked.
 */
import { query } from "./db";
import { recordLead } from "./design-billing-repo";

/** Whether this email is already on the list. */
export async function onWaitlist(email: string): Promise<boolean> {
  const rows = await query(`select 1 from design_leads where kind = 'marketplace' and email = lower($1) limit 1`, [email]);
  return rows.length > 0;
}

/** How many businesses are on the list: each business once, and each email that came without one. */
export async function waitlistCount(): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(distinct coalesce(nullif(lower(business), ''), email)) as n from design_leads where kind = 'marketplace'`,
  );
  return Number(rows[0]?.n ?? 0);
}

/** Puts an email on the list once; asked again, it keeps the first. True when it was new. */
export async function joinWaitlist(lead: { email: string; business: string | null; name: string | null; note: string }): Promise<boolean> {
  if (await onWaitlist(lead.email)) return false;
  await recordLead("marketplace", lead);
  return true;
}
