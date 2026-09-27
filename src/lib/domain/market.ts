import type { ISODate, ISODateTime } from "./types";

/**
 * The market RENUABL is launching in. Defaults (address parsing, business
 * time zone, "today" for installer schedules) come from here, so expanding to
 * another state is a data change rather than a code hunt.
 */
export const LAUNCH_MARKET = {
  name: "Victoria",
  state: "VIC",
  capital: "Melbourne",
  capitalPostcode: "3000",
  timeZone: "Australia/Melbourne",
} as const;

/** Today's date in the market, independent of the server's own time zone (Vercel runs in UTC). */
export function todayInMarket(now: Date = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone }).format(now);
}

function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT+11:00"
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** A wall-clock time in the market (e.g. 7:30am Melbourne time) as an ISO timestamp, DST-aware. */
export function marketDateTime(date: ISODate, hour: number, minute = 0): ISODateTime {
  const [y, mo, d] = date.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, hour, minute);
  const offset = offsetMinutes(new Date(wallAsUtc));
  return new Date(wallAsUtc - offset * 60_000).toISOString();
}

/** "Good morning" / "Good afternoon" / "Good evening" for the market's local time. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
