import { addDays, stableHash, toISODate } from "./scheduling";
import type { DayAvailability, TimeWindow } from "./types";

/**
 * Post-purchase service visits. Customers book their installer directly
 * from My RENUABL. No call-out fee is quoted here: warranty work is free and
 * any other fee is confirmed with the customer before the visit is locked in.
 */

export type ServiceReasonId = "not-producing" | "battery" | "inverter-error" | "app-offline" | "health-check" | "other";

export const SERVICE_REASONS: { id: ServiceReasonId; label: string; hint: string }[] = [
  { id: "not-producing", label: "Not producing as expected", hint: "Lower generation than usual" },
  { id: "battery", label: "Battery issue", hint: "Not charging or not backing up" },
  { id: "inverter-error", label: "Inverter error or alarm", hint: "A light, code or beeping" },
  { id: "app-offline", label: "App shows no data", hint: "Monitoring has stopped updating" },
  { id: "health-check", label: "Annual health check", hint: "Inspection, clean and tune-up" },
  { id: "other", label: "Something else", hint: "Tell us what's happening" },
];

export const SERVICE_WINDOWS: TimeWindow[] = [
  { id: "am", label: "Morning", detail: "8am – 12pm" },
  { id: "pm", label: "Afternoon", detail: "12pm – 4pm" },
];

/** Service visits can be booked from two days out, weekdays only. */
export const SERVICE_LEAD_DAYS = 2;

export function buildServiceAvailability(installerId: string, from: Date, days = 28): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, SERVICE_LEAD_DAYS + i);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const iso = toISODate(date);
    const h = stableHash(`service:${installerId}:${iso}`);
    const windows = SERVICE_WINDOWS.filter((_, idx) => ((h >> (idx * 3)) & 3) !== 0).map((w) => w.id);
    if (windows.length) out.push({ date: iso, windows });
  }
  return out;
}

/** Only faults that could be covered by warranty; an annual check is routine maintenance. */
export function mayBeWarranty(reason: ServiceReasonId): boolean {
  return reason !== "health-check";
}
