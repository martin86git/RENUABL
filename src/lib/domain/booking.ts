import { addDays, fromISODate, isInstallDay, stableHash, toISODate } from "./scheduling";
import type { ISODate } from "./types";

/**
 * HubSpot Meetings: the 15-minute confirmation call is booked by the
 * customer on RENUABL's HubSpot scheduling page, embedded in the app.
 */

/** Accepts only https HubSpot meetings links (e.g. https://meetings.hubspot.com/renuabl/confirmation). */
export function parseHubspotMeetingsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const hubspot = url.hostname === "hubspot.com" || url.hostname.endsWith(".hubspot.com");
    return url.protocol === "https:" && hubspot ? url : null;
  } catch {
    return null;
  }
}

/**
 * The embeddable form of the link. HubSpot's scheduler pre-fills its form
 * from `firstname`, `lastname` and `email` query parameters when provided.
 */
export function hubspotEmbedSrc(base: URL, prefill: { firstname?: string; lastname?: string; email?: string } = {}): string {
  const url = new URL(base.toString());
  url.searchParams.set("embed", "true");
  for (const [k, v] of Object.entries(prefill)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/** True when a window message is HubSpot's "meeting booked" event. */
export function isHubspotBookedMessage(origin: string, data: unknown): boolean {
  let host = "";
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (!(host === "hubspot.com" || host.endsWith(".hubspot.com"))) return false;
  return typeof data === "object" && data !== null && (data as { meetingBookSucceeded?: unknown }).meetingBookSucceeded === true;
}

// ---------------------------------------------------------------------------
// In-app booking (used when no HubSpot link is configured)
// ---------------------------------------------------------------------------

/** Call times in Melbourne time, every 30 minutes, 9am to 4:30pm, weekdays. */
export const CALL_TIMES = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

export interface CallDay {
  date: ISODate;
  times: string[];
}

/**
 * Days and times the 15-minute calls can be booked: weekdays from tomorrow,
 * never weekends or Victorian public holidays, and always before the install
 * date (when there is one) so it's confirmed in time.
 */
export function buildCallAvailability(today: ISODate, installDate: ISODate | null, days = 14): CallDay[] {
  const start = fromISODate(today);
  const out: CallDay[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(start, i);
    const iso = toISODate(date);
    if (installDate && iso >= installDate) break;
    // Weekdays only: never Saturdays, Sundays or Victorian public holidays (the same days as installs).
    if (!isInstallDay(iso)) continue;
    const h = stableHash(`call:${iso}`);
    const times = CALL_TIMES.filter((_, idx) => (h >> idx) % 5 !== 0);
    if (times.length) out.push({ date: iso, times });
  }
  return out;
}

/** "13:30" → "1:30pm". */
export function formatCallTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`;
}

// ---------------------------------------------------------------------------
// "Book a 15-minute call" for prospects without a reservation (/book-a-call)
// ---------------------------------------------------------------------------

/** What the prospect sees and what the invite says. A chat about their home, not the post-reservation confirmation. */
export const CONSULT_CALL = {
  title: "Book a 15-minute call.",
  intro:
    "Talk it through with one of our team: what your home needs, the rebates and how it all works. We'll call you at the time you choose.",
  note: "No obligation and nothing to pay. Have your latest electricity bill handy if you can, but you don't need it.",
} as const;

/** True when the day and time is one the page offered (weekday, from tomorrow, a listed time), so the server can check it. */
export function isBookableCallSlot(today: ISODate, date: string, time: string): boolean {
  return buildCallAvailability(today, null).some((d) => d.date === date && d.times.includes(time));
}
