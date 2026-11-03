/**
 * Server only. A business's plan with RENUABL (its Stripe subscription) and its design tokens (`domain/design/plans.ts`),
 * under the designer's tenant rule: every function that reads or changes a business's billing takes the business id
 * first, and that id only ever comes from the signed-in member. A subscription made on the sign-up page is kept by the
 * email it was made for until that person's business exists, then attached to it (`claimSubscriptions`).
 */
import type { BillingDetails } from "@/lib/domain/design/billing-invoice";
import { BATTERY_EXTRA_DOLLARS, DESIGN_DOLLARS, type BillingInterval, type PlanTerm } from "@/lib/domain/design/plans";
import { creditSource, includedThisMonth, monthOf, solBalance, type SolBalance, type SolUse } from "@/lib/domain/design/sol-credits";
import { newId, query, transaction } from "./db";

type Q = Parameters<Parameters<typeof transaction>[0]>[0];

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
  /** Month to month, or the 12-month plan with its first own bill and its last day (plans.ts). */
  term: PlanTerm;
  commitFrom: string | null;
  commitUntil: string | null;
}

const SUBSCRIPTION = `id, email, business_id as "businessId", status, billing_interval as interval, seats,
  ${moment("trial_end")} as "trialEnd", ${moment("period_end")} as "periodEnd",
  stripe_customer as "stripeCustomer", stripe_subscription as "stripeSubscription",
  term, to_char(commit_from, 'YYYY-MM-DD') as "commitFrom", to_char(commit_until, 'YYYY-MM-DD') as "commitUntil"`;

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
  /** Month to month when not given. */
  term?: PlanTerm;
  commitFrom?: string | null;
  commitUntil?: string | null;
}

