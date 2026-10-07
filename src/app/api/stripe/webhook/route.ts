import type Stripe from "stripe";
import { addNote, contactIdByEmail, reservationNote, hubspotToken } from "@/lib/server/hubspot-crm";
import { stripeClient } from "@/lib/server/stripe";

/**
 * Stripe → RENUABL. On a paid deposit, notes it on the customer's HubSpot
 * contact. Configure in Stripe: Developers → Webhooks → endpoint
 * https://<site>/api/stripe/webhook, event checkout.session.completed.
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
