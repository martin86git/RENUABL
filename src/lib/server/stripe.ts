/** Server only. Stripe Checkout (embedded payment form) for the refundable deposit. */
import Stripe from "stripe";
import { DEPOSIT, depositCents } from "@/lib/domain/deposit";
import {
  COMMIT_SEAT_CENTS,
  FIRST_MONTH_CENTS,
  SEAT_MONTHLY_CENTS,
  dollars,
  packDollars,
  packPriceCents,
  type BillingInterval,
  type TokenPack,
} from "@/lib/domain/design/plans";
import { PLAN_CODE_WORDS, freeForGood } from "@/lib/domain/design/plan-codes";
import type { FoundCode } from "./stripe-plan-codes";
import { INVOICE_FOOTER, gstTaxRate, packInvoice, portalWithoutCancel, seatItem, termOf } from "./stripe-billing";

/** The API version and beta flag Stripe's embedded checkout form needs. */
export const STRIPE_API_VERSION = "2026-03-25.dahlia; custom_checkout_payment_form_preview=v1";

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion }) : null;
}

function depositParams(opts: { reference: string; email?: string | null }) {
  return {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: DEPOSIT.currency,
          unit_amount: depositCents(),
          product_data: {
            name: DEPOSIT.description,
            description: `Reservation ${opts.reference}. Fully refundable until your installation partner confirms the site visit.`,
          },
        },
      },
    ],
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    submit_type: "book",
    shipping_address_collection: { allowed_countries: ["AU"] },
    locale: "en-GB",
    customer_email: opts.email || undefined,
    client_reference_id: opts.reference,
    metadata: { reference: opts.reference, kind: "deposit" },
    payment_intent_data: {
      metadata: { reference: opts.reference, kind: "deposit" },
      description: `${DEPOSIT.description} ${opts.reference}`,
    },
  } satisfies Stripe.Checkout.SessionCreateParams;
}

/**
 * A Checkout Session for the deposit, shown as Stripe's embedded payment form
 * on our deposit page (cards, Apple Pay, Google Pay). Returns its client secret.
 * The reservation reference, receipt email and metadata stay attached so the
 * webhook can note the payment on the customer's HubSpot contact.
 */
