/**
 * The overview's front: the business's day (24 Oct 2026, Martin: a greeting, with the sun tracker showing what needs to
 * be done today). The sun travels the real day, from today's sunrise to sunset where the business works (the sunrise
 * equation, from the date and the place); beneath it, what needs doing today, each cleared or not, and one line for how
 * much of the day's list is cleared. Pure, tested.
 */
import type { ISODate } from "../types";

const RAD = Math.PI / 180;

/**
 * Sunrise and sunset on a day at a place, as instants (the sunrise equation: the sun's centre 0.833° below the horizon,
 * for refraction and its own size). Good to a minute or two; null in a polar day or night.
 */
export function sunTimes(date: ISODate, lat: number, lng: number): { rise: Date; set: Date } | null {
  const noonUtc = Date.parse(`${date}T12:00:00Z`);
  const jd = noonUtc / 86_400_000 + 2440587.5;
  const n = Math.round(jd - 2451545 + 0.0008);
  const jStar = n - lng / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const lambda = (m + c + 180 + 102.9372) % 360;
  const transit = 2451545 + jStar + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const dec = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD;
  const toDate = (j: number) => new Date((j - 2440587.5) * 86_400_000);
  return { rise: toDate(transit - w / 360), set: toDate(transit + w / 360) };
}

/** Where the sun is in the day: 0 at sunrise, 1 at sunset, and whether it is up yet or has set. */
export function sunNow(now: Date, times: { rise: Date; set: Date }): { share: number; phase: "before" | "up" | "set" } {
  const t = now.getTime();
  if (t < times.rise.getTime()) return { share: 0, phase: "before" };
  if (t > times.set.getTime()) return { share: 1, phase: "set" };
  return { share: (t - times.rise.getTime()) / (times.set.getTime() - times.rise.getTime()), phase: "up" };
}

export interface DayCounts {
  installsToday: number;
  followUpsDue: number;
  messages: number;
  mentions: number;
  ordersToPlace: number;
  needDate: number;
  serviceOpen: number;
}

export interface DayItem {
  key: keyof DayCounts;
  /** "2 follow-ups due" / "No follow-ups due". */
  label: string;
  count: number;
  /** Where to go to do it. */
  href: string;
}

const say = (n: number, one: string, many: string, none: string) => (n === 0 ? none : `${n} ${n === 1 ? one : many}`);

/** What needs doing today, the day's work first, each saying how many and where to go. */
export function dayList(c: DayCounts, paths: Record<keyof DayCounts, string>): DayItem[] {
  const item = (key: keyof DayCounts, label: string) => ({ key, label, count: c[key], href: paths[key] });
  return [
    item("installsToday", say(c.installsToday, "install today", "installs today", "No installs today")),
    item("followUpsDue", say(c.followUpsDue, "follow-up due", "follow-ups due", "No follow-ups due")),
    item("messages", say(c.messages, "message to answer", "messages to answer", "No messages waiting")),
    item("mentions", say(c.mentions, "mention to read", "mentions to read", "No mentions to read")),
    item(
      "ordersToPlace",
      say(c.ordersToPlace, "order to place before its install", "orders to place before their installs", "No orders to place"),
    ),
    item("needDate", say(c.needDate, "sold deal needs an install date", "sold deals need an install date", "Every sold deal has a date")),
    item("serviceOpen", say(c.serviceOpen, "service case open", "service cases open", "No service cases open")),
  ];
}

/**
 * How much of the day's list is cleared: the things to act on (all but today's installs, which are the day's work, not
 * a backlog) that have nothing waiting. 1 when everything is clear.
 */
export function dayCleared(items: readonly DayItem[]): { cleared: number; of: number; share: number } {
  const acts = items.filter((i) => i.key !== "installsToday");
  const cleared = acts.filter((i) => i.count === 0).length;
  return { cleared, of: acts.length, share: acts.length ? cleared / acts.length : 1 };
}

/** Whether an order still to be placed should be by now: its install is within `days` (two weeks). */
export const orderDueSoon = (status: string, installDate: string | null, today: ISODate, days = 14) => {
  if (status !== "open" || !installDate) return false;
  const gap = (Date.parse(`${installDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return gap <= days;
};
