import type { DayAvailability, ISODate, TimeWindow } from "./types";

/**
 * Installs are booked by the day. Customers don't choose a time: installers
 * arrive within one fixed window, which we tell them.
 */
export const INSTALL_ARRIVAL: TimeWindow = { id: "0700", label: "7am–9am", detail: "Estimated arrival" };
export const INSTALL_WINDOWS: TimeWindow[] = [INSTALL_ARRIVAL];

export const LEAD_TIME_DAYS = 7;

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Small deterministic hash so mock availability is stable across renders. */
export function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Generates installer availability: the days an installer can take a job.
 * Sundays are closed; other days are open on a stable, installer-specific pattern.
 */
export function buildAvailability(installerId: string, from: Date, days = 56): DayAvailability[] {
  const start = addDays(from, LEAD_TIME_DAYS);
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    if (date.getDay() === 0) continue;
    const iso = toISODate(date);
    const h = stableHash(`${installerId}:${iso}`);
    if ((h & 3) !== 0 && h % 7 !== 0) out.push({ date: iso, windows: [INSTALL_ARRIVAL.id] });
  }
  return out;
}

export function getWindow(id: string): TimeWindow | undefined {
  return INSTALL_WINDOWS.find((w) => w.id === id);
}
