/**
 * Booking an install from Today with a click (14 Nov 2026, Martin: "the RENUABL system should be programmed, it shouldn't
 * make me think at every stage"; on a signed deal Sol surfaces dates to choose from, with the email to send, in place of
 * a box to type into). The days are worked out by rule from the business's calendar, and the email is written from fixed
 * words with the customer's first name, the day and the business: no figure, price or promise. Pure, tested.
 */
import { addDaysISO } from "../scheduling";
import { isWorkingDay, nextWorkingDay } from "./today-pad";

/** How many days Sol offers. */
export const INSTALL_CHOICES = 4;
/** Working days from today before the first day offered: time to order the stock and tell the crew. */
export const INSTALL_LEAD_WORKING_DAYS = 5;
/** How far ahead to look for a free day. */
const LOOK_AHEAD_DAYS = 70;

const mondayOf = (day: string) => {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDaysISO(day, dow === 0 ? -6 : 1 - dow);
};

/**
 * The days Sol offers for an install: working days (never weekends or Victorian public holidays) from
 * `INSTALL_LEAD_WORKING_DAYS` out, with no install booked that day and the week not yet at what the business can do,
 * soonest first. Never more than one a week while there are enough weeks, so the choice is a real one.
 */
export function installDayChoices(input: { booked: readonly (string | null)[]; perWeek: number; today: string; count?: number }): string[] {
  const count = input.count ?? INSTALL_CHOICES;
  const booked = input.booked.filter((d): d is string => Boolean(d));
  const taken = new Set(booked);
  const inWeek = new Map<string, number>();
  for (const d of booked) inWeek.set(mondayOf(d), (inWeek.get(mondayOf(d)) ?? 0) + 1);
  let day = input.today;
  for (let i = 0; i < INSTALL_LEAD_WORKING_DAYS; i++) day = nextWorkingDay(day);
  const free: string[] = [];
  const last = addDaysISO(input.today, LOOK_AHEAD_DAYS);
  for (; day <= last; day = addDaysISO(day, 1)) {
    if (!isWorkingDay(day) || taken.has(day)) continue;
    if ((inWeek.get(mondayOf(day)) ?? 0) >= Math.max(1, input.perWeek)) continue;
    free.push(day);
  }
  // The soonest day, then the first free day of each week after it; filled up with the next soonest if short.
  const picked: string[] = [];
  const weeks = new Set<string>();
  for (const d of free) {
    if (picked.length >= count) break;
    if (weeks.has(mondayOf(d))) continue;
    weeks.add(mondayOf(d));
    picked.push(d);
  }
  for (const d of free) {
    if (picked.length >= count) break;
    if (!picked.includes(d)) picked.push(d);
  }
  return picked.sort();
}

/** "Tue 18 Nov". */
export const dayChip = (day: string) =>
  new Date(`${day}T12:00:00Z`)
    .toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(",", "");

/** "Tuesday 18 November". */
export const dayInFull = (day: string) =>
  new Date(`${day}T12:00:00Z`)
    .toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .replace(",", "");

/** The email that offers the customer the day: fixed words, their first name, the day, the sender and the business. */
export function installDayEmail(input: { firstName: string; day: string; sender: string; business: string }): {
  subject: string;
  body: string;
} {
  const when = dayInFull(input.day);
  const name = input.firstName.trim() || "there";
  const signOff = [input.sender.trim(), input.business.trim()].filter(Boolean).join("\n");
  return {
    subject: `Your installation day: ${when}`,
    body: [
      `Hi ${name},`,
      `Thanks again for going ahead. We'd like to install your system on ${when}.`,
      "Our installers arrive in the morning and most systems are done the same day. We'll confirm the arrival time the day before.",
      "If that day doesn't suit, just reply with a day that does and we'll move it.",
      `Kind regards,${signOff ? `\n${signOff}` : ""}`,
    ].join("\n\n"),
  };
}
