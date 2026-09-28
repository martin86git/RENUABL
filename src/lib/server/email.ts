/**
 * Server only. Sends customer emails through Twilio SendGrid (SENDGRID_API_KEY)
 * or, without it, Resend (RESEND_API_KEY). Both need EMAIL_FROM, e.g.
 * "RENUABL <hello@renuabl.com.au>", on a domain verified with that service.
 * Without a service, emails are skipped and logged.
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}

/** "RENUABL <hello@renuabl.com.au>" → name and address. */
export function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { email: m[2].trim(), ...(m[1] ? { name: m[1].replace(/^"|"$/g, "") } : {}) } : { email: from.trim() };
}

export function emailProvider(): "sendgrid" | "resend" | null {
  if (!process.env.EMAIL_FROM?.trim()) return null;
  if (process.env.SENDGRID_API_KEY?.trim()) return "sendgrid";
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  return null;
}

async function viaSendGrid(email: Email, key: string, from: string) {
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: email.to }] }],
      from: parseFrom(from),
      ...(replyTo ? { reply_to: parseFrom(replyTo) } : {}),
      subject: email.subject,
      content: [
        { type: "text/plain", value: email.text },
        { type: "text/html", value: email.html },
      ],
      ...(email.attachments?.length
        ? {
            attachments: email.attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.content).toString("base64"),
              type: a.contentType ?? "application/octet-stream",
              disposition: "attachment",
            })),
          }
        : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function viaResend(email: Email, key: string, from: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email.to],
      reply_to: process.env.EMAIL_REPLY_TO?.trim() || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
        content_type: a.contentType,
      })),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function sendEmail(email: Email): Promise<"sent" | "skipped"> {
  const provider = emailProvider();
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  if (!provider) {
    console.warn(`email skipped (email not configured): "${email.subject}"`);
    return "skipped";
  }
  if (provider === "sendgrid") await viaSendGrid(email, process.env.SENDGRID_API_KEY!.trim(), from);
  else await viaResend(email, process.env.RESEND_API_KEY!.trim(), from);
  return "sent";
}
