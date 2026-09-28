import { parseReference } from "@/lib/domain/deposit";
import { createDepositCheckout, createHostedDepositCheckout, stripeClient } from "@/lib/server/stripe";

/**
 * POST { reference, email?, hosted? } → { client_secret } of a Stripe Checkout Session for the
 * embedded payment form, or with hosted: true, { url } of Stripe's own payment page (the backup).
 */
export async function POST(request: Request) {
  let body: { reference?: string; email?: string; hosted?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 400 });
  }
  const reference = parseReference(body.reference);
  if (!reference)
    return Response.json({ ok: false, message: "That reservation link isn't valid. Please use the link we sent you." }, { status: 400 });

  const stripe = stripeClient();
  if (!stripe) return Response.json({ ok: false, message: "Online payments aren't set up yet. We'll be in touch." }, { status: 503 });

  const email = typeof body.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email.trim()) ? body.email.trim() : null;
  try {
    const opts = { reference, email, origin: new URL(request.url).origin };
    if (body.hosted === true) return Response.json({ ok: true, url: await createHostedDepositCheckout(stripe, opts) });
    return Response.json({ ok: true, client_secret: await createDepositCheckout(stripe, opts) });
  } catch (e) {
    console.error("deposit checkout failed", reference, e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "We couldn't open the payment page just now. Please try again." }, { status: 502 });
  }
}
