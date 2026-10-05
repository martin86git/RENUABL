/**
 * Server only. Emails every new lead to RENUABL staff (LEAD_ALERT_EMAILS,
 * else martin@renuabl.com.au). Never throws: a lead is never lost or blocked
 * because the alert didn't send.
 */
import { leadAlertRecipients, newLeadEmail } from "@/lib/domain/emails";
import { sendEmail } from "./email";

/** Resolves to true when at least one staff member was emailed. */
export async function alertNewLead(
  lead: Parameters<typeof newLeadEmail>[0],
  /** e.g. the call's calendar invite, so staff can add it in one tap. */
  attachments?: { filename: string; content: string; contentType?: string }[],
): Promise<boolean> {
  const mail = { ...newLeadEmail(lead), ...(attachments?.length ? { attachments } : {}) };
  let sent = false;
  for (const to of leadAlertRecipients(process.env.LEAD_ALERT_EMAILS)) {
    try {
      if ((await sendEmail({ to, ...mail })) === "sent") sent = true;
    } catch (e) {
      console.error(`lead alert to ${to} failed`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
