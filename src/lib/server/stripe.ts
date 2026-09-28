/** Server only. Stripe Checkout (embedded payment form) for the refundable deposit. */
import Stripe from "stripe";
import { DEPOSIT, depositCents } from "@/lib/domain/deposit";

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
