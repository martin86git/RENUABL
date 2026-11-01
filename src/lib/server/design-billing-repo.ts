/**
 * Server only. A business's plan with RENUABL (its Stripe subscription) and its design tokens (`domain/design/plans.ts`),
 * under the designer's tenant rule: every function that reads or changes a business's billing takes the business id
 * first, and that id only ever comes from the signed-in member. A subscription made on the sign-up page is kept by the
 * email it was made for until that person's business exists, then attached to it (`claimSubscriptions`).
 */
import { TRIAL_JOBS, type BillingInterval } from "@/lib/domain/design/plans";
import { newId, query, transaction } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export interface Subscription {
  id: string;
  email: string;
  businessId: string | null;
  status: string;
  interval: BillingInterval;
  seats: number;
  trialEnd: string | null;
  periodEnd: string | null;
  stripeCustomer: string | null;
  stripeSubscription: string | null;
}

const SUBSCRIPTION = `id, email, business_id as "businessId", status, billing_interval as interval, seats,
  ${moment("trial_end")} as "trialEnd", ${moment("period_end")} as "periodEnd",
  stripe_customer as "stripeCustomer", stripe_subscription as "stripeSubscription"`;

export interface SubscriptionFacts {
  email: string;
  checkoutSession?: string | null;
  stripeCustomer: string | null;
  stripeSubscription: string;
  status: string;
  interval: BillingInterval;
  seats: number;
  /** Seconds since 1970, as Stripe gives them. */
  trialEnd: number | null;
  periodEnd: number | null;
}

const at = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** Keeps what Stripe says of a subscription (made or changed), then attaches it to the business of that email if there is one. */
export async function recordSubscription(facts: SubscriptionFacts): Promise<void> {
  await query(
    `insert into design_subscriptions (id, email, stripe_customer, stripe_subscription, checkout_session, status, billing_interval, seats, trial_end, period_end)
     values ($1, lower($2), $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (stripe_subscription) do update set
       stripe_customer = coalesce(excluded.stripe_customer, design_subscriptions.stripe_customer),
       checkout_session = coalesce(design_subscriptions.checkout_session, excluded.checkout_session),
       status = excluded.status, billing_interval = excluded.billing_interval, seats = excluded.seats,
       trial_end = excluded.trial_end, period_end = excluded.period_end, updated_at = now()`,
    [
      newId("sub"),
      facts.email,
      facts.stripeCustomer,
      facts.stripeSubscription,
      facts.checkoutSession ?? null,
      facts.status,
      facts.interval,
      facts.seats,
      at(facts.trialEnd),
      at(facts.periodEnd),
    ],
  );
  const owner = await query<{ business_id: string }>(`select business_id from business_members where lower(email) = lower($1) limit 1`, [
    facts.email,
  ]);
  if (owner[0]) await claimSubscriptions(owner[0].business_id, facts.email);
}

/** Changes a subscription Stripe has told us about (status, seats, dates); one we never recorded is left alone. */
export async function updateSubscription(facts: Omit<SubscriptionFacts, "email">): Promise<void> {
  await query(
    `update design_subscriptions set status = $2, billing_interval = $3, seats = $4, trial_end = $5, period_end = $6,
       stripe_customer = coalesce($7, stripe_customer), updated_at = now()
     where stripe_subscription = $1`,
    [facts.stripeSubscription, facts.status, facts.interval, facts.seats, at(facts.trialEnd), at(facts.periodEnd), facts.stripeCustomer],
  );
}

/**
 * Attaches the subscriptions made for this email to its business (once), and gives the business its free trial jobs
 * the first time it has a subscription. Safe to call again: nothing is attached or given twice.
 */
export async function claimSubscriptions(businessId: string, email: string): Promise<void> {
  const claimed = await query<{ id: string }>(
    `update design_subscriptions set business_id = $1, updated_at = now()
      where business_id is null and lower(email) = lower($2) returning id`,
    [businessId, email],
  );
  const any = claimed.length
    ? true
    : (await query(`select 1 from design_subscriptions where business_id = $1 limit 1`, [businessId])).length > 0;
  if (any)
    await query(
      `insert into design_tokens (id, business_id, change, reason, by_email) values ($1, $2, $3, 'trial', $4)
       on conflict do nothing`,
      [newId("tok"), businessId, TRIAL_JOBS, email.toLowerCase()],
    );
}

