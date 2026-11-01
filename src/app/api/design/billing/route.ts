import { cleanPack } from "@/lib/domain/design/plans";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { claimSubscriptions, subscriptionOf, tokenBalance, tokenLedger } from "@/lib/server/design-billing-repo";
import { billingPortalUrl, createTokenCheckout, stripeClient } from "@/lib/server/stripe";

/** GET: the business's plan, its design tokens and the latest of what used and added them. The owner only. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { businessId, email } = who.member;
    await claimSubscriptions(businessId, email);
    const [plan, tokens, ledger] = await Promise.all([subscriptionOf(businessId), tokenBalance(businessId), tokenLedger(businessId)]);
    return Response.json({
      ok: true,
      plan: plan && { status: plan.status, interval: plan.interval, seats: plan.seats, trialEnd: plan.trialEnd, periodEnd: plan.periodEnd },
      tokens,
      ledger,
      payments: Boolean(stripeClient()),
    });
  });
}

/** POST { do: "tokens", pack } → Stripe's page to buy a pack; { do: "portal" } → Stripe's page for the card, invoices and seats. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2000);
    if ("refuse" in read) return read.refuse;
    const stripe = stripeClient();
    if (!stripe) return Response.json({ ok: false, message: "Payments aren't set up yet." }, { status: 503 });
    const origin = new URL(request.url).origin;
    const plan = await subscriptionOf(who.member.businessId);
    if (read.body.do === "portal") {
      if (!plan?.stripeCustomer) return Response.json({ ok: false, message: "There's no plan to manage yet." }, { status: 404 });
      return Response.json({ ok: true, url: await billingPortalUrl(stripe, plan.stripeCustomer, origin) });
    }
    const pack = cleanPack(read.body.pack);
    if (read.body.do !== "tokens" || !pack) return Response.json({ ok: false }, { status: 400 });
    const url = await createTokenCheckout(stripe, {
      businessId: who.member.businessId,
      email: who.member.email,
      pack,
      customer: plan?.stripeCustomer ?? null,
      origin,
    });
    return Response.json({ ok: true, url });
  });
}
