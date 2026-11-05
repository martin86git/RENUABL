/**
 * Each member's own calendar (5 Nov 2026, Martin: the date tile in the top card opens a calendar over the page with the
 * person's connected calendar, and asks them to connect one when there's none). Google Calendar, read only, the
 * primary calendar of the Google account they connect; only they see it. Days are the market's calendar days. Pure, tested.
 */
import { LAUNCH_MARKET } from "../market";
import { addDaysISO } from "../scheduling";
import type { ISODate } from "../types";

/** Reading events only: nothing is ever added, changed or deleted in their calendar. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
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
  /** The event in Google Calendar, and its video call, when it has one. Google's own addresses only. */
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
const googleLink = (u: string | undefined, host: RegExp): string | null => {
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
      link: googleLink(e.htmlLink, /(^|\.)google\.com$/),
      call: googleLink(e.hangoutLink, /^meet\.google\.com$/),
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

export const CALENDAR_WORDS = {
  connectTitle: "Connect your calendar",
  connectBody: "See your Google Calendar here, beside your work. RENUABL only reads it, and only you see it.",
  connect: "Connect Google Calendar",
  notReady: "Google sign-in isn't set up on this site yet, so a calendar can't be connected.",
  viewing: "You're viewing as someone else: their calendar isn't shown.",
  broken: "Google stopped sharing your calendar. Connect it again to see it here.",
  nothing: "Nothing on.",
} as const;
