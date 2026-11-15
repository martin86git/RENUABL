import { dbConfigured } from "@/lib/server/db";
import { recordDeliveryProblem } from "@/lib/server/marketing-send";
import { resendProblem, sendGridProblems, verifySendGrid, verifySvix, type DeliveryProblem } from "@/lib/server/marketing-webhooks";

/**
 * POST from the email service: bounces and spam complaints on RENUABL's marketing email. SendGrid's signed Event
 * Webhook (SENDGRID_WEBHOOK_PUBLIC_KEY) or Resend's webhook (RESEND_WEBHOOK_SECRET); unsigned or wrongly signed is refused.
 * A bounce marks the address bounced (never emailed again); a complaint unsubscribes it.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return new Response("Not set up", { status: 503 });
  const body = await request.text();
  if (body.length > 2_000_000) return new Response("Too large", { status: 413 });
  const h = request.headers;
  let problems: DeliveryProblem[] = [];
  const sgKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim();
  const rsKey = process.env.RESEND_WEBHOOK_SECRET?.trim();
  try {
    if (h.get("x-twilio-email-event-webhook-signature")) {
      if (
        !sgKey ||
        !verifySendGrid(body, h.get("x-twilio-email-event-webhook-signature"), h.get("x-twilio-email-event-webhook-timestamp"), sgKey)
      )
        return new Response("Unauthorized", { status: 401 });
      problems = sendGridProblems(JSON.parse(body));
    } else if (h.get("svix-signature")) {
      if (
        !rsKey ||
        !verifySvix(body, { id: h.get("svix-id"), timestamp: h.get("svix-timestamp"), signature: h.get("svix-signature") }, rsKey)
      )
        return new Response("Unauthorized", { status: 401 });
      const p = resendProblem(JSON.parse(body));
      problems = p ? [p] : [];
    } else return new Response("Unauthorized", { status: 401 });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  let kept = 0;
  for (const p of problems) if (await recordDeliveryProblem(p.kind, p, p.note).catch(() => false)) kept++;
  return Response.json({ ok: true, kept });
}
