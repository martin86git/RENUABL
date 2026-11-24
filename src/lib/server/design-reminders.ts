/**
 * Server only. The installation reminder a business's customers can be sent
 * (Settings → Automations; off until the business turns it on): from the
 * daily cron, each due reminder is marked sent first (so it never goes
 * twice), then emailed from RENUABL's sender in the business's name, with a
 * reply going to the business when its brand kit has an address. Without an
 * email service nothing is marked or sent.
 */
import { installReminderEmail } from "@/lib/domain/design/schedule";
import { todayInMarket } from "@/lib/domain/market";
import { claimReminder, loadPrefs, remindersDue } from "./design-after-sale-repo";
import { sendFromGmail } from "./gmail";
import { loadBrand } from "./design-proposal-repo";
import { emailProvider, sendEmail } from "./email";

export async function sendInstallReminders(now = new Date()): Promise<number> {
  let sent = 0;
  for (const r of await remindersDue(todayInMarket(now))) {
    try {
      const from = (await loadPrefs(r.businessId)).reminderFrom;
      if (!from && !emailProvider()) continue;
      if (!(await claimReminder(r))) continue;
      const brand = await loadBrand(r.businessId, r.businessName);
      const business = brand.name || r.businessName;
      const email = installReminderEmail({ business, firstName: r.firstName, date: r.date, contact: brand.phone || brand.email || null });
      if (from) {
        try {
          await sendFromGmail({ businessId: r.businessId, email: from.owner }, from.address, {
            to: [r.email],
            cc: [],
            subject: email.subject,
            body: email.body,
            size: "normal",
          });
          sent++;
          continue;
        } catch {
          // The mailbox couldn't send (disconnected, or refused): RENUABL's sender takes it, as before.
          console.error("an installation reminder couldn't go from the business's mailbox");
          if (!emailProvider()) continue;
        }
      }
      await sendEmail({
        to: r.email,
        fromName: business,
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(brand.email ? { replyTo: brand.email } : {}),
      });
      sent++;
    } catch {
      // Only that it failed is logged: never the address or what was sent.
      console.error("an installation reminder couldn't be sent");
    }
  }
  return sent;
}