export async function createDepositCheckout(stripe: Stripe, opts: { reference: string; email?: string | null; origin: string }) {
  const session = await stripe.checkout.sessions.create({
    ...depositParams(opts),
    ui_mode: "form",
    integration_identifier: "custom_embedded_web_0002",
    return_url: `${opts.origin}/deposit/paid?ref=${encodeURIComponent(opts.reference)}&session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session.client_secret) throw new Error("Stripe returned no client secret");
  return session.client_secret;
}

/** The backup: the same deposit on Stripe's own hosted payment page, when the embedded form can't load. Returns its URL. */
export async function createHostedDepositCheckout(stripe: Stripe, opts: { reference: string; email?: string | null; origin: string }) {
  const session = await stripe.checkout.sessions.create({
    ...depositParams(opts),
    success_url: `${opts.origin}/deposit/paid?ref=${encodeURIComponent(opts.reference)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/deposit?ref=${encodeURIComponent(opts.reference)}`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/*
 * RENUABL's own plans for solar businesses (`domain/design/plans.ts`): a subscription a user a month or year, charged
 * at checkout (no free trial since 3 Nov 2026), and design-token packs. Prices go up as `price_data`, so nothing has to be set up in Stripe's Dashboard
 * first; they include GST, as the page says, so Stripe adds no tax. Hosted Checkout: Stripe's own secure page.
 */

/** What Stripe's page and the receipts call the plan. */
const PLAN_NAME = "RENUABL for solar businesses";

/**
 * The first month's price, off the first bill only: $30 a user off $59, made for this sign-up's users (an amount off
 * is off the whole bill, so it is made for each sign-up).
 */
async function firstMonthCoupon(stripe: Stripe, seats: number): Promise<string> {
  const coupon = await stripe.coupons.create({
    amount_off: (SEAT_MONTHLY_CENTS - FIRST_MONTH_CENTS) * seats,
    currency: "aud",
    duration: "once",
    name: `First month: ${dollars(FIRST_MONTH_CENTS)} a user`,
    metadata: { kind: "design-first-month", seats: String(seats) },
  });
  return coupon.id;
}

/**
 * A sign-up: the plan for `seats` users at $59 a user a month, the first month at $29 (`firstMonthCoupon`), the card
 * taken and the first month charged now. Returns the page's URL. Yearly is no longer sold (plans.ts), so it is always
 * monthly; the 12-month plan is chosen afterwards in Billing (`commitToTwelveMonths`).
 */
export async function createPlanCheckout(
  stripe: Stripe,
  opts: { email: string; seats: number; interval?: BillingInterval; origin: string; code?: FoundCode | null },
): Promise<string> {
  // A code (plan-codes.ts) takes the place of the first month's price; free for good asks for no card.
  const code = opts.code ?? null;
  const session = await stripe.checkout.sessions.create({
    discounts: code ? [{ promotion_code: code.id }] : [{ coupon: await firstMonthCoupon(stripe, opts.seats) }],
    mode: "subscription",
    customer_email: opts.email,
    payment_method_collection: code && freeForGood(code.coupon) ? "if_required" : "always",
    billing_address_collection: "auto",
    automatic_tax: { enabled: false },
    locale: "en-GB",
    line_items: [
      {
        quantity: opts.seats,
        tax_rates: [await gstTaxRate(stripe)],
        price_data: {
          currency: "aud",
          unit_amount: SEAT_MONTHLY_CENTS,
          recurring: { interval: "month" },
          product_data: { name: PLAN_NAME, description: "A user. Includes GST." },
        },
      },
    ],
    subscription_data: {
      description: INVOICE_FOOTER,
      metadata: { kind: "design-plan", email: opts.email },
    },
    metadata: { kind: "design-plan", email: opts.email, ...(code ? { code: code.code } : {}) },
    custom_text: {
      submit: {
        message: code
          ? freeForGood(code.coupon)
            ? `Code ${code.code}: ${PLAN_CODE_WORDS.forever}`
            : `Code ${code.code}: ${code.words}, then ${dollars(SEAT_MONTHLY_CENTS)} a user a month. Cancel any time.`
          : `Your first month, ${dollars(FIRST_MONTH_CENTS)} a user, is charged today; then ${dollars(SEAT_MONTHLY_CENTS)} a user a month, or ${dollars(COMMIT_SEAT_CENTS)} if you choose the 12-month plan. Cancel any time.`,
      },
    },
    success_url: `${opts.origin}/design/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/design#pricing`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** A pack of design tokens for a business, paid now. Returns the page's URL. */
export async function createTokenCheckout(
  stripe: Stripe,
  opts: { businessId: string; email: string; pack: TokenPack; customer: string | null; origin: string },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(opts.customer ? { customer: opts.customer } : { customer_email: opts.email, customer_creation: "always" as const }),
    automatic_tax: { enabled: false },
    locale: "en-GB",
    line_items: [
      {
        quantity: 1,
        tax_rates: [await gstTaxRate(stripe)],
        price_data: {
          currency: "aud",
          unit_amount: packPriceCents(opts.pack),
          product_data: {
            name: `${packDollars(opts.pack)} design credits`,
            description: `RENUABL designer credits: 3 a site, 7 with a battery. Includes GST.`,
          },
        },
      },
    ],
    invoice_creation: packInvoice(opts.businessId),
    metadata: { kind: "design-tokens", business: opts.businessId, tokens: String(opts.pack), email: opts.email },
    success_url: `${opts.origin}/design/settings/billing?bought={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/design/settings/billing`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Stripe's own page for the card, details and invoices (cancelling is in Billing, `cancelPlan`). Returns its URL. */
export async function billingPortalUrl(stripe: Stripe, customer: string, origin: string): Promise<string> {
  const portal = await stripe.billingPortal.sessions.create({
    customer,
    configuration: await portalWithoutCancel(stripe),
    return_url: `${origin}/design/settings/billing`,
  });
  return portal.url;
}

/** What we keep of a subscription Stripe sends: its status, seats, interval, trial and period end, and its term. */
export function subscriptionFacts(sub: Stripe.Subscription) {
  const item = seatItem(sub);
  const interval: BillingInterval = item?.price?.recurring?.interval === "year" ? "year" : "month";
  const term = termOf(sub);
  return {
    term: term.term,
    commitFrom: term.from,
    commitUntil: term.until,
    stripeSubscription: sub.id,
    stripeCustomer: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    status: sub.status,
    interval,
    seats: item?.quantity ?? 1,
    trialEnd: sub.trial_end,
    periodEnd: item?.current_period_end ?? null,
  };
}
