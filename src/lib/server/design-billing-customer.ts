/**
 * Server only. The Stripe customer a business is billed as: its plan's, else one of its own. A business with no plan
 * (an installer buying design jobs, 2 Nov 2026) is given one the first time it buys, so its packs land on one
 * customer and its tax invoices can be listed and read back.
 */
import type Stripe from "stripe";
import { keepOwnCustomer, ownCustomerOf, subscriptionOf } from "./design-billing-repo";

export async function billingCustomer(businessId: string): Promise<string | null> {
  return (await subscriptionOf(businessId))?.stripeCustomer ?? (await ownCustomerOf(businessId));
}

export async function ensureBillingCustomer(stripe: Stripe, opts: { businessId: string; email: string; name: string }): Promise<string> {
  const have = await billingCustomer(opts.businessId);
  if (have) return have;
  const made = await stripe.customers.create({ email: opts.email, name: opts.name, metadata: { business: opts.businessId } });
  return keepOwnCustomer(opts.businessId, made.id);
}
