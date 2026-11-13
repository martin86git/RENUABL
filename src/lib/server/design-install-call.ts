/**
 * Server only. What the admin assistant's booking call needs from the business (domain/install-call.ts): the days it
 * may offer, read fresh from the install calendar, and the tentative install it pencils in when the customer picks one.
 * Business id first, as everywhere. Nothing here sets a deal's install date: the team does that.
 */
import { installDaysToOffer, pencilledNote, type InstallDay } from "@/lib/domain/install-call";
import { todayInMarket } from "@/lib/domain/market";
import { query } from "./db";
import { loadPrefs } from "./design-after-sale-repo";
import { addEntry } from "./design-calendar-entries-repo";

/** The days the assistant may offer now: working days with room in the week, none already booked or pencilled in. */
export async function installDaysFor(businessId: string): Promise<InstallDay[]> {
  const today = todayInMarket();
  const [booked, pencilled, prefs] = await Promise.all([
    query<{ day: string }>(
      `select to_char(install_date, 'YYYY-MM-DD') as day from design_jobs
        where business_id = $1 and install_date >= $2 and stage <> 'lost'`,
      [businessId, today],
    ),
    query<{ day: string }>(
      `select to_char(day_from, 'YYYY-MM-DD') as day from design_calendar_entries
        where business_id = $1 and kind = 'tentative' and day_from >= $2`,
      [businessId, today],
    ),
    loadPrefs(businessId),
  ]);
  return installDaysToOffer(today, { taken: [...booked, ...pencilled].map((r) => r.day), capacity: prefs.weeklyCapacity });
}

/**
 * Pencils the installation in on the calendar as a tentative install for the deal, replacing one the assistant
 * pencilled in for it before (a customer who rings back to change the day doesn't leave two).
 */
export async function pencilInstall(o: { businessId: string; jobId: string; day: InstallDay; assistant: string }): Promise<void> {
  const by = o.assistant.toLowerCase();
  await query(
    `delete from design_calendar_entries
      where business_id = $1 and job_id = $2 and kind = 'tentative' and by_email = $3 and day_from >= $4`,
    [o.businessId, o.jobId, by, todayInMarket()],
  );
  await addEntry(o.businessId, by, {
    kind: "tentative",
    from: o.day.date,
    to: o.day.date,
    title: "",
    note: pencilledNote(o.assistant),
    who: "",
    jobId: o.jobId,
  });
}
