import { cleanBillingDetails } from "@/lib/domain/design/billing-invoice";
import { KIND_REFUSAL, billingParts, billsFor, cleanKind } from "@/lib/domain/design/business-kind";
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
  updateSubscription,
} from "@/lib/server/design-billing-repo";
import { billingCustomer, ensureBillingCustomer } from "@/lib/server/design-billing-customer";
import { syncSeats } from "@/lib/server/design-seats";
import { billingPortalUrl, createTokenCheckout, stripeClient, subscriptionFacts } from "@/lib/server/stripe";
import { cancelPlan, commitToTwelveMonths, createSolCheckout, invoicesOf, syncBillingCustomer } from "@/lib/server/stripe-billing";

/**
 * GET: the business's plan, its Sol credits and design tokens with what used them, its billing details and its
 * invoices from RENUABL. The owner only. Opening it also brings the plan's users into line with the team, should an
 * earlier change not have reached Stripe. An installer (business-kind.ts) is answered its design jobs, invoices and
 * details only: no plan, users or Sol credits (`parts` says which the page shows).
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { businessId, email } = who.member;
    const kind = cleanKind(who.member.businessKind);
    const withPlan = billsFor(kind, "plan");
    const withSol = billsFor(kind, "sol");
    if (withPlan) {
      await claimSubscriptions(businessId, email);
      await syncSeats(businessId);
    }
    const today = todayInMarket();
    const [plan, tokens, ledger, sol, solUses, solPacks, details, customer] = await Promise.all([
      withPlan ? subscriptionOf(businessId) : null,
      tokenBalance(businessId),
      tokenLedger(businessId),
      withSol ? solBalanceOf(businessId, today) : null,
      withSol ? solUseThisMonth(businessId, today) : [],
      withSol ? solPacksBought(businessId) : [],
      billingDetailsOf(businessId),
      billingCustomer(businessId),
    ]);
    const stripe = stripeClient();
    // Invoices come from Stripe as they are; Stripe being slow or down never stops the rest of the page.
    const invoices =
      stripe && customer
        ? await invoicesOf(stripe, customer).catch((e) => {
            console.error("invoices not read", e instanceof Error ? e.message : e);
            return null;
          })
        : [];
    return Response.json({
      ok: true,
      parts: billingParts(kind),
      plan: plan && {
        status: plan.status,
        interval: plan.interval,
        seats: plan.seats,
        trialEnd: plan.trialEnd,
        periodEnd: plan.periodEnd,
        term: plan.term,
        commitFrom: plan.commitFrom,
        commitUntil: plan.commitUntil,
      },
      today,
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
 * for the card and invoices; { do: "commit" } → the 12-month plan; { do: "cancel" } → cancelled at the end of the month
 * paid for, with what leaving the 12-month plan early costs charged first; { do: "details", legalName, abn, email, address } → the business's billing
 * details, kept and given to Stripe for its invoices.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4000);
    if ("refuse" in read) return read.refuse;
    const { businessId, email } = who.member;
    const kind = cleanKind(who.member.businessKind);
    const stripe = stripeClient();
    const plan = billsFor(kind, "plan") ? await subscriptionOf(businessId) : null;
    const customer = await billingCustomer(businessId);

    if (read.body.do === "details") {
      const details = cleanBillingDetails(read.body);
      if (!details.ok) return Response.json({ ok: false, message: details.message }, { status: 422 });
      await saveBillingDetails(businessId, details.value, email);
      if (stripe && customer)
        await syncBillingCustomer(stripe, customer, details.value).catch((e) =>
          console.error("billing details not given to Stripe", e instanceof Error ? e.message : e),
        );
      return Response.json({ ok: true, details: details.value });
    }

    const origin = new URL(request.url).origin;
    // A business with no plan (an installer) has no plan to manage and no Sol to buy for: refused here, not only hidden.
    if (
      (["portal", "commit", "cancel"].includes(String(read.body.do)) && !billsFor(kind, "plan")) ||
      (read.body.do === "sol" && !billsFor(kind, "sol"))
    )
      return Response.json({ ok: false, message: KIND_REFUSAL }, { status: 403 });
    if (!stripe) return Response.json({ ok: false, message: "Payments aren't set up yet." }, { status: 503 });
    if (read.body.do === "portal") {
      if (!plan?.stripeCustomer) return Response.json({ ok: false, message: "There's no plan to manage yet." }, { status: 404 });
      return Response.json({ ok: true, url: await billingPortalUrl(stripe, plan.stripeCustomer, origin) });
    }
    // The 12-month plan (plans.ts): chosen here, never on Stripe's page.
    if (read.body.do === "commit" || read.body.do === "cancel") {
      if (!plan?.stripeSubscription) return Response.json({ ok: false, message: "There's no plan to change yet." }, { status: 404 });
      if (read.body.do === "commit") {
        const done = await commitToTwelveMonths(stripe, plan.stripeSubscription);
        if (done === "ended") return Response.json({ ok: false, message: "This plan has ended." }, { status: 409 });
        if (done === "not-monthly")
          return Response.json({ ok: false, message: "A yearly plan can't move to the 12-month plan." }, { status: 409 });
      } else {
        // The fee is worked out again here, never taken from the browser; the page has already shown it.
        const charged = await cancelPlan(stripe, plan.stripeSubscription, todayInMarket());
        await updateSubscription(subscriptionFacts(await stripe.subscriptions.retrieve(plan.stripeSubscription)));
        return Response.json({ ok: true, chargedCents: charged.chargedCents });
      }
      await updateSubscription(subscriptionFacts(await stripe.subscriptions.retrieve(plan.stripeSubscription)));
      return Response.json({ ok: true });
    }
    if (read.body.do === "sol") {
      const pack = cleanSolPack(read.body.credits);
      if (!pack) return Response.json({ ok: false }, { status: 400 });
      return Response.json({ ok: true, url: await createSolCheckout(stripe, { businessId, email, pack, customer, origin }) });
    }
    const pack = cleanPack(read.body.pack);
    if (read.body.do !== "tokens" || !pack) return Response.json({ ok: false }, { status: 400 });
    // With no plan, packs go on a Stripe customer of the business's own, so its invoices can be listed.
    const buyer = customer ?? (await ensureBillingCustomer(stripe, { businessId, email, name: who.member.businessName }));
    return Response.json({ ok: true, url: await createTokenCheckout(stripe, { businessId, email, pack, customer: buyer, origin }) });
  });
}