const at = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** Keeps what Stripe says of a subscription (made or changed), then attaches it to the business of that email if there is one. */
export async function recordSubscription(facts: SubscriptionFacts): Promise<void> {
  await query(
    `insert into design_subscriptions (id, email, stripe_customer, stripe_subscription, checkout_session, status, billing_interval, seats, trial_end, period_end, term, commit_from, commit_until)
     values ($1, lower($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (stripe_subscription) do update set
       stripe_customer = coalesce(excluded.stripe_customer, design_subscriptions.stripe_customer),
       checkout_session = coalesce(design_subscriptions.checkout_session, excluded.checkout_session),
       status = excluded.status, billing_interval = excluded.billing_interval, seats = excluded.seats,
       trial_end = excluded.trial_end, period_end = excluded.period_end,
       term = excluded.term, commit_from = excluded.commit_from, commit_until = excluded.commit_until, updated_at = now()`,
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
      facts.term ?? "flex",
      facts.commitFrom ?? null,
      facts.commitUntil ?? null,
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
       stripe_customer = coalesce($7, stripe_customer), term = $8, commit_from = $9, commit_until = $10, updated_at = now()
     where stripe_subscription = $1`,
    [
      facts.stripeSubscription,
      facts.status,
      facts.interval,
      facts.seats,
      at(facts.trialEnd),
      at(facts.periodEnd),
      facts.stripeCustomer,
      facts.term ?? "flex",
      facts.commitFrom ?? null,
      facts.commitUntil ?? null,
    ],
  );
}

/**
 * Attaches the subscriptions made for this email to its business (once). Safe to call again: nothing is attached
 * twice. Only a retailer has a plan (business-kind.ts): a subscription is never attached to an installer or inspector.
 * There are no free trial jobs since 3 Nov 2026 (no free trial): design jobs are bought in packs.
 */
export async function claimSubscriptions(businessId: string, email: string): Promise<void> {
  await query(
    `update design_subscriptions set business_id = $1, updated_at = now()
      where business_id is null and lower(email) = lower($2)
        and exists (select 1 from businesses where id = $1 and coalesce(kind, 'retailer') = 'retailer')`,
    [businessId, email],
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

/** Staff and the cron: every live 12-month plan that ended before today, to put back to month to month. */
export async function twelveMonthsEnded(today: string): Promise<string[]> {
  const rows = await query<{ stripe_subscription: string }>(
    `select stripe_subscription from design_subscriptions
      where term = 'commit' and commit_until <= $1::date and stripe_subscription is not null
        and status not in ('canceled', 'incomplete_expired')`,
    [today],
  );
  return rows.map((r) => r.stripe_subscription);
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
export async function canStartRoof(businessId: string, withBattery = false): Promise<boolean> {
  return (await tokenBalance(businessId)) >= DESIGN_DOLLARS + (withBattery ? BATTERY_EXTRA_DOLLARS : 0);
}

/** Whether a battery can go on a roof's designs now: it was paid for on this roof already, or $4 is left. */
export async function canAddBattery(businessId: string, projectId: string): Promise<boolean> {
  const had = await query(`select 1 from design_tokens where business_id = $1 and project_id = $2 and reason = 'battery'`, [
    businessId,
    projectId,
  ]);
  return had.length > 0 || (await tokenBalance(businessId)) >= BATTERY_EXTRA_DOLLARS;
}

/**
 * The $4 more a battery job takes (plans.ts), once a roof, when a design on it is first saved with a battery. Under the
 * same lock as `spendToken`. "none" when too little is left (nothing is taken).
 */
export async function spendBatteryDesign(businessId: string, projectId: string, by: string): Promise<"used" | "already" | "none"> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('design-tokens:' || $1))`, [businessId]);
    const had = await q(`select 1 from design_tokens where business_id = $1 and project_id = $2 and reason = 'battery'`, [
      businessId,
      projectId,
    ]);
    if (had.length) return "already";
    const left = await q<{ n: string | null }>(`select sum(change) as n from design_tokens where business_id = $1`, [businessId]);
    if (Number(left[0]?.n ?? 0) < BATTERY_EXTRA_DOLLARS) return "none";
    await q(`insert into design_tokens (id, business_id, change, reason, project_id, by_email) values ($1, $2, $3, 'battery', $4, $5)`, [
      newId("tok"),
      businessId,
      -BATTERY_EXTRA_DOLLARS,
      projectId,
      by.toLowerCase(),
    ]);
    return "used";
  });
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
    if (Number(left[0]?.n ?? 0) < DESIGN_DOLLARS) return "none";
    await q(`insert into design_tokens (id, business_id, change, reason, project_id, by_email) values ($1, $2, $3, 'job', $4, $5)`, [
      newId("tok"),
      businessId,
      -DESIGN_DOLLARS,
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

/*
 * Sol credits (`domain/design/sol-credits.ts`): the month's own, from the plan, are used first, then bought ones. Each
 * answer is one row: source "included" or "bought" (change -1), or "free" (nothing taken: billing isn't enforced yet
 * and none were left, so it is only counted). A pack bought is a row of its own (source "pack"), once a Checkout.
 */

/** Where the business's Sol credits stand this month. */
export async function solBalanceOf(businessId: string, today: string): Promise<SolBalance> {
  const [plan, rows] = await Promise.all([
    subscriptionOf(businessId),
    query<{ used: string | null; bought: string | null }>(
      `select coalesce(-sum(change) filter (where source = 'included' and month = $2), 0) as used,
              coalesce(sum(change) filter (where source in ('pack', 'bought')), 0) as bought
         from design_sol_credits where business_id = $1`,
      [businessId, monthOf(today)],
    ),
  ]);
  return solBalance(includedThisMonth(plan), Number(rows[0]?.used ?? 0), Number(rows[0]?.bought ?? 0));
}

/** The month's included credits used and the bought ones left, read inside a transaction. */
async function balanceIn(q: Q, businessId: string, today: string): Promise<SolBalance> {
  const plan =
    (
      await q<Subscription>(`select ${SUBSCRIPTION} from design_subscriptions where business_id = $1 order by created_at desc limit 1`, [
        businessId,
      ])
    )[0] ?? null;
  const row = (
    await q<{ used: string | null; bought: string | null }>(
      `select coalesce(-sum(change) filter (where source = 'included' and month = $2), 0) as used,
              coalesce(sum(change) filter (where source in ('pack', 'bought')), 0) as bought
         from design_sol_credits where business_id = $1`,
      [businessId, monthOf(today)],
    )
  )[0];
  return solBalance(includedThisMonth(plan), Number(row?.used ?? 0), Number(row?.bought ?? 0));
}

/**
 * Takes the credits for an answer from Sol (one, or more for a deep or researched one, sol-routing.ts), under a lock on
 * the business so two answers can't take the last ones twice. The answer is one row, its change the credits taken.
 * Answers with the row's id (to add to it, give it back, or keep its cost), or null when there aren't enough to take
 * and billing is enforced. Not enforced, an answer with none left is still counted ("free"), so the Billing page shows
 * real use. The month's credits are used first; an answer that needs more than the month has left takes them from the
 * month anyway (a few credits at most), so an answer is never split across two rows.
 */
export async function spendSolCredit(
  businessId: string,
  use: SolUse,
  by: string | null,
  today: string,
  enforced: boolean,
  credits = 1,
): Promise<string | null> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('sol-credits:' || $1))`, [businessId]);
    const balance = await balanceIn(q, businessId, today);
    if (enforced && balance.left < credits) return null;
    const source = creditSource(balance);
    const id = newId("sol");
    await q(`insert into design_sol_credits (id, business_id, change, source, month, use, by_email) values ($1, $2, $3, $4, $5, $6, $7)`, [
      id,
      businessId,
      source ? -credits : 0,
      source ?? "free",
      monthOf(today),
      use,
      by?.toLowerCase() ?? null,
    ]);
    return id;
  });
}

/**
 * More credits on an answer already begun (handed up to the deeper model, or researched online), added to its own row.
 * When billing is enforced and too few are left, nothing is added and false comes back (the answer goes on as it was).
 */
export async function addToSolCredit(businessId: string, id: string, more: number, today: string, enforced: boolean): Promise<boolean> {
  if (more <= 0) return true;
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('sol-credits:' || $1))`, [businessId]);
    if (enforced && (await balanceIn(q, businessId, today)).left < more) return false;
    await q(`update design_sol_credits set change = change - $3 where business_id = $1 and id = $2 and source in ('included', 'bought')`, [
      businessId,
      id,
      more,
    ]);
    return true;
  });
}

