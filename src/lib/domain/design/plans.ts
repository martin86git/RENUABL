/**
 * What RENUABL costs a solar business, in one place (Martin, 1 Nov 2026). Pure, tested (`plans.test.ts`).
 *
 * Every price is in Australian dollars and **includes GST**. A seat is a user. Teams of 13 or more talk to sales.
 *
 * **The offer (16 Nov 2026, Martin: $99 was too premium; lead with $49)**: $49 a user a month, month to month, and
 * **the first month free**: the card is taken on Stripe's page at sign-up and the first charge is a month later
 * (a once-only coupon for the whole first bill). Any time, a business can choose the **12-month plan**: $39 a user a
 * month (20% off) for 12 months. Leaving it early pays back what it saved: $10 a user for each month billed at $39 on
 * it (`earlyExitCents`). When the 12 months are up it carries on at $49, unless another 12-month plan is chosen.
 *
 * **The designer is paid in credits** (16 Nov 2026, Martin): one credit is worth $1 at the smallest pack; a site
 * (a roof's first design) takes 3 credits, and 4 more the first time a design on it has a battery, so 7 in all.
 * Bigger packs add bonus credits. Every account gets `TRIAL_SITES` free sites in its first month, battery or not,
 * shared by everyone in it; after that nothing is included. The balance is kept in credits (`design_tokens`), shared
 * by the whole business.
 */

export type BillingInterval = "month" | "year";

/** A user a month, month to month, cents, GST inclusive. */
export const SEAT_MONTHLY_CENTS = 4900;
/** A user for the first month, cents: free (16 Nov 2026). */
export const FIRST_MONTH_CENTS = 0;
/** A user a month on the 12-month plan, cents. */
export const COMMIT_SEAT_CENTS = 3900;
/** How long the 12-month plan runs. */
export const COMMIT_MONTHS = 12;
/** Saved a user a month on the 12-month plan, and paid back for each month used when leaving it early. */
export const COMMIT_SAVING_CENTS = SEAT_MONTHLY_CENTS - COMMIT_SEAT_CENTS;
/** Off the whole package when it is paid yearly (old yearly plans only: no longer sold). */
export const YEARLY_DISCOUNT = 0.2;

/** Month to month, or the 12-month plan. */
export type PlanTerm = "flex" | "commit";

/** "2026-11-03" plus n months, the same day of the month or the last day of a shorter month. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * The 12-month plan chosen during the billing period from `periodStart` to `periodEnd`: it runs 12 months from that
 * period's start (so chosen in the first month, the first month counts), and its own $29 bills (the ones that would
 * otherwise have been $59) start with the next bill.
 */
export function commitTerm(periodStart: string, periodEnd: string): { from: string; until: string } {
  return { from: periodEnd.slice(0, 10), until: addMonthsISO(periodStart, COMMIT_MONTHS) };
}

/** How many of the 12-month plan's own monthly bills have fallen due by `today` (the bill on `from` is the first). */
export function commitBillsBy(from: string, today: string): number {
  let n = 0;
  while (n < COMMIT_MONTHS && addMonthsISO(from, n) <= today.slice(0, 10)) n++;
  return n;
}

/** What leaving the 12-month plan early costs: what it saved, $30 a user for each of its own bills so far. */
export function earlyExitCents(seats: number, bills: number): number {
  return Math.max(0, bills) * Math.max(1, seats) * COMMIT_SAVING_CENTS;
}

/** Whether the 12-month plan is still running on `today`. */
export const commitRunning = (until: string | null, today: string) => Boolean(until && today.slice(0, 10) < until.slice(0, 10));
/** The most seats signed up for on the page; more is Enterprise. */
export const MAX_SELF_SERVE_SEATS = 12;
/** Enterprise starts here: talk to sales. */
export const ENTERPRISE_FROM = MAX_SELF_SERVE_SEATS + 1;
/** One credit, cents: what a credit costs in the smallest pack. */
export const CREDIT_CENTS = 100;
/** A site with solar only, credits (and cents, at the smallest pack). */
export const SITE_CREDITS = 3;
/** A site with a battery, credits in all. */
export const BATTERY_SITE_CREDITS = 7;
/** The same in cents, as the page prints them. */
export const TOKEN_CENTS = SITE_CREDITS * CREDIT_CENTS;
export const BATTERY_DESIGN_CENTS = BATTERY_SITE_CREDITS * CREDIT_CENTS;
/** Taken when a roof's designs first have a battery, credits. */
export const BATTERY_EXTRA_DOLLARS = BATTERY_SITE_CREDITS - SITE_CREDITS;
/** Taken at a roof's first save, credits. */
export const DESIGN_DOLLARS = SITE_CREDITS;

/** Said when a roof can't be designed, or a battery added, for want of credits. */
export const NO_DESIGN_JOBS = `There aren't enough design credits for this site (${SITE_CREDITS} credits, or ${BATTERY_SITE_CREDITS} with a battery). Buy credits in Settings → Billing.`;

