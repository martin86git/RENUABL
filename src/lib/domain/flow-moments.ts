/**
 * The small rewards along the quote flow, one per step: the savings reveal
 * (savings-preview.ts), "Here's your system", the rebates you're eligible
 * for, the earliest install date, the price last (after rebates), and a
 * celebration when the date is reserved. Every line is true of the
 * customer's own figures: estimates say so, nothing is "guaranteed". Pure, tested.
 */
import { formatCurrency, formatDate } from "./format";

export const SYSTEM_REVEAL = {
  eyebrow: "Your plan is ready",
  title: "Here's your system.",
} as const;

/** "Good news: this system is eligible for about $4,350 in rebates." Null when there are none. */
export function rebateReward(total: number): { heading: string; amount: string; note: string } | null {
  if (!(total > 0)) return null;
  return {
    heading: "Good news: this system is eligible for about",
    amount: formatCurrency(total),
    note: "in rebates. We take them off your price at the end, and confirm them on your call.",
  };
}

/** Before a date is picked: the soonest the matched partner can come. */
export function earliestInstallLine(date: string | undefined): string | null {
  if (!date) return null;
  return `Your system could be installed as soon as ${formatDate(date, { weekday: "long", day: "numeric", month: "long" })}.`;
}

/** Once a date is picked. */
export function pickedInstallLine(date: string): string {
  return `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} it is. That's when your system could be installed.`;
}

/** The reserve step's price header: the price is shown last, after the rebates. */
export function priceHeader(rebates: number): string {
  return rebates > 0 ? `Your price, after ${formatCurrency(rebates)} in rebates` : "Your price";
}

export const RESERVED_CELEBRATION = {
  title: "You're reserved!",
  whoopUnlocked: "Gift unlocked",
} as const;

/** All customer-visible text here, for the claims check. */
export function flowMomentsText(): string {
  return [
    ...Object.values(SYSTEM_REVEAL),
    ...Object.values(rebateReward(1000) ?? {}),
    earliestInstallLine("2026-10-21") ?? "",
    pickedInstallLine("2026-10-21"),
    priceHeader(1000),
    ...Object.values(RESERVED_CELEBRATION),
  ].join("\n");
}
