/**
 * Server only. A plain note to RENUABL staff (LEAD_ALERT_EMAILS, else Martin) about someone on the sign-up page: an
 * Enterprise enquiry or marketplace interest. Never throws: what they asked is kept whether or not the email goes.
 */
import { leadAlertRecipients } from "@/lib/domain/emails";
import { sendEmail } from "./email";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function tellStaff(mail: { subject: string; text: string }): Promise<boolean> {
  let sent = false;
  for (const to of leadAlertRecipients(process.env.LEAD_ALERT_EMAILS || process.env.ALERT_EMAILS)) {
    try {
      const html = `<p style="font-family:sans-serif;white-space:pre-wrap">${escape(mail.text)}</p>`;
      if ((await sendEmail({ to, subject: mail.subject, text: mail.text, html })) === "sent") sent = true;
    } catch (e) {
      console.error("staff note failed", e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
