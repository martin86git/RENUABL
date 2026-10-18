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
import { claimReminder, remindersDue } from "./design-after-sale-repo";
import { loadBrand } from "./design-proposal-repo";
import { emailProvider, sendEmail } from "./email";

export async function sendInstallReminders(now = new Date()): Promise<number> {
  if (!emailProvider()) return 0;
  let sent = 0;
  for (const r of await remindersDue(todayInMarket(now))) {
    try {
      if (!(await claimReminder(r))) continue;
      const brand = await loadBrand(r.businessId, r.businessName);
      const business = brand.name || r.businessName;
      const email = installReminderEmail({ business, firstName: r.firstName, date: r.date, contact: brand.phone || brand.email || null });
      await sendEmail({ to: r.email, ...email, ...(brand.email ? { replyTo: brand.email } : {}) });
      sent++;
    } catch {
      // Only that it failed is logged: never the address or what was sent.
      console.error("an installation reminder couldn't be sent");
    }
  }
  return sent;
}