export interface SolCost {
  tier: string;
  model: string;
  reason: string;
  costMicros: number;
  usage: unknown;
}

/** What an answer really cost, kept on its row. Never throws: a cost not kept is a gap in the figures, not a failure. */
export async function keepSolCost(businessId: string, id: string, cost: SolCost): Promise<void> {
  await query(
    `update design_sol_credits set tier = $3, model = $4, reason = $5, cost_micros = $6, usage = $7 where business_id = $1 and id = $2`,
    [businessId, id, cost.tier, cost.model, cost.reason, cost.costMicros, JSON.stringify(cost.usage)],
  ).catch((e) => console.error("sol cost not kept", e instanceof Error ? e.message : e));
}

export interface SolCostLine {
  tier: string;
  answers: number;
  credits: number;
  /** US dollars, all those answers together. */
  usd: number;
}

/**
 * Staff only (`/admin`): every business's Sol answers this month by tier, with the credits they took and what they
 * really cost, so the allowance and packs can be checked against real use. Reads across businesses, totals only.
 */
export async function solCostsThisMonth(today: string): Promise<SolCostLine[]> {
  const rows = await query<{ tier: string | null; answers: string; credits: string | null; micros: string | null }>(
    `select tier, count(*) as answers, -sum(change) as credits, sum(cost_micros) as micros
       from design_sol_credits where month = $1 and source <> 'pack' and cost_micros is not null
      group by tier order by tier`,
    [monthOf(today)],
  );
  return rows.map((r) => ({
    tier: r.tier ?? "unknown",
    answers: Number(r.answers),
    credits: Number(r.credits ?? 0),
    usd: Number(r.micros ?? 0) / 1e6,
  }));
}

