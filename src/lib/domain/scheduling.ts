import type { DayAvailability, ISODate, TimeWindow } from "./types";

/** Installer arrival times the customer can choose from. */
export const INSTALL_WINDOWS: TimeWindow[] = [
  { id: "0700", label: "7:00 am", detail: "Early start" },
  { id: "0900", label: "9:00 am", detail: "Morning" },
  { id: "1100", label: "11:00 am", detail: "Late morning" },
  { id: "1300", label: "1:00 pm", detail: "Afternoon" },
  { id: "1500", label: "3:00 pm", detail: "Afternoon" },
];

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
 * Generates installer availability. Sundays are closed; other days have
 * a stable, installer-specific subset of windows open.
 */
export function buildAvailability(installerId: string, from: Date, days = 56): DayAvailability[] {
  const start = addDays(from, LEAD_TIME_DAYS);
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    if (date.getDay() === 0) continue;
    const iso = toISODate(date);
    const h = stableHash(`${installerId}:${iso}`);
    const windows = INSTALL_WINDOWS.filter((_, idx) => ((h >> (idx * 2)) & 3) !== 0).map((w) => w.id);
    if (date.getDay() === 6 && windows.length > 2) windows.splice(2);
    if (windows.length > 0 && h % 7 !== 0) out.push({ date: iso, windows });
  }
  return out;
}

export function getWindow(id: string): TimeWindow | undefined {
  return INSTALL_WINDOWS.find((w) => w.id === id);
}
