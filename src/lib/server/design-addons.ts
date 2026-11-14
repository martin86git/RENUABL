/**
 * Server only. The add-ons a business has on its plan (custom proposals first), one row each, business id first.
 * Nothing sets one yet but staff in the database: buying it through Stripe comes with its price.
 */
import { CUSTOM_PROPOSALS, CUSTOM_PROPOSALS_MONTHLY_CENTS, mayPublishCustom } from "@/lib/domain/design/custom-proposals";
import { query } from "./db";
import { billingEnforced } from "./sol-credits";

export async function hasAddOn(businessId: string, addOn: string): Promise<boolean> {
  const rows = await query(`select 1 from design_addons where business_id = $1 and add_on = $2 and ended_at is null`, [businessId, addOn]);
  return rows.length > 0;
}

/** Whether this business may publish a proposal with its own design now. */
export async function customProposalsAllowed(businessId: string): Promise<boolean> {
  const enforced = billingEnforced();
  const cents = CUSTOM_PROPOSALS_MONTHLY_CENTS;
  if (!enforced || cents === null) return true;
  return mayPublishCustom({ enforced, cents, hasAddOn: await hasAddOn(businessId, CUSTOM_PROPOSALS).catch(() => false) });
}
