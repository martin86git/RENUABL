/**
 * What RENUABL costs a solar business, in one place (Martin, 1 Nov 2026). Pure, tested (`plans.test.ts`).
 *
 * Every price is in Australian dollars and **includes GST**. A seat is a user. The design tool is paid by the job in
 * tokens, bought in packs: one token is used when a job's first design is saved. There is no free trial (3 Nov 2026,
 * Martin: "just charge immediately"): the card is taken on Stripe's own page when they sign up. Teams of 13 or more
 * talk to sales.
 *
 * **The offer (3 Nov 2026, Martin: $29 undervalued specialist software for a small market)**: $99 a user a month,
 * month to month. The first month is $29 a user, with nothing to sign. Before it ends (or any time after) a business
 * can choose the **12-month plan**: $69 a user a month for 12 months from the bill that started the month it chose it.
 * Leaving the 12-month plan early means paying back what it saved: $30 a user for each month billed at $69 on it,
 * after the first month (`earlyExitCents`). When the 12 months are up it carries on at $99, month to month, unless
 * they choose another 12-month plan. Yearly billing (20% off) was dropped for new sign-ups: the 12-month plan is the
 * better deal and easier to say. Old yearly plans are still read (`BillingInterval`).
 */

export type BillingInterval = "month" | "year";

/** A user a month, month to month, cents, GST inclusive. */
export const SEAT_MONTHLY_CENTS = 9900;
/** A user for the first month, cents. */
export const FIRST_MONTH_CENTS = 2900;
/** A user a month on the 12-month plan, cents. */
export const COMMIT_SEAT_CENTS = 6900;
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
/**
 * A design job, cents, GST inclusive (3 Nov 2026, Martin: $3 is where it starts, $7 once a battery is added). Design
 * jobs are a balance in whole dollars: a roof's first save takes $3, and the first save of any design on it with a
 * battery takes $4 more, so a battery job is $7 in all. Packs keep their prices and add their dollars.
 */
export const TOKEN_CENTS = 300;
/** A design job with a battery, cents. */
export const BATTERY_DESIGN_CENTS = 700;
/** Taken when a roof's designs first have a battery, dollars of the balance. */
export const BATTERY_EXTRA_DOLLARS = (BATTERY_DESIGN_CENTS - TOKEN_CENTS) / 100;
/** Taken at a roof's first save, dollars of the balance. */
export const DESIGN_DOLLARS = TOKEN_CENTS / 100;
/** A pack of design jobs adds its price to the balance, in dollars. */
export const packDollars = (pack: TokenPack) => (pack * TOKEN_CENTS) / 100;

/** Said when a roof can't be designed, or a battery added, for want of design jobs. */
export const NO_DESIGN_JOBS = "There isn't enough left for this design job ($3, or $7 with a battery). Buy a pack in Settings → Billing.";

/** The balance in words: "$57 · 19 designs, or 8 with a battery". */
export function designBalanceWords(dollarsLeft: number): string {
  const n = Math.max(0, dollarsLeft);
  const plain = Math.floor(n / DESIGN_DOLLARS);
  const withBattery = Math.floor((n * 100) / BATTERY_DESIGN_CENTS);
  return `${dollars(n * 100)} · ${plain} ${plain === 1 ? "design" : "designs"}, or ${withBattery} with a battery`;
}
/** The packs tokens are sold in. */
export const TOKEN_PACKS = [20, 50, 100] as const;
export type TokenPack = (typeof TOKEN_PACKS)[number];

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
  return pack * TOKEN_CENTS;
}

/** Dollars from cents for the page: whole dollars when there are no cents ("$29"), else two places ("$23.20"). */
export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The lines the page and the Billing page print, so they always agree with the prices above. */
export const PLAN_WORDS = {
  seat: `${dollars(SEAT_MONTHLY_CENTS)} a user a month`,
  /** The offer, in one line for the page. */
  offer: `${dollars(SEAT_MONTHLY_CENTS)} a user. Your first month, ${dollars(FIRST_MONTH_CENTS)}.`,
  firstMonth: `${dollars(FIRST_MONTH_CENTS)} a user for your first month`,
  commit: `${dollars(COMMIT_SEAT_CENTS)} a user a month on the ${COMMIT_MONTHS}-month plan`,
  noLockIn: "Nothing to sign for the first month. Cancel any time.",
  offerExplained: `Your first month is ${dollars(FIRST_MONTH_CENTS)} a user, with nothing to sign. Before it ends, choose the ${COMMIT_MONTHS}-month plan and stay at ${dollars(COMMIT_SEAT_CENTS)} a user a month, or do nothing and carry on month to month at ${dollars(SEAT_MONTHLY_CENTS)}, cancel any time.`,
  commitExplained: `${dollars(COMMIT_SEAT_CENTS)} a user a month for ${COMMIT_MONTHS} months, counted from the start of the month you choose it. Leave before the ${COMMIT_MONTHS} months are up and you pay back what you saved: ${dollars(COMMIT_SAVING_CENTS)} a user for each month billed at ${dollars(COMMIT_SEAT_CENTS)} on the plan, after your first month. When the ${COMMIT_MONTHS} months are up it carries on at ${dollars(SEAT_MONTHLY_CENTS)} a month, unless you choose another ${COMMIT_MONTHS}-month plan.`,
  gst: "Prices include GST.",
  yearly: `${Math.round(YEARLY_DISCOUNT * 100)}% off when you pay for the year`,
  yearlySeat: `${dollars(Math.round(seatPriceCents("year") / 12))} a user a month, billed yearly`,
  token: `${dollars(TOKEN_CENTS)} a design, ${dollars(BATTERY_DESIGN_CENTS)} with a battery`,
  tokenExplained: `The design tool is ${dollars(TOKEN_CENTS)} a design job, ${dollars(BATTERY_DESIGN_CENTS)} once it has a battery: taken once a roof, the day it's saved, and the rest the day a battery goes on it. Open it, change it and send it again as often as you like. Packs add their price to your balance.`,
  start: "Get started",
  startExplained: `Your card is taken on Stripe's secure page and your plan starts straight away, at ${dollars(FIRST_MONTH_CENTS)} a user for the first month. Cancel any time: it runs to the end of the month you've paid for.`,
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
