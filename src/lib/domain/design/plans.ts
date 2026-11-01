/**
 * What RENUABL costs a solar business, in one place (Martin, 1 Nov 2026). Pure, tested (`plans.test.ts`).
 *
 * Every price is in Australian dollars and **includes GST**. A seat is a user. Yearly billing is 20% off the whole
 * package, one user or twelve. The design tool is paid by the job in tokens, bought in packs: one token is used when a
 * job's first design is saved. A new business gets a 14-day free trial with five design jobs free; the card is taken
 * on Stripe's own page when they sign up. Teams of 13 or more talk to sales.
 */

export type BillingInterval = "month" | "year";

/** A user a month, cents, GST inclusive. */
export const SEAT_MONTHLY_CENTS = 2900;
/** Off the whole package when it is paid yearly. */
export const YEARLY_DISCOUNT = 0.2;
/** The most seats signed up for on the page; more is Enterprise. */
export const MAX_SELF_SERVE_SEATS = 12;
/** Enterprise starts here: talk to sales. */
export const ENTERPRISE_FROM = MAX_SELF_SERVE_SEATS + 1;
/** The free trial, days, and the design jobs it includes. */
export const TRIAL_DAYS = 14;
export const TRIAL_JOBS = 5;
/** One design job, cents, GST inclusive. */
export const TOKEN_CENTS = 300;
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
  gst: "Prices include GST.",
  yearly: `${Math.round(YEARLY_DISCOUNT * 100)}% off when you pay for the year`,
  yearlySeat: `${dollars(Math.round(seatPriceCents("year") / 12))} a user a month, billed yearly`,
  token: `${dollars(TOKEN_CENTS)} a job`,
  tokenExplained: `The design tool is ${dollars(TOKEN_CENTS)} a job: one token, used once when a new job's roof is designed. Open it, change it and send it again as often as you like.`,
  trial: `${TRIAL_DAYS}-day free trial`,
  trialExplained: `${TRIAL_DAYS} days free, with ${TRIAL_JOBS} design jobs on us. Your card is taken on Stripe's secure page and nothing is charged until the trial ends. Cancel any time before then and you pay nothing.`,
  enterprise: `${ENTERPRISE_FROM} users or more? Talk to us about Enterprise.`,
} as const;

/** Beside the people in a business: each is a paid user, and the plan follows the team. */
export const SEAT_NOTE = `Each person here is a user on your plan (${dollars(SEAT_MONTHLY_CENTS)} a month, or the yearly price). Adding or removing someone changes your plan straight away, and the difference for the rest of the period is on your next invoice.`;