/** The business's plan: its newest subscription, or null when it has none. */
export async function subscriptionOf(businessId: string): Promise<Subscription | null> {
  const rows = await query<Subscription>(
    `select ${SUBSCRIPTION} from design_subscriptions where business_id = $1 order by created_at desc limit 1`,
    [businessId],
  );
  return rows[0] ?? null;
}

/** The subscription a sign-up's Checkout made, by that Checkout's id (for the welcome page). */
export async function subscriptionByCheckout(checkoutSession: string): Promise<Subscription | null> {
  const rows = await query<Subscription>(`select ${SUBSCRIPTION} from design_subscriptions where checkout_session = $1`, [checkoutSession]);
  return rows[0] ?? null;
}

export async function tokenBalance(businessId: string): Promise<number> {
  const rows = await query<{ n: string | null }>(`select sum(change) as n from design_tokens where business_id = $1`, [businessId]);
  return Number(rows[0]?.n ?? 0);
}

export interface TokenLine {
  change: number;
  reason: string;
  by: string | null;
  at: string;
}

export async function tokenLedger(businessId: string, limit = 50): Promise<TokenLine[]> {
  return query<TokenLine>(
    `select change, reason, by_email as by, ${moment("at")} as at from design_tokens where business_id = $1 order by at desc limit $2`,
    [businessId, limit],
  );
}

/** Adds a bought pack, once for each Stripe Checkout (Stripe may tell us twice). */
export async function creditPack(businessId: string, stripeSession: string, tokens: number, by: string | null): Promise<void> {
  await query(
    `insert into design_tokens (id, business_id, change, reason, stripe_session, by_email) values ($1, $2, $3, 'pack', $4, $5)
     on conflict (stripe_session) do nothing`,
    [newId("tok"), businessId, tokens, stripeSession, by?.toLowerCase() ?? null],
  );
}

/** Whether a new roof can be designed now: a token is left, or the roof has had its token already. */
export async function canStartRoof(businessId: string): Promise<boolean> {
  return (await tokenBalance(businessId)) > 0;
}

/**
 * Uses one token for a roof's first design. Once a roof: saving it again, or a teammate saving it, uses nothing.
 * "none" when there is no token to use (nothing is taken). Under a lock on the business, so two saves can't overspend.
 */
export async function spendToken(businessId: string, projectId: string, by: string): Promise<"used" | "already" | "none"> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('design-tokens:' || $1))`, [businessId]);
    const had = await q(`select 1 from design_tokens where business_id = $1 and project_id = $2 and reason = 'job'`, [
      businessId,
      projectId,
    ]);
    if (had.length) return "already";
    const left = await q<{ n: string | null }>(`select sum(change) as n from design_tokens where business_id = $1`, [businessId]);
    if (Number(left[0]?.n ?? 0) <= 0) return "none";
    await q(`insert into design_tokens (id, business_id, change, reason, project_id, by_email) values ($1, $2, -1, 'job', $3, $4)`, [
      newId("tok"),
      businessId,
      projectId,
      by.toLowerCase(),
    ]);
    return "used";
  });
}

export type LeadKind = "marketplace" | "enterprise";

/** Someone who asked about the marketplace, or an Enterprise plan, on the sign-up page. */
export async function recordLead(
  kind: LeadKind,
  lead: {
    email: string;
    name?: string | null;
    business?: string | null;
    mobile?: string | null;
    users?: number | null;
    note?: string | null;
  },
): Promise<void> {
  await query(`insert into design_leads (id, kind, email, name, business, mobile, users, note) values ($1,$2,lower($3),$4,$5,$6,$7,$8)`, [
    newId("lead"),
    kind,
    lead.email,
    lead.name ?? null,
    lead.business ?? null,
    lead.mobile ?? null,
    lead.users ?? null,
    lead.note ?? null,
  ]);
}
