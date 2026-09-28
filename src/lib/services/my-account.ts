/** Server only. The signed-in customer's own reservations, for My RENUABL. */
import type { JobStatus } from "@/lib/domain/jobs";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured, query } from "@/lib/server/db";
import { jobsForCustomer } from "@/lib/server/jobs-repo";
import { dailyForecast } from "@/lib/server/google-weather";
import { daysUntil } from "@/lib/domain/compliance";
import { todayInMarket } from "@/lib/domain/market";
import { FORECAST_DAYS, customerOutlookLine, forecastFor } from "@/lib/domain/weather";

/** What the customer sees for each stage (they're "installation partners", never "installers"). */
export const CUSTOMER_STATUS: Record<JobStatus, string> = {
  unassigned: "Matching your installation partner",
  offered: "Matching your installation partner",
  accepted: "Your installation partner has accepted your job",
  scheduled: "Your installation date is confirmed",
  "in-progress": "Installation under way",
  completed: "Installed",
  cancelled: "Cancelled",
};

export async function getMyReservations() {
  if (!dbConfigured()) return null;
  const session = await currentSession();
  if (session?.role !== "customer") return null;
  const jobs = await jobsForCustomer(session.email);
  const partnerIds = [...new Set(jobs.map((j) => j.partnerId).filter((id): id is string => Boolean(id)))];
  const names = partnerIds.length
    ? new Map(
        (await query<{ id: string; business_name: string }>(`select id, business_name from partners where id = any($1)`, [partnerIds])).map(
          (r) => [r.id, r.business_name],
        ),
      )
    : new Map<string, string>();
  const today = todayInMarket();
  /** Once the install is within ten days and still to come: the day's forecast, in plain words. */
  const forecastLine = async (j: (typeof jobs)[number]) => {
    const { lat, lng } = j.address;
    if (!j.installDate || typeof lat !== "number" || typeof lng !== "number" || j.status === "completed" || j.status === "cancelled")
      return null;
    const away = daysUntil(j.installDate, today);
    if (away < 0 || away >= FORECAST_DAYS) return null;
    const f = forecastFor(await dailyForecast(lat, lng), j.installDate);
    return f ? customerOutlookLine(f) : null;
  };
  const forecasts = await Promise.all(jobs.map(forecastLine));
  return {
    email: session.email,
    reservations: jobs.map((j, i) => ({
      forecast: forecasts[i],
      reference: j.reference,
      packageName: j.packageName,
      installDate: j.installDate,
      status: CUSTOMER_STATUS[j.status],
      partner: j.partnerId ? (names.get(j.partnerId) ?? null) : null,
      recordKey: j.recordKey,
    })),
  };
}
