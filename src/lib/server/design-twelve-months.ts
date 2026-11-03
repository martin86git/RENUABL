/**
 * Server only. The 12-month plan's end (plans.ts): from the daily cron, each plan whose 12 months are up goes back to
 * $59 a user a month, month to month, on Stripe and here. Each one on its own, so one failing never holds up the rest.
 */
import { todayInMarket } from "@/lib/domain/market";
import { twelveMonthsEnded, updateSubscription } from "./design-billing-repo";
import { stripeClient, subscriptionFacts } from "./stripe";
import { endTwelveMonths } from "./stripe-billing";

/** How many plans went back to month to month. */
export async function endTwelveMonthPlans(): Promise<number> {
  const stripe = stripeClient();
  if (!stripe) return 0;
  let ended = 0;
  for (const id of await twelveMonthsEnded(todayInMarket())) {
    try {
      if (await endTwelveMonths(stripe, id)) ended++;
      await updateSubscription(subscriptionFacts(await stripe.subscriptions.retrieve(id)));
    } catch (e) {
      console.error("12-month plan not ended", id, e instanceof Error ? e.message : e);
    }
  }
  return ended;
}
