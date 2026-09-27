import { addDays, fromISODate, stableHash, toISODate } from "./scheduling";
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
 * Days and times the 15-minute confirmation call can be booked: weekdays from
 * tomorrow, and always before the install date so it's confirmed in time.
 */
export function buildCallAvailability(today: ISODate, installDate: ISODate | null, days = 14): CallDay[] {
  const start = fromISODate(today);
  const out: CallDay[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(start, i);
    const iso = toISODate(date);
    if (installDate && iso >= installDate) break;
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
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
