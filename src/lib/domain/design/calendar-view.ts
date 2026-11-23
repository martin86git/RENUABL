/**
 * Today's calendar, drawn the way Google Calendar's app is (23 Nov 2026, Martin: "Calendar should look like Google
 * calendar app - take inspiration from it"): Schedule, Day and Month, and two calendars shown together and ticked
 * on or off, the member's own (Google or Outlook) and the business's installs. Pure: no I/O.
 */
import type { ISODate } from "../types";
import { addDaysISO } from "../scheduling";
import { LAUNCH_MARKET } from "../market";
import { INSTALL_DAY } from "./install-event";
import { eventsOn, marketMinutes, type MyEvent } from "./my-calendar";

export const CAL_VIEWS = ["schedule", "day", "month"] as const;
export type CalView = (typeof CAL_VIEWS)[number];
export const CAL_VIEW_WORDS: Record<CalView, string> = { schedule: "Schedule", day: "Day", month: "Month" };
export const cleanCalView = (v: unknown): CalView => (CAL_VIEWS.includes(v as CalView) ? (v as CalView) : "day");

export const CAL_SOURCES = ["mine", "installs"] as const;
export type CalSource = (typeof CAL_SOURCES)[number];

/** What the device remembers: the view, and which calendars are ticked. */
export const CAL_KEY = "renuabl.design.today-calendar";
export interface CalKept {
  view: CalView;
  hidden: CalSource[];
}
export function cleanKept(raw: unknown): CalKept {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hidden = Array.isArray(r.hidden) ? CAL_SOURCES.filter((s) => (r.hidden as unknown[]).includes(s)) : [];
  return { view: cleanCalView(r.view), hidden };
}

/** An event on the calendar, from either calendar: where it opens, and whether that is outside RENUABL. */
export type CalEvent = MyEvent & { source: CalSource; href: string | null; detail: string | null };

/** The instant a clock time on a market day falls at (Victoria is 10 or 11 hours ahead of UTC). */
export function marketInstant(day: ISODate, hhmm: string): string {
  const guess = Date.parse(`${day}T${hhmm}:00Z`);
  const utc = new Date(guess).getUTCHours() * 60 + new Date(guess).getUTCMinutes();
  const ahead = (marketMinutes(new Date(guess).toISOString()) - utc + 1440) % 1440;
  return new Date(guess - ahead * 60_000).toISOString();
}

/** The fields of a deal the installs calendar reads. */
export interface InstallJob {
  id: string;
  customerName: string;
  address: string | null;
  installDate: string | null;
  stage: string;
  kw?: number | null;
}

/** The business's booked installs as events: the crew's day (`INSTALL_DAY`), each opening its deal. */
export function installEvents(jobs: readonly InstallJob[]): CalEvent[] {
  return jobs
    .filter((j) => j.stage !== "lost" && j.installDate && /^\d{4}-\d{2}-\d{2}$/.test(j.installDate))
    .map((j) => {
      const day = j.installDate as ISODate;
      const kw = j.kw ? ` · ${Number(j.kw).toFixed(2)} kW` : "";
      return {
        id: `install-${j.id}`,
        title: `Install: ${j.customerName}${kw}`,
        allDay: false,
        start: marketInstant(day, INSTALL_DAY.start),
        end: marketInstant(day, INSTALL_DAY.end),
        location: j.address,
        link: null,
        call: null,
        source: "installs" as const,
        href: `/design/deals/${j.id}`,
        detail: j.address,
      };
    });
}

/** The member's own events, marked as theirs; each opens in its own calendar. */
export const mineEvents = (events: readonly MyEvent[]): CalEvent[] =>
  events.map((e) => ({ ...e, source: "mine" as const, href: e.link, detail: e.location }));

/** The days a view shows around a day: one, three from it, or the month's grid (Monday first, whole weeks). */
export function viewDays(view: CalView, day: ISODate): ISODate[] {
  if (view === "day") return [day];
  if (view === "schedule") return Array.from({ length: SCHEDULE_DAYS }, (_, n) => addDaysISO(day, n));
  const first = `${day.slice(0, 8)}01` as ISODate;
  const back = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDaysISO(first, -back);
  const last = lastOfMonth(day);
  const span = Math.ceil((back + Number(last.slice(8))) / 7) * 7;
  return Array.from({ length: span }, (_, n) => addDaysISO(start, n));
}

const lastOfMonth = (day: ISODate): ISODate => {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) as ISODate;
};

/** How far Schedule looks ahead. */
export const SCHEDULE_DAYS = 45;

/** Where a swipe or step lands: a day, a month, or (Schedule) a week. */
export function stepDay(view: CalView, day: ISODate, dir: 1 | -1): ISODate {
  if (view === "day") return addDaysISO(day, dir);
  if (view === "schedule") return addDaysISO(day, 7 * dir);
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10) as ISODate;
}

/** Schedule: each day from the first with anything on, its events in order; today is always listed. */
export function scheduleList(events: readonly CalEvent[], from: ISODate, today: ISODate): { day: ISODate; events: CalEvent[] }[] {
  return viewDays("schedule", from)
    .map((day) => ({ day, events: eventsOn(events, day) as CalEvent[] }))
    .filter((d) => d.events.length > 0 || d.day === today);
}

/** The heading over the calendar: the month (and year when it isn't this year's). */
export function monthHeading(day: ISODate, today: ISODate): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-AU", {
    month: "long",
    ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "MON" and "23" for a day's header. */
export function dayLabel(day: ISODate): { weekday: string; date: number } {
  const d = new Date(`${day}T00:00:00Z`);
  return { weekday: d.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" }).toUpperCase(), date: d.getUTCDate() };
}

/** Today's date in the market, for the round that jumps back to it. */
export const marketToday = (): ISODate =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone }).format(new Date()) as ISODate;
