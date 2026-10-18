/**
 * The Install Scheduler: a business's booked installations on a calendar,
 * each with the checks that say whether it is ready to go (the stock ordered,
 * the deposit received), and the reminder the customer can be sent before
 * their day (an automation, off until the business turns it on). Dates are
 * the market's calendar days, YYYY-MM-DD. Pure, tested.
 */
import { addDaysISO, VIC_PUBLIC_HOLIDAYS } from "../scheduling";
import type { ISODate } from "../types";
import type { OrderStatus } from "./orders";

export type CalendarView = "month" | "week";

const DAY_MS = 86_400_000;
const at = (d: ISODate) => Date.parse(`${d}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10) as ISODate;
/** Monday is 0, Sunday 6. */
const weekday = (d: ISODate) => (new Date(at(d)).getUTCDay() + 6) % 7;
const monday = (d: ISODate) => addDaysISO(d, -weekday(d));

/**
 * The days a view shows around a date: a week from its Monday, or the whole
 * weeks (Monday first) that hold its month; with the dates the arrows go to
 * and the view's title.
 */
export function calendarDays(view: CalendarView, date: ISODate): { days: ISODate[]; prev: ISODate; next: ISODate; title: string } {
  const month = (d: ISODate) => new Date(at(d)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
  if (view === "week") {
    const start = monday(date);
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
    const short = (d: ISODate) => new Date(at(d)).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
    return { days, prev: addDaysISO(start, -7), next: addDaysISO(start, 7), title: `${short(days[0])} to ${short(days[6])}` };
  }
  const first = `${date.slice(0, 7)}-01` as ISODate;
  const nextMonth = iso(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)), 1));
  const last = addDaysISO(nextMonth, -1);
  const start = monday(first);
  const end = addDaysISO(monday(last), 6);
  const days: ISODate[] = [];
  for (let ms = at(start); ms <= at(end); ms += DAY_MS) days.push(iso(ms));
  return { days, prev: addDaysISO(first, -1).slice(0, 7).concat("-01") as ISODate, next: nextMonth, title: month(first) };
}

/** A public holiday's name, where the day is one (Victoria's, the launch market's). */
export const holidayOn = (d: ISODate): string | null => VIC_PUBLIC_HOLIDAYS[d] ?? null;
export const isWeekend = (d: ISODate) => weekday(d) >= 5;

export interface ReadinessInput {
  order: OrderStatus | null;
  /** Null when the proposal asked for no deposit. */
  depositReceived: boolean | null;
}

export interface Check {
  key: "stock" | "deposit";
  label: string;
  done: boolean;
  value: string;
}

/** Whether a booked installation is ready to go: the stock ordered and the deposit in. */
export function readiness(input: ReadinessInput): { checks: Check[]; state: "ready" | "partly" | "not" } {
  const checks: Check[] = [
    {
      key: "stock",
      label: "Stock",
      done: input.order === "ordered" || input.order === "delivered",
      value: input.order === "delivered" ? "Delivered" : input.order === "ordered" ? "Ordered" : input.order ? "To order" : "No order yet",
    },
    {
      key: "deposit",
      label: "Deposit",
      done: input.depositReceived !== false,
      value: input.depositReceived === null ? "None asked" : input.depositReceived ? "Received" : "Not received",
    },
  ];
  const done = checks.filter((c) => c.done).length;
  return { checks, state: done === checks.length ? "ready" : done ? "partly" : "not" };
}

/** Whether today is the day a job's reminder goes: so many days before its installation, and not after it. */
export function reminderDue(installDate: ISODate, today: ISODate, daysBefore: number): boolean {
  return addDaysISO(installDate, -daysBefore) === today;
}

/** "Thursday 23 October". */
export const longDay = (d: ISODate) =>
  new Date(at(d)).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET_READY = [
  "Clear a path to your switchboard and to where the inverter will go.",
  "Keep pets inside, and the driveway free for the installers' vehicle.",
  "Someone over 18 at home when the installers arrive, to let them in.",
  "Your power will be off for part of the day while the system is connected.",
] as const;

/**
 * The reminder a customer is sent before their installation. It comes from
 * RENUABL's own sender and says plainly whose installation it is (the
 * business's, by name); a reply goes to the business when it has an address.
 * It says the day and how to get ready, and nothing of the price.
 */
export function installReminderEmail(input: { business: string; firstName: string; date: ISODate; contact: string | null }) {
  const day = longDay(input.date);
  const subject = `${input.business}: your installation is on ${day}`;
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const contact = input.contact
    ? `If anything has changed, reply to this email or contact ${input.business} on ${input.contact}.`
    : `If anything has changed, reply to this email.`;
  const text = [
    hello,
    "",
    `${input.business} will be installing your solar on ${day}. A few things to get ready:`,
    "",
    ...GET_READY.map((g) => `- ${g}`),
    "",
    contact,
    "",
    `${input.business}`,
    "",
    `Sent for ${input.business} by RENUABL.`,
  ].join("\n");
  const html = `<div style="font:15px/1.55 Arial,sans-serif;color:#111;max-width:560px">
<p>${esc(hello)}</p>
<p><strong>${esc(input.business)}</strong> will be installing your solar on <strong>${esc(day)}</strong>. A few things to get ready:</p>
<ul>${GET_READY.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
<p>${esc(contact)}</p>
<p>${esc(input.business)}</p>
<p style="color:#777;font-size:12px">Sent for ${esc(input.business)} by RENUABL.</p></div>`;
  return { subject, text, html };
}
