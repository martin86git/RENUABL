/**
 * The first "what's in it for me" moment: straight after the bill is read,
 * "See how much I could save" shows a rough yearly saving for the two
 * starting options (solar only, and solar with a battery), before the
 * customer has answered anything else. Always an estimate from the bill,
 * rounded down, never "exact" or "guaranteed"; the system step firms it up.
 * Pure, tested.
 */
import { savingsFor } from "./recommendation";
import type { Recommendation } from "./types";

export const SAVINGS_PREVIEW = {
  toggle: "See how much I could save",
  heading: "You could save about",
  perYear: "a year",
  note: "A first estimate from your bill. We firm it up with your roof and answers as you go.",
} as const;

export interface SavingsBar {
  label: string;
  amount: number;
}

export interface SavingsPreview {
  low: number;
  high: number;
  bars: SavingsBar[];
}

/** Rounded down to the nearest $50, so the first figure never overstates. */
export function roundDownSavings(amount: number): number {
  return Math.max(0, Math.floor(amount / 50) * 50);
}

/** Null when there's nothing worth showing (no saving, or no usage on the bill). */
export function savingsPreview(rec: Recommendation): SavingsPreview | null {
  if (rec.usage.annualKwh <= 0) return null;
  const expanding = Boolean(rec.usage.existingSolar);
  const bars: SavingsBar[] = [
    {
      label: expanding ? "A smaller battery" : "Solar only",
      amount: roundDownSavings(savingsFor(rec.tiers.essential.config, rec.usage).annualSavings),
    },
    {
      label: expanding ? "The battery we'd suggest" : "Solar and a battery",
      amount: roundDownSavings(savingsFor(rec.tiers.recommended.config, rec.usage).annualSavings),
    },
  ].filter((b) => b.amount > 0);
  if (!bars.length) return null;
  const amounts = bars.map((b) => b.amount);
  return { low: Math.min(...amounts), high: Math.max(...amounts), bars };
}
