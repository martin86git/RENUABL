import { cleanBillingDetails } from "@/lib/domain/design/billing-invoice";
import { cleanPack } from "@/lib/domain/design/plans";
import { cleanSolPack } from "@/lib/domain/design/sol-credits";
import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import {
  billingDetailsOf,
  claimSubscriptions,
  saveBillingDetails,
  solBalanceOf,
  solPacksBought,
  solUseThisMonth,
  subscriptionOf,
  tokenBalance,
  tokenLedger,
} from "@/lib/server/design-billing-repo";
import { syncSeats } from "@/lib/server/design-seats";
import { billingPortalUrl, createTokenCheckout, stripeClient } from "@/lib/server/stripe";
import { createSolCheckout, invoicesOf, syncBillingCustomer } from "@/lib/server/stripe-billing";

/**
 * GET: the business's plan, its Sol credits and design tokens with what used them, its billing details and its
 * invoices from RENUABL. The owner only. Opening it also brings the plan's users into line with the team, should an
 * earlier change not have reached Stripe.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { businessId, email } = who.member;
    await claimSubscriptions(businessId, email);
    await syncSeats(businessId);
    const today = todayInMarket();
    const [plan, tokens, ledger, sol, solUses, solPacks, details] = await Promise.all([
      subscriptionOf(businessId),
      tokenBalance(businessId),
      tokenLedger(businessId),
      solBalanceOf(businessId, today),
      solUseThisMonth(businessId, today),
      solPacksBought(businessId),
      billingDetailsOf(businessId),
    ]);
    const stripe = stripeClient();
    // Invoices come from Stripe as they are; Stripe being slow or down never stops the rest of the page.
    const invoices =
      stripe && plan?.stripeCustomer
        ? await invoicesOf(stripe, plan.stripeCustomer).catch((e) => {
            console.error("invoices not read", e instanceof Error ? e.message : e);
            return null;
          })
        : [];
    return Response.json({
      ok: true,
      plan: plan && { status: plan.status, interval: plan.interval, seats: plan.seats, trialEnd: plan.trialEnd, periodEnd: plan.periodEnd },
      tokens,
      ledger,
      sol,
      solUses,
      solPacks,
      details,
      invoices:
        invoices?.map(({ id, number, created, status, totalCents, hostedUrl }) => ({
          id,
          number,
          created,
          status,
          totalCents,
          hostedUrl,
        })) ?? null,
      payments: Boolean(stripe),
    });
  });
}

/**
 * POST { do: "tokens", pack } or { do: "sol", credits } → Stripe's page to buy a pack; { do: "portal" } → Stripe's page
 * for the card, invoices and cancelling; { do: "details", legalName, abn, email, address } → the business's billing
 * details, kept and given to Stripe for its invoices.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4000);
    if ("refuse" in read) return read.refuse;
    const { businessId, email } = who.member;
    const stripe = stripeClient();
    const plan = await subscriptionOf(businessId);

    if (read.body.do === "details") {
      const details = cleanBillingDetails(read.body);
      if (!details.ok) return Response.json({ ok: false, message: details.message }, { status: 422 });
      await saveBillingDetails(businessId, details.value, email);
      if (stripe && plan?.stripeCustomer)
        await syncBillingCustomer(stripe, plan.stripeCustomer, details.value).catch((e) =>
          console.error("billing details not given to Stripe", e instanceof Error ? e.message : e),
        );
      return Response.json({ ok: true, details: details.value });
    }

    if (!stripe) return Response.json({ ok: false, message: "Payments aren't set up yet." }, { status: 503 });
    const origin = new URL(request.url).origin;
    if (read.body.do === "portal") {
      if (!plan?.stripeCustomer) return Response.json({ ok: false, message: "There's no plan to manage yet." }, { status: 404 });
      return Response.json({ ok: true, url: await billingPortalUrl(stripe, plan.stripeCustomer, origin) });
    }
    const customer = plan?.stripeCustomer ?? null;
    if (read.body.do === "sol") {
      const pack = cleanSolPack(read.body.credits);
      if (!pack) return Response.json({ ok: false }, { status: 400 });
      return Response.json({ ok: true, url: await createSolCheckout(stripe, { businessId, email, pack, customer, origin }) });
    }
    const pack = cleanPack(read.body.pack);
    if (read.body.do !== "tokens" || !pack) return Response.json({ ok: false }, { status: 400 });
    return Response.json({ ok: true, url: await createTokenCheckout(stripe, { businessId, email, pack, customer, origin }) });
  });
}
