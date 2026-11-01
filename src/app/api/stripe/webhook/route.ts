import type Stripe from "stripe";
import { addNote, contactIdByEmail, reservationNote, hubspotToken } from "@/lib/server/hubspot-crm";
import { creditPack, recordSubscription, updateSubscription } from "@/lib/server/design-billing-repo";
import { stripeClient, subscriptionFacts } from "@/lib/server/stripe";

/**
 * Stripe → RENUABL. On a paid deposit, notes it on the customer's HubSpot
 * contact. For RENUABL's own plans for solar businesses: a sign-up's
 * subscription is kept (and attached to its business), a bought pack of design
 * tokens is credited once, and a subscription's changes (trial ending, seats,
 * cancelling) are followed. Configure in Stripe: Developers → Webhooks →
 * endpoint https://<site>/api/stripe/webhook, events checkout.session.completed,
 * customer.subscription.updated and customer.subscription.deleted.
 */
export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return new Response("Not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

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
