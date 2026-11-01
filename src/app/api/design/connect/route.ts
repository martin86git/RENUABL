import { connectWords } from "@/lib/domain/design/proposal-payments";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { connectOf, feesByMonth, saveConnectAccount, setCardsOn, updateConnect } from "@/lib/server/design-connect-repo";
import { stripeClient } from "@/lib/server/stripe";
import { connectFacts, connectOnboardingUrl, createConnectAccount } from "@/lib/server/stripe-billing";

/**
 * Card payments on proposals (Stripe Connect). The owner only. GET: whether the business's own Stripe account is
 * connected and can take cards (asked of Stripe afresh, so coming back from Stripe's pages shows where it stands), and
 * RENUABL's fees on its payments by month.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { businessId } = who.member;
    const stripe = stripeClient();
    let state = await connectOf(businessId);
    if (stripe && state.account) {
      const account = await stripe.accounts.retrieve(state.account).catch(() => null);
      if (account) {
        await updateConnect(state.account, connectFacts(account));
        state = await connectOf(businessId);
      }
    }
    return Response.json({
      ok: true,
      connected: state.connected,
      chargesEnabled: state.chargesEnabled,
      detailsSubmitted: state.detailsSubmitted,
      cardsOn: state.cardsOn,
      words: connectWords(state),
      fees: await feesByMonth(businessId),
      available: Boolean(stripe),
    });
  });
}

/** POST { do: "connect" } → Stripe's pages to open (or finish) the business's account; { do: "cards", on } switches card payments on proposals. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1000);
    if ("refuse" in read) return read.refuse;
    const { businessId, businessName, email } = who.member;
    if (read.body.do === "cards") {
      const done = await setCardsOn(businessId, read.body.on === true);
      return done ? Response.json({ ok: true }) : Response.json({ ok: false, message: "Connect Stripe first." }, { status: 409 });
    }
    if (read.body.do !== "connect") return Response.json({ ok: false }, { status: 400 });
    const stripe = stripeClient();
    if (!stripe) return Response.json({ ok: false, message: "Payments aren't set up yet." }, { status: 503 });
    let { account } = await connectOf(businessId);
    if (!account) {
      account = await createConnectAccount(stripe, { businessId, email, name: businessName });
      await saveConnectAccount(businessId, account, email);
      // Two presses at once make two accounts; only the first is kept, and the second is used no further.
      account = (await connectOf(businessId)).account ?? account;
    }
    return Response.json({ ok: true, url: await connectOnboardingUrl(stripe, account, new URL(request.url).origin) });
  });
}
