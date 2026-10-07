import { PREVIEW_MODE } from "@/lib/config";
import { leadAlertRecipients } from "@/lib/domain/emails";
import { emailDiagnostics } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET (preview only): sends a test email through each configured service to
 * RENUABL's own lead inbox (never an address from the request) and shows what
 * each service said, so email setup can be fixed without the server logs.
 */
export async function GET(request: Request) {
  if (!PREVIEW_MODE) return Response.json({ ok: false }, { status: 404 });
  if (!allow(request, "email-test", 5)) return Response.json({ ok: false, message: "Try again in an hour." }, { status: 429 });
  const to = leadAlertRecipients(process.env.LEAD_ALERT_EMAILS || process.env.ALERT_EMAILS)[0];
  const result = await emailDiagnostics({
    to,
    subject: "RENUABL test email",
    text: "This is a test email from renuabl.com.au. If you can read it, email is working.",
    html: "<p>This is a test email from renuabl.com.au. If you can read it, email is working.</p>",
  });
  return Response.json({ sentTo: to, ...result });
}
