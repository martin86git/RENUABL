/**
 * Each member's own calendar (5 Nov 2026, Martin: the date tile in the top card opens a calendar over the page with the
 * person's connected calendar, and asks them to connect one when there's none; Google Calendar or Outlook, connected in a
 * small window over the page so they never leave it). Read only, the main calendar of the account they connect; only
 * they see it. Days are the market's calendar days. Pure, tested.
 */
import { LAUNCH_MARKET, marketDateTime } from "../market";
import { addDaysISO } from "../scheduling";
import type { ISODate } from "../types";

export type CalendarProvider = "google" | "outlook";
export const CALENDAR_PROVIDERS: readonly { id: CalendarProvider; name: string }[] = [
  { id: "google", name: "Google Calendar" },
  { id: "outlook", name: "Outlook" },
];
export const providerName = (p: CalendarProvider) => CALENDAR_PROVIDERS.find((x) => x.id === p)?.name ?? "Your calendar";
export const isProvider = (p: unknown): p is CalendarProvider => p === "google" || p === "outlook";

/** Reading events only: nothing is ever added, changed or deleted in their calendar. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export const OUTLOOK_SCOPE = "https://graph.microsoft.com/Calendars.Read";
/**
 * Outlook is asked for its times in the market's own zone (Windows' name for Melbourne's), so an all-day event keeps
 * its day and a timed one is read as Melbourne wall time.
 */
export const OUTLOOK_TIME_ZONE = "AUS Eastern Standard Time";
/** The most events read for one month on screen. */
export const MAX_EVENTS = 250;

export interface MyEvent {
  id: string;
  title: string;
  /** All-day: the first day and the day after the last (Google's own exclusive end). Timed: ISO instants. */
  allDay: boolean;
  start: string;
  end: string;
  location: string | null;
  /** The event in its calendar, and its video call, when it has one. The provider's own addresses only. */
  link: string | null;
  call: string | null;
}

/** An event as Google's Calendar API gives it (only what we read). */
export interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ownLink = (u: string | undefined, host: RegExp): string | null => {
  try {
    const url = new URL(u ?? "");
    return url.protocol === "https:" && host.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
};

/** Google's events as ours: cancelled ones and any without a usable start or end left out, words trimmed. */
export function cleanEvents(raw: readonly GoogleEvent[]): MyEvent[] {
  const out: MyEvent[] = [];
  for (const e of raw) {
    if (!e.id || e.status === "cancelled") continue;
    const allDay = Boolean(e.start?.date);
    const start = allDay ? e.start?.date : e.start?.dateTime;
    const end = allDay ? e.end?.date : e.end?.dateTime;
    if (!start || !end) continue;
    if (allDay ? !DAY.test(start) || !DAY.test(end) : Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) continue;
    out.push({
      id: e.id,
      title: (e.summary ?? "").trim().slice(0, 200) || "(No title)",
      allDay,
      start: allDay ? start : new Date(start).toISOString(),
      end: allDay ? end : new Date(end).toISOString(),
      location: e.location?.trim().slice(0, 200) || null,
      link: ownLink(e.htmlLink, /(^|\.)google\.com$/),
      call: ownLink(e.hangoutLink, /^meet\.google\.com$/),
    });
  }
  return out;
}

/** An event as Microsoft Graph gives it from calendarView (only what we read), its times in `OUTLOOK_TIME_ZONE`. */
export interface OutlookEvent {
  id?: string;
  subject?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  location?: { displayName?: string };
  webLink?: string;
  onlineMeeting?: { joinUrl?: string } | null;
}

const WALL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

/** Outlook's events as ours, as `cleanEvents` does Google's. */
export function cleanOutlookEvents(raw: readonly OutlookEvent[]): MyEvent[] {
  const out: MyEvent[] = [];
  for (const e of raw) {
    if (!e.id || e.isCancelled) continue;
    const s = e.start?.dateTime?.match(WALL);
    const f = e.end?.dateTime?.match(WALL);
    if (!s || !f) continue;
    const allDay = Boolean(e.isAllDay);
    const instant = (m: RegExpMatchArray) => marketDateTime(m[1], Number(m[2]), Number(m[3]));
    out.push({
      id: e.id,
      title: (e.subject ?? "").trim().slice(0, 200) || "(No title)",
      allDay,
      start: allDay ? s[1] : instant(s),
      end: allDay ? f[1] : instant(f),
      location: e.location?.displayName?.trim().slice(0, 200) || null,
      link: ownLink(e.webLink, /^outlook\.(office365|office|live)\.com$/),
      call: ownLink(e.onlineMeeting?.joinUrl, /^teams\.(microsoft|live)\.com$/),
    });
  }
  return out;
}

/** The market's calendar day an instant falls on. */
export const marketDay = (instant: string | Date): ISODate =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone }).format(new Date(instant));

/** The first and last day an event covers. A timed event ending at midnight doesn't reach the next day. */
export function daysOf(e: MyEvent): { first: ISODate; last: ISODate } {
  if (e.allDay) return { first: e.start, last: addDaysISO(e.end, -1) < e.start ? e.start : addDaysISO(e.end, -1) };
  const first = marketDay(e.start);
  const last = marketDay(new Date(Math.max(Date.parse(e.start), Date.parse(e.end) - 1)));
  return { first, last };
}

