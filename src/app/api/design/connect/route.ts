import { connectWords } from "@/lib/domain/design/proposal-payments";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import {
  connectOf,
  feesByMonth,
  replaceConnectAccount,
  saveConnectAccount,
  setCardsOn,
  updateConnect,
} from "@/lib/server/design-connect-repo";
import { stripeClient } from "@/lib/server/stripe";
import { connectFacts, connectSession, createConnectAccount, runByRenuabl } from "@/lib/server/stripe-billing";

/**
 * Card payments on proposals (Stripe Connect, the business's own account run by RENUABL's platform). The owner only.
 * GET: where the business's account stands (asked of Stripe afresh, so the page shows it as Stripe has it), whether it
 * is one RENUABL runs or an older standard account, and RENUABL's fees on its payments by month.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { businessId } = who.member;
    const stripe = stripeClient();
    let state = await connectOf(businessId);
    let older = false;
    if (stripe && state.account) {
      const account = await stripe.accounts.retrieve(state.account).catch(() => null);
      if (account) {
        older = !runByRenuabl(account);
        await updateConnect(state.account, connectFacts(account));
        state = await connectOf(businessId);
      }
    }
    return Response.json({
      ok: true,
      connected: state.connected && !older,
      older,
      chargesEnabled: state.chargesEnabled && !older,
      detailsSubmitted: state.detailsSubmitted && !older,
      cardsOn: state.cardsOn,
      words: connectWords(older ? { connected: false, chargesEnabled: false, detailsSubmitted: false } : state),
      fees: await feesByMonth(businessId),
      available: Boolean(stripe && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()),
    });
  });
}

/**
 * POST { do: "start" }: opens the business's account (or one RENUABL runs in place of an older standard account).
 * { do: "session" }: a short-lived key for Stripe's forms shown in Settings. { do: "cards", on }: card payments on proposals.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1000);
    if ("refuse" in read) return read.refuse;
    const { businessId, businessName, email } = who.member;
    if (read.body.do === "cards") {
      const done = await setCardsOn(businessId, read.body.on === true);
      return done ? Response.json({ ok: true }) : Response.json({ ok: false, message: "Set up card payments first." }, { status: 409 });
    }
    if (read.body.do !== "start" && read.body.do !== "session") return Response.json({ ok: false }, { status: 400 });
    const stripe = stripeClient();
    if (!stripe) return Response.json({ ok: false, message: "Card payments aren't set up on RENUABL yet." }, { status: 503 });

    let { account } = await connectOf(businessId);
    const current = account ? await stripe.accounts.retrieve(account).catch(() => null) : null;
    const usable = current && runByRenuabl(current);
    if (!usable) {
      if (read.body.do === "session") return Response.json({ ok: false, message: "Set up card payments first." }, { status: 409 });
      const made = await createConnectAccount(stripe, { businessId, email, name: businessName });
      if (account) await replaceConnectAccount(businessId, made, email);
      else {
        await saveConnectAccount(businessId, made, email);
        // Two presses at once make two accounts; only the first is kept, and the second is used no further.
      }
      account = (await connectOf(businessId)).account ?? made;
    }
    if (read.body.do === "start") return Response.json({ ok: true });
    return Response.json({ ok: true, clientSecret: await connectSession(stripe, account!) });
  });
}
