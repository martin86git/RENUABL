/**
 * Server only. One reminder, two days after reserving, for customers who
 * haven't done the Home Health check. Marked as sent only when it went out,
 * so a failed send is tried again the next day.
 */
import { healthReminderEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "./email";
import { dueHealthReminders, markHealthReminded } from "./home-health-repo";

export async function sendHealthReminders(): Promise<number> {
  const site = siteUrl();
  if (!site) return 0;
  let sent = 0;
  for (const r of await dueHealthReminders()) {
    try {
      const mail = healthReminderEmail({ firstName: (r.name ?? "").split(" ")[0], link: `${site}/home-health` });
      if ((await sendEmail({ to: r.email, ...mail })) === "sent") {
        await markHealthReminded(r.reference);
        sent++;
      }
    } catch (e) {
      console.error(`health reminder for ${r.reference} failed`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