/** The balance in words: "52 credits · 17 sites, or 7 with a battery". */
export function designBalanceWords(credits: number): string {
  const n = Math.max(0, Math.floor(credits));
  const plain = Math.floor(n / SITE_CREDITS);
  const withBattery = Math.floor(n / BATTERY_SITE_CREDITS);
  return `${n} ${n === 1 ? "credit" : "credits"} · ${plain} ${plain === 1 ? "site" : "sites"}, or ${withBattery} with a battery`;
}
/** The packs credits are sold in, by their price in dollars (16 Nov 2026, Martin: bigger packs earn bonus credits). */
export const TOKEN_PACKS = [60, 150, 300, 600] as const;
export type TokenPack = (typeof TOKEN_PACKS)[number];
/** Bonus credits on each pack, as a share of its price. */
export const PACK_BONUS: Record<TokenPack, number> = { 60: 0, 150: 0.1, 300: 0.15, 600: 0.2 };
/** The credits a pack adds: its price in dollars and its bonus. */
export const packDollars = (pack: TokenPack) => Math.round(pack * (1 + PACK_BONUS[pack]));
/** The bonus credits in a pack. */
export const packBonus = (pack: TokenPack) => packDollars(pack) - pack;

/** A seat count from the browser: a whole number from 1 to the self-serve limit, else null. */
export function cleanSeats(raw: unknown): number | null {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_SELF_SERVE_SEATS ? n : null;
}

export function cleanInterval(raw: unknown): BillingInterval | null {
  return raw === "month" || raw === "year" ? raw : null;
}

export function cleanPack(raw: unknown): TokenPack | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return TOKEN_PACKS.find((p) => p === n) ?? null;
}

/** One seat's price for the interval it is billed at, cents: a month, or a year at 20% off. */
export function seatPriceCents(interval: BillingInterval): number {
  return interval === "month" ? SEAT_MONTHLY_CENTS : Math.round(SEAT_MONTHLY_CENTS * 12 * (1 - YEARLY_DISCOUNT));
}

export interface PlanPrice {
  seats: number;
  interval: BillingInterval;
  /** What is charged each time, cents: each month, or once a year. */
  chargeCents: number;
  /** The same as a month, for comparing, cents. */
  perMonthCents: number;
  /** What a year costs, cents. */
  yearCents: number;
  /** Saved over a year against paying monthly, cents (0 when monthly). */
  savedCents: number;
}

export function priceFor(seats: number, interval: BillingInterval): PlanPrice {
  const chargeCents = seatPriceCents(interval) * seats;
  const yearCents = interval === "month" ? chargeCents * 12 : chargeCents;
  return {
    seats,
    interval,
    chargeCents,
    perMonthCents: interval === "month" ? chargeCents : Math.round(chargeCents / 12),
    yearCents,
    savedCents: SEAT_MONTHLY_CENTS * 12 * seats - yearCents,
  };
}

export function packPriceCents(pack: TokenPack): number {
  return pack * 100;
}

/** A pack in words: "165 credits · $150 · +15 bonus". */
export function packWords(pack: TokenPack): string {
  const bonus = packBonus(pack);
  return `${packDollars(pack)} credits · ${dollars(packPriceCents(pack))}${bonus ? ` · +${bonus} bonus` : ""}`;
}

/** Dollars from cents for the page: whole dollars when there are no cents ("$29"), else two places ("$23.20"). */
export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The lines the page and the Billing page print, so they always agree with the prices above. */
/**
 * The free sites a new account gets in its first month (16 Nov 2026, Martin: "6 trial sites per account… they don't
 * need 50 to see the value"): one pool for the whole business, used by any designer, a site from it covering the
 * battery too. Nothing is included after the first month: sites come from the credits bought.
 */
export const TRIAL_SITES = 6;
/** Sites included each month after the first: none. */
export const DESIGNS_PER_USER = 0;
/** The first month's pool. */
export const FIRST_MONTH_DESIGNS = TRIAL_SITES;
/** How long the trial sites hold, days from the plan's start. */
export const FIRST_MONTH_DAYS = 31;

/** Whole days from one ISO date to another. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000);

/** The free sites a plan has this month on `today`: the trial's in its first month, else none. */
export function designsIncluded(plan: { status: string; seats: number; startedAt?: string | null } | null, today: string): number {
  if (!plan || !["active", "past_due", "trialing"].includes(plan.status)) return 0;
  const perUsers = DESIGNS_PER_USER * Math.max(1, plan.seats); // none since 16 Nov 2026
  const firstMonth =
    plan.startedAt != null && daysBetween(plan.startedAt, today) >= 0 && daysBetween(plan.startedAt, today) < FIRST_MONTH_DAYS;
  return firstMonth ? Math.max(perUsers, FIRST_MONTH_DESIGNS) : perUsers;
}

export interface DesignPool {
  /** In the pool this month. */
  included: number;
  /** Of those, used by anyone in the business. */
  used: number;
  /** Still to use this month. */
  left: number;
}

export function designPool(included: number, used: number): DesignPool {
  return { included, used, left: Math.max(0, included - used) };
}

/** "2 of 6 free trial sites used · shared by everyone in the business". */
export function designPoolWords(pool: DesignPool): string {
  return `${pool.used} of ${pool.included} free trial sites used · shared by everyone in the business`;
}

