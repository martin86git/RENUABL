/** Server only. Stripe Checkout (embedded payment form) for the refundable deposit. */
import Stripe from "stripe";
import { DEPOSIT, depositCents } from "@/lib/domain/deposit";
import { TRIAL_DAYS, packPriceCents, seatPriceCents, type BillingInterval, type TokenPack } from "@/lib/domain/design/plans";

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
 * RENUABL's own plans for solar businesses (`domain/design/plans.ts`): a subscription a user a month or year with a
 * free trial, and design-token packs. Prices go up as `price_data`, so nothing has to be set up in Stripe's Dashboard
 * first; they include GST, as the page says, so Stripe adds no tax. Hosted Checkout: Stripe's own secure page.
 */

/** What Stripe's page and the receipts call the plan. */
const PLAN_NAME = "RENUABL for solar businesses";

/** A sign-up: the plan for `seats` users, the trial first, the card taken now and charged when the trial ends. Returns the page's URL. */
export async function createTrialCheckout(
  stripe: Stripe,
  opts: { email: string; seats: number; interval: BillingInterval; origin: string },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: opts.email,
    payment_method_collection: "always",
    billing_address_collection: "auto",
    automatic_tax: { enabled: false },
    locale: "en-GB",
    line_items: [
      {
        quantity: opts.seats,
        price_data: {
          currency: "aud",
          unit_amount: seatPriceCents(opts.interval),
          recurring: { interval: opts.interval },
          product_data: { name: PLAN_NAME, description: "A user. Includes GST." },
        },
      },
    ],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { kind: "design-plan", email: opts.email },
    },
    metadata: { kind: "design-plan", email: opts.email },
    custom_text: {
      submit: { message: `${TRIAL_DAYS} days free. Nothing is charged until your trial ends, and you can cancel before then.` },
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
    ...(opts.customer ? { customer: opts.customer } : { customer_email: opts.email }),
    automatic_tax: { enabled: false },
    locale: "en-GB",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: packPriceCents(opts.pack),
          product_data: { name: `${opts.pack} design jobs`, description: `RENUABL design tool tokens, $3 a job. Includes GST.` },
        },
      },
    ],
    metadata: { kind: "design-tokens", business: opts.businessId, tokens: String(opts.pack), email: opts.email },
    success_url: `${opts.origin}/design/settings/billing?bought={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/design/settings/billing`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Stripe's own page for the card, invoices, seats and cancelling. Returns its URL. */
export async function billingPortalUrl(stripe: Stripe, customer: string, origin: string): Promise<string> {
  const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${origin}/design/settings/billing` });
  return portal.url;
}

/** What we keep of a subscription Stripe sends: its status, seats, interval, trial and period end. */
export function subscriptionFacts(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const interval: BillingInterval = item?.price?.recurring?.interval === "year" ? "year" : "month";
  return {
    stripeSubscription: sub.id,
    stripeCustomer: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    status: sub.status,
    interval,
    seats: item?.quantity ?? 1,
    trialEnd: sub.trial_end,
    periodEnd: item?.current_period_end ?? null,
  };
}
