/** Server only. The signed-in customer's own reservations, for My RENUABL. */
import type { JobStatus } from "@/lib/domain/jobs";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured, query } from "@/lib/server/db";
import { jobsForCustomer } from "@/lib/server/jobs-repo";
import { roofData } from "@/lib/server/google-solar";
import { autoLayout, type RoofModel } from "@/lib/domain/roof-layout";
import { dailyForecast } from "@/lib/server/google-weather";
import { daysUntil } from "@/lib/domain/compliance";
import { todayInMarket } from "@/lib/domain/market";
import { FORECAST_DAYS, customerOutlookLine, forecastFor, solarDayOutlook } from "@/lib/domain/weather";

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

/**
 * For a signed-in customer whose system is installed: tomorrow's solar day at
 * their home (Google Weather). Null otherwise.
 */
export async function getTomorrowSolar() {
  if (!dbConfigured()) return null;
  const session = await currentSession();
  if (session?.role !== "customer") return null;
  const installed = (await jobsForCustomer(session.email)).find(
    (j) => j.status === "completed" && typeof j.address.lat === "number" && typeof j.address.lng === "number",
  );
  if (!installed) return null;
  const tomorrow = new Date(`${todayInMarket()}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const f = forecastFor(await dailyForecast(installed.address.lat!, installed.address.lng!), tomorrow.toISOString().slice(0, 10));
  if (!f) return null;
  return {
    ...solarDayOutlook(f, { battery: installed.system.batteryKwh > 0, ev: installed.system.evCharger }),
    maxC: f.maxC,
  };
}

/**
 * The signed-in customer's panel layout for one of their homes: the partner's
 * saved layout, or the first auto-layout. Null if it isn't theirs or there's
 * no roof model.
 */
export async function getMyLayout(recordKey: string): Promise<{
  model: RoofModel;
  centre: { lat: number; lng: number };
  selected: number[];
  confirmed: boolean;
  reference: string;
  panelCount: number;
} | null> {
  if (!dbConfigured() || !/^[a-z0-9]{16,64}$/.test(recordKey)) return null;
  const session = await currentSession();
  if (session?.role !== "customer") return null;
  const job = (await jobsForCustomer(session.email)).find((j) => j.recordKey === recordKey);
  const { lat, lng } = job?.address ?? {};
  if (!job || typeof lat !== "number" || typeof lng !== "number") return null;
  const model = (await roofData(lat, lng))?.model;
  if (!model) return null;
  return {
    model,
    centre: { lat, lng },
    selected: job.layout?.slots ?? autoLayout(model, job.system.panelCount),
    confirmed: Boolean(job.layout),
    reference: job.reference,
    panelCount: job.system.panelCount,
  };
}
