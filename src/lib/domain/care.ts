/**
 * RENUABL Care — the post-install membership. Entry tier ("Essentials").
 * Opt-in only: never pre-selected, never charged with the deposit, and it
 * starts after the system is switched on.
 */

export type CareBilling = "monthly" | "yearly";

export const CARE_PLAN = {
  id: "care-essentials",
  name: "RENUABL Care",
  tier: "Essentials",
  monthly: 19,
  yearly: 199,
  features: [
    "24/7 system monitoring",
    "Basic alerts if something needs attention",
    "Regular performance checks",
    "Warranty and document storage",
    "Annual system health summary",
  ],
} as const;

export function carePrice(billing: CareBilling): number {
  return billing === "monthly" ? CARE_PLAN.monthly : CARE_PLAN.yearly;
}

/** How much a year of yearly billing saves versus twelve monthly payments. */
export function careYearlySaving(): number {
  return CARE_PLAN.monthly * 12 - CARE_PLAN.yearly;
}

export function carePriceLabel(billing: CareBilling): string {
  return billing === "monthly" ? `$${CARE_PLAN.monthly}/month` : `$${CARE_PLAN.yearly}/year`;
}

/** The top package ("Maximum") includes RENUABL Care free for the first year. */
export const CARE_FREE_MONTHS = 12;
export const CARE_INCLUDED_TIER = "independence" as const;

/**
 * RENUABL Care is switched off until performance summaries and alerts can be
 * delivered (phase 2: inverter monitoring portal APIs). While off, nothing
 * about Care is shown or sold, and Maximum doesn't include it.
 */
export const CARE_ENABLED = false;

export function careIncludedFor(tier: string): boolean {
  return CARE_ENABLED && tier === CARE_INCLUDED_TIER;
}

/** What the included year is worth, shown as "Valued at $199". */
export function careIncludedValue(): number {
  return CARE_PLAN.yearly;
}
