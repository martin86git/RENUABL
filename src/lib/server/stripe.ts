/** Server only. Stripe Checkout for the refundable deposit. */
import Stripe from "stripe";
import { DEPOSIT, depositCents } from "@/lib/domain/deposit";

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? new Stripe(key) : null;
}

/** A hosted Stripe Checkout page for the deposit (cards, Apple Pay, Google Pay). */
export async function createDepositCheckout(stripe: Stripe, opts: { reference: string; email?: string | null; origin: string }) {
  const session = await stripe.checkout.sessions.create({
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
    customer_email: opts.email || undefined,
    client_reference_id: opts.reference,
    metadata: { reference: opts.reference, kind: "deposit" },
    payment_intent_data: {
      metadata: { reference: opts.reference, kind: "deposit" },
      description: `${DEPOSIT.description} ${opts.reference}`,
    },
    success_url: `${opts.origin}/deposit/paid?ref=${encodeURIComponent(opts.reference)}`,
    cancel_url: `${opts.origin}/deposit?ref=${encodeURIComponent(opts.reference)}`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}