/** The first month, in words: "free", or "$29 a user". */
export const firstMonthWords = FIRST_MONTH_CENTS === 0 ? "free" : `${dollars(FIRST_MONTH_CENTS)} a user`;

export const PLAN_WORDS = {
  seat: `${dollars(SEAT_MONTHLY_CENTS)} a user a month`,
  /** The offer, in one line for the page. */
  offer: `${dollars(SEAT_MONTHLY_CENTS)} a user a month. Your first month is ${firstMonthWords}.`,
  firstMonth: `Your first month ${FIRST_MONTH_CENTS === 0 ? "is free" : `is ${firstMonthWords}`}`,
  commit: `${dollars(COMMIT_SEAT_CENTS)} a user a month on the ${COMMIT_MONTHS}-month plan`,
  noLockIn: "No lock-in contract. Cancel any time.",
  offerExplained: `Your first month is ${firstMonthWords}. After that it's ${dollars(SEAT_MONTHLY_CENTS)} a user a month, month to month, cancel any time. Or choose the ${COMMIT_MONTHS}-month plan for ${dollars(COMMIT_SEAT_CENTS)} a user a month.`,
  commitExplained: `${dollars(COMMIT_SEAT_CENTS)} a user a month for ${COMMIT_MONTHS} months, counted from the start of the month you choose it. Leave before the ${COMMIT_MONTHS} months are up and you pay back what you saved: ${dollars(COMMIT_SAVING_CENTS)} a user for each month billed at ${dollars(COMMIT_SEAT_CENTS)} on the plan. When the ${COMMIT_MONTHS} months are up it carries on at ${dollars(SEAT_MONTHLY_CENTS)} a month, unless you choose another ${COMMIT_MONTHS}-month plan.`,
  gst: "Prices include GST.",
  /** Said beside the plan step's button, so trying the first month is plainly free of risk (5 Nov 2026, Martin). */
  tryFirstMonth: `Your first month is ${firstMonthWords}. Not for you? Cancel any time in Settings → Billing before it ends and nothing is charged. No lock-in contract.`,
  yearly: `${Math.round(YEARLY_DISCOUNT * 100)}% off when you pay for the year`,
  yearlySeat: `${dollars(Math.round(seatPriceCents("year") / 12))} a user a month, billed yearly`,
  token: `${SITE_CREDITS} credits a site, ${BATTERY_SITE_CREDITS} with a battery`,
  trialSites: `${TRIAL_SITES} free sites in your first month`,
  tokenExplained: `The designer runs on credits your whole team shares: a site is ${SITE_CREDITS} credits, ${BATTERY_SITE_CREDITS} once it has a battery, taken once a roof. Open it, change it and send it again as often as you like. Credits start at ${dollars(CREDIT_CENTS)} each, and bigger packs add bonus credits. Your first month includes ${TRIAL_SITES} free sites.`,
  packs: TOKEN_PACKS.map(packWords).join("; "),
  start: "Get started",
  startExplained: `Your card is taken on Stripe's secure page. Your first month is ${firstMonthWords}, then ${dollars(SEAT_MONTHLY_CENTS)} a user a month. Cancel any time before it ends and nothing is charged.`,
  enterprise: `${ENTERPRISE_FROM} users or more? Talk to us about Enterprise.`,
} as const;

/** Beside the people in a business: each is a paid user, and the plan follows the team. */
export const SEAT_NOTE = `Each person here is a user on your plan (${dollars(SEAT_MONTHLY_CENTS)} a month, or ${dollars(COMMIT_SEAT_CENTS)} on the 12-month plan). Adding or removing someone changes your plan straight away, and the difference for the rest of the period is on your next invoice.`;

/** What Billing says of a plan now: the price a user on the next bill, the term in words, and what's on offer. */
export interface PlanNow {
  /** A user, on the next bill, cents. */
  nextPerUserCents: number;
  term: PlanTerm;
  /** "Month to month" or "12-month plan until 3 November 2027". */
  termWords: string;
  /** The 12-month plan can be chosen now. */
  canCommit: boolean;
  /** What leaving now would cost, cents (0 month to month). */
  exitCents: number;
}

export function planNow(
  p: { seats: number; interval: BillingInterval; term: PlanTerm; commitFrom: string | null; commitUntil: string | null },
  today: string,
  day: (iso: string) => string,
): PlanNow {
  if (p.interval === "year")
    return { nextPerUserCents: seatPriceCents("year"), term: "flex", termWords: "Yearly", canCommit: false, exitCents: 0 };
  if (p.term === "commit" && p.commitUntil && commitRunning(p.commitUntil, today))
    return {
      nextPerUserCents: COMMIT_SEAT_CENTS,
      term: "commit",
      termWords: `${COMMIT_MONTHS}-month plan until ${day(p.commitUntil)}`,
      canCommit: false,
      exitCents: p.commitFrom ? earlyExitCents(p.seats, commitBillsBy(p.commitFrom, today)) : 0,
    };
  return { nextPerUserCents: SEAT_MONTHLY_CENTS, term: "flex", termWords: "Month to month", canCommit: true, exitCents: 0 };
}
