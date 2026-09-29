/**
 * Server only. Emails every new lead to RENUABL staff (LEAD_ALERT_EMAILS,
 * else martin@renuabl.com.au). Never throws: a lead is never lost or blocked
 * because the alert didn't send.
 */
import { leadAlertRecipients, newLeadEmail } from "@/lib/domain/emails";
import { sendEmail } from "./email";

export async function alertNewLead(lead: Parameters<typeof newLeadEmail>[0]): Promise<void> {
  const mail = newLeadEmail(lead);
  for (const to of leadAlertRecipients(process.env.LEAD_ALERT_EMAILS)) {
    try {
      await sendEmail({ to, ...mail });
    } catch (e) {
      console.error(`lead alert to ${to} failed`, e instanceof Error ? e.message : e);
    }
  }
}