/** Gives back a credit taken for an answer that never came (Claude failed). */
export async function refundSolCredit(businessId: string, id: string): Promise<void> {
  await query(`delete from design_sol_credits where business_id = $1 and id = $2 and source <> 'pack'`, [businessId, id]);
}

/** Adds a bought pack of Sol credits, once for each Stripe Checkout. */
export async function creditSolPack(
  businessId: string,
  stripeSession: string,
  credits: number,
  by: string | null,
  today: string,
): Promise<void> {
  await query(
    `insert into design_sol_credits (id, business_id, change, source, month, stripe_session, by_email) values ($1, $2, $3, 'pack', $4, $5, $6)
     on conflict (stripe_session) do nothing`,
    [newId("sol"), businessId, credits, monthOf(today), stripeSession, by?.toLowerCase() ?? null],
  );
}

export interface SolUseLine {
  use: string;
  count: number;
}

/** This month's answers by what they were for, most first. */
export async function solUseThisMonth(businessId: string, today: string): Promise<SolUseLine[]> {
  const rows = await query<{ use: string; n: string }>(
    `select use, count(*) as n from design_sol_credits where business_id = $1 and month = $2 and use is not null group by use order by n desc`,
    [businessId, monthOf(today)],
  );
  return rows.map((r) => ({ use: r.use, count: Number(r.n) }));
}

/** Packs bought, newest first. */
export async function solPacksBought(businessId: string, limit = 12): Promise<{ credits: number; by: string | null; at: string }[]> {
  return query(
    `select change as credits, by_email as by, ${moment("at")} as at from design_sol_credits
      where business_id = $1 and source = 'pack' order by at desc limit $2`,
    [businessId, limit],
  );
}

/** The people in a business: what its subscription's users should come to. */
export async function memberCount(businessId: string): Promise<number> {
  const rows = await query<{ n: string }>(`select count(*) as n from business_members where business_id = $1`, [businessId]);
  return Number(rows[0]?.n ?? 0);
}

/** The billing details a business keeps for its invoices, or null before it has given any. */
export async function billingDetailsOf(businessId: string): Promise<BillingDetails | null> {
  const rows = await query<BillingDetails>(
    `select legal_name as "legalName", abn, email, address from design_billing_details where business_id = $1`,
    [businessId],
  );
  return rows[0] ?? null;
}

export async function saveBillingDetails(businessId: string, details: BillingDetails, by: string): Promise<void> {
  await query(
    `insert into design_billing_details (business_id, legal_name, abn, email, address, updated_by) values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id) do update set legal_name = excluded.legal_name, abn = excluded.abn, email = excluded.email,
       address = excluded.address, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, details.legalName, details.abn, details.email, details.address, by.toLowerCase()],
  );
}

/** The Stripe customer a business with no plan was given for its packs (`billingCustomer`), if any. */
export async function ownCustomerOf(businessId: string): Promise<string | null> {
  const rows = await query<{ stripe_customer: string }>(`select stripe_customer from design_stripe_customers where business_id = $1`, [
    businessId,
  ]);
  return rows[0]?.stripe_customer ?? null;
}

/** Keeps a business's own Stripe customer; when two were made at once, the first kept wins and is answered. */
export async function keepOwnCustomer(businessId: string, customer: string): Promise<string> {
  await query(`insert into design_stripe_customers (business_id, stripe_customer) values ($1, $2) on conflict (business_id) do nothing`, [
    businessId,
    customer,
  ]);
  return (await ownCustomerOf(businessId)) ?? customer;
}
