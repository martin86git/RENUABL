/**
 * Server only. A business's paid users follow its team (Martin, 1 Nov 2026): adding or removing someone changes the
 * subscription's users, and Stripe works out the difference for the rest of the period on the next invoice. Never
 * blocks the change to the team: a failure is logged, and the next change (or the Billing page opening) catches up.
 */
import { memberCount, subscriptionOf, updateSubscription } from "./design-billing-repo";
import { stripeClient, subscriptionFacts } from "./stripe";
import { setSeats } from "./stripe-billing";

export async function syncSeats(businessId: string): Promise<void> {
  try {
    const stripe = stripeClient();
    const plan = await subscriptionOf(businessId);
    if (!stripe || !plan?.stripeSubscription || ["canceled", "incomplete_expired"].includes(plan.status)) return;
    const people = await memberCount(businessId);
    if (people < 1 || people === plan.seats) return;
    if (await setSeats(stripe, plan.stripeSubscription, people))
      await updateSubscription(subscriptionFacts(await stripe.subscriptions.retrieve(plan.stripeSubscription)));
  } catch (e) {
    console.error("users not brought in line with the team", businessId, e instanceof Error ? e.message : e);
  }
}
