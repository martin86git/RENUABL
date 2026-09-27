import type { DayAvailability, ISODate, TimeWindow } from "./types";

export const INSTALL_WINDOWS: TimeWindow[] = [
  { id: "early", label: "7 – 9am", detail: "Early start" },
  { id: "morning", label: "9 – 11am", detail: "Morning" },
  { id: "midday", label: "11am – 1pm", detail: "Midday" },
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
function hash(input: string): number {
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
    const h = hash(`${installerId}:${iso}`);
    const windows = INSTALL_WINDOWS.filter((_, idx) => ((h >> idx) & 3) !== 0).map((w) => w.id);
    if (date.getDay() === 6 && windows.length > 1) windows.splice(1);
    if (windows.length > 0 && h % 7 !== 0) out.push({ date: iso, windows });
  }
  return out;
}

export function getWindow(id: string): TimeWindow | undefined {
  return INSTALL_WINDOWS.find((w) => w.id === id);
}

/** 15-minute confirmation call slots over the next few business days. */
export function buildCallSlots(from: Date, days = 3): { date: ISODate; times: string[] }[] {
  const out: { date: ISODate; times: string[] }[] = [];
  let cursor = addDays(from, 1);
  while (out.length < days) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
      const iso = toISODate(cursor);
      const h = hash(`call:${iso}`);
      const times = ["9:00", "9:30", "10:15", "11:00", "12:30", "2:00", "3:15", "4:30", "5:45"].filter(
        (_, i) => ((h >> i) & 1) === 1 || i % 3 === 0,
      );
      out.push({ date: iso, times });
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}
