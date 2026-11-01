import type Stripe from "stripe";
import { addNote, contactIdByEmail, reservationNote, hubspotToken } from "@/lib/server/hubspot-crm";
import { todayInMarket } from "@/lib/domain/market";
import { creditPack, creditSolPack, recordSubscription, updateSubscription } from "@/lib/server/design-billing-repo";
import { stripeClient, subscriptionFacts } from "@/lib/server/stripe";
import { connectFacts } from "@/lib/server/stripe-billing";
import { businessOfAccount, updateConnect } from "@/lib/server/design-connect-repo";
import { recordCardPayment } from "@/lib/server/design-proposal-repo";
import { isDueKey, platformFeeCents } from "@/lib/domain/design/proposal-payments";

/**
 * Stripe → RENUABL. On a paid deposit, notes it on the customer's HubSpot
 * contact. For RENUABL's own plans for solar businesses: a sign-up's
 * subscription is kept (and attached to its business), a bought pack of design
 * tokens is credited once, and a subscription's changes (trial ending, seats,
 * cancelling) are followed. Configure in Stripe: Developers → Webhooks →
 * endpoint https://<site>/api/stripe/webhook, events checkout.session.completed,
 * customer.subscription.updated and customer.subscription.deleted.
 *
 * Businesses' own Stripe accounts (Stripe Connect, card payments on their proposals): a second endpoint at the same
 * address listening to events on connected accounts, with its own signing secret in STRIPE_CONNECT_WEBHOOK_SECRET:
 * events checkout.session.completed and account.updated. A paid amount is kept against its proposal (checked against
 * what the proposal asks), and an account's readiness to take cards is followed.
 */
export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return new Response("Not configured", { status: 400 });

  // Our own account's events are signed with one secret, the connected accounts' with another.
  const body = await request.text();
  const secrets = [secret, process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim()].filter((x): x is string => Boolean(x));
  let event: Stripe.Event | null = null;
  for (const s of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, s);
      break;
    } catch {
      // Try the next secret.
    }
  }
  if (!event) return new Response("Invalid signature", { status: 400 });

  if (event.account) return connectedEvent(event);

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    if (sub.metadata?.kind === "design-plan") {
      try {
        await updateSubscription(subscriptionFacts(sub));
      } catch (e) {
        console.error("plan update failed", sub.id, e instanceof Error ? e.message : e);
        return new Response("Not saved", { status: 500 });
      }
    }
    return Response.json({ received: true });
  }

  if (event.type === "checkout.session.completed" && event.data.object.metadata?.kind === "design-plan") {
    const session = event.data.object;
    const email = session.customer_details?.email ?? session.metadata?.email;
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!email || !subId) return Response.json({ received: true });
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      await recordSubscription({ ...subscriptionFacts(sub), email, checkoutSession: session.id });
    } catch (e) {
      console.error("plan sign-up not saved", session.id, e instanceof Error ? e.message : e);
      return new Response("Not saved", { status: 500 });
    }
    return Response.json({ received: true });
  }

  if (event.type === "checkout.session.completed" && event.data.object.metadata?.kind === "design-tokens") {
    const session = event.data.object;
    const business = session.metadata?.business;
    const tokens = Number(session.metadata?.tokens);
    if (business && Number.isInteger(tokens) && tokens > 0 && session.payment_status === "paid") {
      try {
        await creditPack(business, session.id, tokens, session.metadata?.email ?? null);
      } catch (e) {
        console.error("token pack not credited", session.id, e instanceof Error ? e.message : e);
        return new Response("Not saved", { status: 500 });
      }
    }
    return Response.json({ received: true });
  }

  if (event.type === "checkout.session.completed" && event.data.object.metadata?.kind === "sol-credits") {
    const session = event.data.object;
    const business = session.metadata?.business;
    const credits = Number(session.metadata?.credits);
    if (business && Number.isInteger(credits) && credits > 0 && session.payment_status === "paid") {
      try {
        await creditSolPack(business, session.id, credits, session.metadata?.email ?? null, todayInMarket());
      } catch (e) {
        console.error("sol credits not added", session.id, e instanceof Error ? e.message : e);
        return new Response("Not saved", { status: 500 });
      }
    }
    return Response.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const reference = session.metadata?.reference ?? session.client_reference_id ?? "unknown";
    const email = session.customer_details?.email;
    const amount = (session.amount_total ?? 0) / 100;
    console.log(`deposit paid ${reference} $${amount} ${session.payment_status}`);
    const token = hubspotToken();
    if (token && email && session.payment_status === "paid") {
      try {
        const contactId = await contactIdByEmail(email, token);
        await addNote(
          contactId,
          reservationNote(reference, {
            "Deposit paid": `$${amount.toFixed(2)} via Stripe`,
            "Stripe payment": String(session.payment_intent ?? session.id),
          }),
          token,
        );
      } catch (e) {
        // Stripe retries on a non-2xx; the payment itself is safe in Stripe either way.
        console.error("deposit note to HubSpot failed", reference, e instanceof Error ? e.message : e);
        return new Response("CRM update failed", { status: 500 });
      }
    }
  }
  return Response.json({ received: true });
}

/** An event on a business's own Stripe account. Only what we made is acted on; anything else is acknowledged and left. */
async function connectedEvent(event: Stripe.Event): Promise<Response> {
  const account = event.account!;
  try {
    if (event.type === "account.updated") {
      await updateConnect(account, connectFacts(event.data.object));
      return Response.json({ received: true });
    }
    if (event.type === "checkout.session.completed" && event.data.object.metadata?.kind === "proposal-payment") {
      const session = event.data.object;
      const meta = session.metadata ?? {};
      const businessId = await businessOfAccount(account);
      // The account must be the business's the payment names: one business can't record a payment on another's proposal.
      if (session.payment_status !== "paid" || !businessId || businessId !== meta.business || !meta.version || !isDueKey(meta.due))
        return Response.json({ received: true });
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      const result = await recordCardPayment({
        businessId,
        versionId: meta.version,
        dueKey: meta.due,
        amountCents: session.amount_total ?? 0,
        feeCents: platformFeeCents(session.amount_total ?? 0),
        account,
        session: session.id,
        payment: intent,
      });
      if (result === "unknown") console.error("card payment didn't match its proposal", session.id);
    }
  } catch (e) {
    console.error("connected account event not saved", event.id, e instanceof Error ? e.message : e);
    return new Response("Not saved", { status: 500 });
  }
  return Response.json({ received: true });
}
