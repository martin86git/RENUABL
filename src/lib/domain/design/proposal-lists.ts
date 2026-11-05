/**
 * Proposals Sent and Proposals Signed, laid out as Primero's are (Martin, 18
 * Oct 2026): for each deal, what was sold as marks (solar, battery, EV
 * charger) with their sizes, the customer and address, the system, price and
 * who sent it, where it stands, the follow-ups due and when it went out; the
 * signed ones by month and by week with their totals. Pure, tested.
 */
import { todayInMarket } from "../market";
import type { ISODate } from "../types";

/** Follow-ups fall due this many days after a proposal goes out (Primero's: 2, 7 and 14). */
export const FOLLOW_UP_DAYS = [2, 7, 14] as const;
export const FOLLOW_UP_WORDS = ["First", "Second", "Third"] as const;
export type FollowUpHow = "call" | "email";

const ZONE = "Australia/Melbourne";
const DAY_MS = 86_400_000;
const dayNumber = (d: ISODate) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY_MS);

export interface FollowUpDue {
  /** 1, 2 or 3. */
  step: number;
  /** The day after sending it falls due on. */
  day: number;
  /** Days since it was sent. */
  age: number;
}

/**
 * The follow-up due on an open proposal, or null: the latest of the follow-up days it has reached, unless that one is
 * done, or the customer has written since it fell due (their word counts as the follow-up), or the business has
 * (`lastTouch`: any email from the deal or reply in the chat counts too; from Primero's, 5 Nov 2026).
 */
export function dueFollowUp(input: {
  sentAt: string;
  now: Date;
  done: readonly number[];
  lastWord: string | null;
  lastTouch?: string | null;
}): FollowUpDue | null {
  const sent = todayInMarket(new Date(input.sentAt));
  const age = dayNumber(todayInMarket(input.now)) - dayNumber(sent);
  const reached = FOLLOW_UP_DAYS.map((day, i) => ({ day, step: i + 1 })).filter((p) => p.day <= age);
  const latest = reached[reached.length - 1];
  if (!latest || input.done.includes(latest.day)) return null;
  for (const at of [input.lastWord, input.lastTouch])
    if (at && dayNumber(todayInMarket(new Date(at))) >= dayNumber(sent) + latest.day) return null;
  return { ...latest, age };
}

/** "First follow-up due · day 2, sent 3 days ago". */
export const followUpLine = (f: FollowUpDue) => `${FOLLOW_UP_WORDS[f.step - 1]} follow-up due · day ${f.day}, sent ${ago(f.age)}`;

const ago = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/** When a proposal went out, as the date card shows it: "18 Oct", "3:04 pm · today". In the market's time. */
export function sentStamp(at: string, now: Date): { day: string; time: string; ago: string; full: string } {
  const d = new Date(at);
  const day = d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: ZONE });
  const time = d
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: ZONE })
    .replace(/\s?([ap])\.?m\.?/i, " $1m")
    .toLowerCase();
  const days = dayNumber(todayInMarket(now)) - dayNumber(todayInMarket(d));
  return { day, time, ago: ago(days), full: `${day}, ${time}` };
}

/** "6.60 kW with 13.5 kWh battery", "6.60 kW". */
export function systemWords(kw: number, batteryKwh: number): string {
  const solar = kw ? `${kw.toFixed(2)} kW` : "";
  const battery = batteryKwh ? `${Math.round(batteryKwh * 10) / 10} kWh battery` : "";
  return solar && battery ? `${solar} with ${battery}` : solar || battery || "No system";
}

/** "$12,345": whole dollars. */
export const wholeDollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/** Whose name goes on the line: the part of the email before the @. */
export const byName = (email: string) => email.split("@")[0] ?? "";

/** Sent first by the follow-ups due (longest waiting first), then newest sent. */
export function sentOrder<T extends { at: string; due: FollowUpDue | null }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
    if (a.due && b.due) return b.due.age - a.due.age;
    return b.at.localeCompare(a.at);
  });
}

export interface WeekGroup<T> {
  /** "Week of 5 October". */
  label: string;
  rows: T[];
  total: number;
}
export interface MonthGroup<T> {
  /** "October 2026". */
  label: string;
  weeks: WeekGroup<T>[];
  count: number;
  total: number;
}

/**
 * Signed proposals by month, then by week (Monday to Sunday, in the market's time; a week belongs to the month its
 * Monday is in), newest first, each with how many and the sum of what customers pay.
 */
export function byMonthAndWeek<T extends { signedAt: string; youPay: number }>(rows: readonly T[]): MonthGroup<T>[] {
  const months: MonthGroup<T>[] = [];
  const sorted = [...rows].sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  for (const r of sorted) {
    const day = todayInMarket(new Date(r.signedAt));
    const n = dayNumber(day);
    const weekday = (new Date(n * DAY_MS).getUTCDay() + 6) % 7;
    const monday = new Date((n - weekday) * DAY_MS);
    const monthLabel = monday.toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
    const weekLabel = `Week of ${monday.toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" })}`;
    let month = months.find((m) => m.label === monthLabel);
    if (!month) months.push((month = { label: monthLabel, weeks: [], count: 0, total: 0 }));
    let week = month.weeks.find((w) => w.label === weekLabel);
    if (!week) month.weeks.push((week = { label: weekLabel, rows: [], total: 0 }));
    week.rows.push(r);
    week.total += r.youPay;
    month.count += 1;
    month.total += r.youPay;
  }
  return months;
}
