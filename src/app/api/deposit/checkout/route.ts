import { parseReference } from "@/lib/domain/deposit";
import { createDepositCheckout, stripeClient } from "@/lib/server/stripe";

/** POST { reference, email? } → { url } of a Stripe Checkout page for the deposit. */
export async function POST(request: Request) {
  let body: { reference?: string; email?: string };
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
    const url = await createDepositCheckout(stripe, { reference, email, origin: new URL(request.url).origin });
    return Response.json({ ok: true, url });
  } catch (e) {
    console.error("deposit checkout failed", reference, e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "We couldn't open the payment page just now. Please try again." }, { status: 502 });
  }
}
