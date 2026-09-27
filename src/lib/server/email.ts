/**
 * Server only. Sends customer emails through Resend (resend.com).
 * RESEND_API_KEY and EMAIL_FROM (e.g. "RENUABL <hello@renuabl.com.au>", on a
 * domain verified in Resend). Without them, emails are skipped and logged.
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}

export async function sendEmail(email: Email): Promise<"sent" | "skipped"> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) {
    console.warn(`email skipped (email not configured): "${email.subject}"`);
    return "skipped";
  }
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
  return "sent";
}
