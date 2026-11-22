/**
 * Which way Today opens (20 Nov 2026, Martin: the chat with Sol, his box and the cards, "as a welcome page after being
 * inactive overnight", with a toggle between Chat and Feed). The first visit of the market's day opens on Chat; after
 * that Today opens on whichever of the two the member last had, until the day turns. Kept on the device. Pure: no I/O.
 */
import type { ISODate } from "../types";

export const TODAY_VIEWS = ["chat", "feed"] as const;
export type TodayView = (typeof TODAY_VIEWS)[number];

/** What the device remembers: the day it was last on Today, and which view it had. */
export interface TodaySeen {
  day: ISODate;
  view: TodayView;
}

export const TODAY_VIEW_KEY = "renuabl.design.today-view";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** What was kept, or null when it isn't a day and a view. */
export function cleanSeen(raw: unknown): TodaySeen | null {
  if (!raw || typeof raw !== "object") return null;
  const { day, view } = raw as Record<string, unknown>;
  if (typeof day !== "string" || !ISO.test(day)) return null;
  if (view !== "chat" && view !== "feed") return null;
  return { day: day as ISODate, view };
}

/** Chat the first time each day (or on a device that remembers nothing), else the view last had today. */
export function todayOpensOn(seen: TodaySeen | null, today: ISODate): TodayView {
  if (!seen || seen.day < today) return "chat";
  return seen.view;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const end = teen ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${end}`;
}

/**
 * Today's heading (22 Nov 2026, Martin: "the date (Sunday, 22nd November)" in place of "How's the business going").
 * Read from the market's day as given, never the browser's clock.
 */
export function todayHeading(day: ISODate): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_NAMES[weekday]}, ${ordinal(d)} ${MONTH_NAMES[m - 1]}`;
}
