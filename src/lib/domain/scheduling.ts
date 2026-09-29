import type { DayAvailability, ISODate, TimeWindow } from "./types";

/**
 * Installs are booked by the day. Customers don't choose a time: installers
 * arrive within one fixed window, which we tell them.
 */
export const INSTALL_ARRIVAL: TimeWindow = { id: "0700", label: "7am–9am", detail: "Estimated arrival" };
export const INSTALL_WINDOWS: TimeWindow[] = [INSTALL_ARRIVAL];

export const LEAD_TIME_DAYS = 7;

/**
 * New systems in Victoria may use the Solar Victoria rebate: the customer
 * applies, then approval takes about 7–10 business days, so the first install
 * day is this far out. PLACEHOLDER: confirm with Primero.
 */
export const SOLAR_VIC_LEAD_DAYS = 21;

/** Shown with a chosen date when Solar Victoria may apply. */
export const SOLAR_VIC_DATE_NOTE = "This date will be subject to your Solar Victoria application being approved.";

/** Days before the first install day: longer where Solar Victoria approval may be needed (new systems in Victoria). */
export function installLeadDays(o: { state: string | null | undefined; expandingExistingSolar: boolean }) {
  return o.state?.toUpperCase() === "VIC" && !o.expandingExistingSolar ? SOLAR_VIC_LEAD_DAYS : LEAD_TIME_DAYS;
}

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
export function buildAvailability(installerId: string, from: Date, days = 56, leadDays = LEAD_TIME_DAYS): DayAvailability[] {
  const start = addDays(from, leadDays);
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
