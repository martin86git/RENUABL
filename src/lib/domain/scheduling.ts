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

/** Small deterministic hash (stable ids and mock data). */
export function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Victorian public holidays (no installs). From business.vic.gov.au; Grand
 * Final Friday is set each year by the government (VERIFY when announced).
 * Melbourne Cup Day is a metro Melbourne holiday; we keep it closed everywhere.
 * Extend this list each year: no install day is offered after HOLIDAYS_LISTED_UNTIL.
 */
export const VIC_PUBLIC_HOLIDAYS: Record<ISODate, string> = {
  "2026-01-01": "New Year's Day",
  "2026-01-26": "Australia Day",
  "2026-03-09": "Labour Day",
  "2026-04-03": "Good Friday",
  "2026-04-04": "Saturday before Easter Sunday",
  "2026-04-05": "Easter Sunday",
  "2026-04-06": "Easter Monday",
  "2026-04-25": "ANZAC Day",
  "2026-06-08": "King's Birthday",
  "2026-09-25": "Friday before the AFL Grand Final",
  "2026-11-03": "Melbourne Cup Day",
  "2026-12-25": "Christmas Day",
  "2026-12-26": "Boxing Day",
  "2026-12-28": "Boxing Day (additional day)",
  "2027-01-01": "New Year's Day",
  "2027-01-26": "Australia Day",
  "2027-03-08": "Labour Day",
  "2027-03-26": "Good Friday",
  "2027-03-27": "Saturday before Easter Sunday",
  "2027-03-28": "Easter Sunday",
  "2027-03-29": "Easter Monday",
  "2027-04-25": "ANZAC Day",
  "2027-06-14": "King's Birthday",
  "2027-09-24": "Friday before the AFL Grand Final (VERIFY)",
  "2027-11-02": "Melbourne Cup Day",
  "2027-12-25": "Christmas Day",
  "2027-12-26": "Boxing Day",
  "2027-12-27": "Christmas Day (additional day)",
  "2027-12-28": "Boxing Day (additional day)",
};
export const HOLIDAYS_LISTED_UNTIL: ISODate = "2027-12-31";

/** Calendar arithmetic on YYYY-MM-DD strings (no time zones involved). */
export function addDaysISO(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A weekday that isn't a Victorian public holiday (and is within the holiday list). */
export function isInstallDay(iso: ISODate): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !VIC_PUBLIC_HOLIDAYS[iso] && iso <= HOLIDAYS_LISTED_UNTIL;
}

/**
 * The first `leadDays` days from today are kept free to arrange the job: on
 * 1 October with 7 days, 1–7 October are closed and 8 October is the first
 * possible day. Weekends and Victorian public holidays are never offered.
 */
export function isBookableInstallDate(iso: ISODate, today: ISODate, leadDays = LEAD_TIME_DAYS): boolean {
  return iso >= addDaysISO(today, leadDays) && isInstallDay(iso);
}

/** The install days offered over the next `days` calendar days. Every bookable day is offered (no partner calendars yet). */
export function buildAvailability(installerId: string, today: ISODate, days = 56, leadDays = LEAD_TIME_DAYS): DayAvailability[] {
  void installerId; // one shared calendar until partners' own calendars are connected
  const out: DayAvailability[] = [];
  for (let i = leadDays; i < leadDays + days; i++) {
    const iso = addDaysISO(today, i);
    if (isInstallDay(iso)) out.push({ date: iso, windows: [INSTALL_ARRIVAL.id] });
  }
  return out;
}

export function getWindow(id: string): TimeWindow | undefined {
  return INSTALL_WINDOWS.find((w) => w.id === id);
}
