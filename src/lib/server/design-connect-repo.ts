/**
 * Server only. A business's own Stripe account for taking card payments from its customers (Stripe Connect,
 * `domain/design/proposal-payments.ts`), and the payments made through it on proposals. Under the designer's tenant
 * rule: every function a member reaches takes the business id first, from the signed-in member only. Only the webhook
 * finds a business by its Stripe account, as Stripe names it.
 */
import { NOT_CONNECTED, type ConnectState } from "@/lib/domain/design/proposal-payments";
import { query } from "./db";
import type { Q } from "./design-crm-repo";

export interface Connected extends ConnectState {
  account: string | null;
  /** The business has card payments switched on for its proposals. */
  cardsOn: boolean;
}

const NONE: Connected = { ...NOT_CONNECTED, account: null, cardsOn: false };

export async function connectOf(businessId: string, q: Q | typeof query = query): Promise<Connected> {
  const rows = await q<{ account: string; charges: boolean; submitted: boolean; cards: boolean }>(
    `select stripe_account as account, charges_enabled as charges, details_submitted as submitted, cards_on as cards
       from design_connect where business_id = $1`,
    [businessId],
  );
  const r = rows[0];
  return r ? { connected: true, account: r.account, chargesEnabled: r.charges, detailsSubmitted: r.submitted, cardsOn: r.cards } : NONE;
}

/** Keeps the Stripe account made for a business (one a business; a second is never made over the first). */
export async function saveConnectAccount(businessId: string, account: string, by: string): Promise<void> {
  await query(
    `insert into design_connect (business_id, stripe_account, created_by) values ($1, $2, $3) on conflict (business_id) do nothing`,
    [businessId, account, by.toLowerCase()],
  );
}

/** What Stripe says of an account (from the webhook, or read when the business comes back from Stripe's pages). */
export async function updateConnect(account: string, facts: { chargesEnabled: boolean; detailsSubmitted: boolean }): Promise<void> {
  await query(`update design_connect set charges_enabled = $2, details_submitted = $3, updated_at = now() where stripe_account = $1`, [
    account,
    facts.chargesEnabled,
    facts.detailsSubmitted,
  ]);
}

export async function setCardsOn(businessId: string, on: boolean): Promise<boolean> {
  const rows = await query(`update design_connect set cards_on = $2, updated_at = now() where business_id = $1 returning 1`, [
    businessId,
    on,
  ]);
  return rows.length > 0;
}

/** The business a Stripe account belongs to (for the webhook only). */
export async function businessOfAccount(account: string): Promise<string | null> {
  const rows = await query<{ id: string }>(`select business_id as id from design_connect where stripe_account = $1`, [account]);
  return rows[0]?.id ?? null;
}

export interface CardPayment {
  dueKey: string;
  name: string;
  amountCents: number;
  feeCents: number;
  paidAt: string;
}

/** What has been paid by card on a version, oldest first. */
export async function paymentsOn(businessId: string, versionId: string, q: Q | typeof query = query): Promise<CardPayment[]> {
  return q<CardPayment>(
    `select due_key as "dueKey", name, amount_cents as "amountCents", fee_cents as "feeCents",
            to_char(paid_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "paidAt"
       from design_proposal_payments where business_id = $1 and version_id = $2 order by paid_at`,
    [businessId, versionId],
  );
}

/** RENUABL's fees on a business's card payments, by month (for its Billing page). */
export async function feesByMonth(
  businessId: string,
): Promise<{ month: string; payments: number; amountCents: number; feeCents: number }[]> {
  const rows = await query<{ month: string; n: string; amount: string; fee: string }>(
    `select to_char(paid_at at time zone 'Australia/Melbourne', 'YYYY-MM') as month, count(*) as n,
            sum(amount_cents) as amount, sum(fee_cents) as fee
       from design_proposal_payments where business_id = $1 group by 1 order by 1 desc limit 12`,
    [businessId],
  );
  return rows.map((r) => ({ month: r.month, payments: Number(r.n), amountCents: Number(r.amount), feeCents: Number(r.fee) }));
}