/** A day's events: all-day ones first, then by start time. */
export function eventsOn(events: readonly MyEvent[], day: ISODate): MyEvent[] {
  return events
    .filter((e) => {
      const { first, last } = daysOf(e);
      return first <= day && day <= last;
    })
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

/** Which of these days have anything on, for the dots under the month's days. */
export function busyDays(events: readonly MyEvent[], days: readonly ISODate[]): Set<ISODate> {
  return new Set(days.filter((d) => eventsOn(events, d).length > 0));
}

/** The time an event shows beside it on a day: "All day", "9:30 am – 10 am", or where it began or ends on another day. */
export function eventTime(e: MyEvent, day: ISODate): string {
  if (e.allDay) return "All day";
  const time = (at: string) =>
    new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", minute: "2-digit" })
      .format(new Date(at))
      .replace(":00", "")
      .toLowerCase();
  const { first, last } = daysOf(e);
  if (first < day && day < last) return "All day";
  if (first < day) return `Until ${time(e.end)}`;
  if (last > day) return `From ${time(e.start)}`;
  return `${time(e.start)} – ${time(e.end)}`;
}

/** Minutes past the market's midnight an instant falls at. */
export function marketMinutes(instant: string): number {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" })
    .formatToParts(new Date(instant))
    .reduce<Record<string, string>>((o, p) => ({ ...o, [p.type]: p.value }), {});
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** A timed event placed on the day view: minutes from midnight, and which of the side-by-side columns it takes. */
export interface PlacedEvent {
  event: MyEvent;
  from: number;
  to: number;
  column: number;
  columns: number;
}

/** The shortest an event is drawn, so a five-minute one can still be read and pressed. */
export const MIN_BLOCK_MINUTES = 30;

/**
 * The day view's timed events (all-day ones go above it, `eventsOn`): each clipped to the day, laid in time order, and
 * events that overlap set side by side, each group of overlapping events sharing the width between them.
 */
export function dayLayout(events: readonly MyEvent[], day: ISODate): PlacedEvent[] {
  const timed = eventsOn(events, day)
    .filter((e) => !e.allDay)
    .map((event) => {
      const { first, last } = daysOf(event);
      const from = first < day ? 0 : marketMinutes(event.start);
      const to = last > day ? 24 * 60 : Math.max(from, marketMinutes(event.end) || 24 * 60);
      return { event, from, to: Math.min(24 * 60, Math.max(to, from + MIN_BLOCK_MINUTES)), column: 0, columns: 1 };
    })
    .sort((a, b) => a.from - b.from || b.to - a.to);
  let group: PlacedEvent[] = [];
  let ends: number[] = [];
  const close = () => {
    for (const p of group) p.columns = ends.length;
    group = [];
    ends = [];
  };
  for (const p of timed) {
    if (group.length && p.from >= Math.max(...ends)) close();
    const free = ends.findIndex((end) => end <= p.from);
    p.column = free === -1 ? ends.length : free;
    ends[p.column] = p.to;
    group.push(p);
  }
  close();
  return timed;
}

/** Where the day view first scrolls to: an hour before the first event, else 7am. */
export function dayStartHour(placed: readonly PlacedEvent[]): number {
  const first = placed[0]?.from;
  return first === undefined ? 7 : Math.max(0, Math.min(7, Math.floor(first / 60) - 1));
}

/**
 * The instants to ask Google for, from the first to the last day on screen: a day wider either side, since the server
 * isn't in the market's time zone; `eventsOn` keeps each to its own days.
 */
export function rangeFor(first: ISODate, last: ISODate): { timeMin: string; timeMax: string } {
  return { timeMin: `${addDaysISO(first, -1)}T00:00:00Z`, timeMax: `${addDaysISO(last, 2)}T00:00:00Z` };
}

/** Where the connect flow may send someone back to: one of the designer's own pages, nothing else. */
export function returnPath(path: string | null | undefined): string {
  const p = path ?? "";
  return /^\/design(\/[A-Za-z0-9/_-]*)?$/.test(p) ? p : "/design";
}

/** What the small sign-in window tells the page that opened it (`postMessage`, our own site only). */
export const CALENDAR_MESSAGE = "renuabl:calendar";

/** How connecting can end, and what the calendar then says (nothing when it worked: the events say it). */
export const CONNECT_RESULTS: Record<string, string | null> = {
  connected: null,
  failed: "Your calendar couldn't be connected. Try again.",
  "signed-out": "Sign in again to connect your calendar.",
  "off-google": "Google sign-in isn't set up on this site yet, so Google Calendar can't be connected.",
  "off-outlook": "Microsoft sign-in isn't set up on this site yet, so Outlook can't be connected.",
};

export const CALENDAR_WORDS = {
  connectTitle: "Connect your calendar",
  connectBody: "See your calendar here, beside your work. RENUABL only reads it, and only you see it.",
  viewing: "You're viewing as someone else: their calendar isn't shown.",
  broken: "Your calendar stopped sharing with RENUABL. Connect it again to see it here.",
  waiting: "Finish signing in in the window that opened.",
  nothing: "Nothing on.",
} as const;
