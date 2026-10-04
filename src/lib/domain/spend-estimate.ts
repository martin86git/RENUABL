/**
 * "Or tell us roughly what you spend": for visitors who don't have their bill
 * handy (or don't want to upload it). They pick how often they're billed and a
 * spend range; we turn that into a stand-in bill so the flow can size and price
 * a system. Everything built from it is labelled indicative: the bill gives the
 * most accurate plan, and the figures are confirmed from it on the 15-minute call.
 * Trial started 4 Oct 2026 (7 days), to see whether the bill upload is putting
 * people off. Switch it off with SPEND_ESTIMATE_ENABLED.
 */
import type { BillSummary } from "./bill";

export const SPEND_ESTIMATE_ENABLED = true;

export type BillingPeriod = "monthly" | "two-monthly" | "quarterly";
export type SpendBandId = "low" | "medium" | "high" | "very-high";

export const BILLING_PERIODS: { value: BillingPeriod; label: string; months: number }[] = [
  { value: "monthly", label: "Monthly", months: 1 },
  { value: "two-monthly", label: "Every 2 months", months: 2 },
  { value: "quarterly", label: "Quarterly", months: 3 },
];

/** Bands in dollars a month (scaled for two-monthly and quarterly bills), with the figure we size from. */
export const SPEND_BANDS: { id: SpendBandId; from: number; to: number | null; typical: number }[] = [
  { id: "low", from: 0, to: 150, typical: 110 },
  { id: "medium", from: 150, to: 300, typical: 225 },
  { id: "high", from: 300, to: 450, typical: 375 },
  { id: "very-high", from: 450, to: null, typical: 550 },
];

/**
 * PLACEHOLDER rule of thumb for Victoria, to check against real bills: a typical
 * all-day usage rate and daily supply charge (incl. GST). Spend less supply
 * charges, divided by the rate, gives the home's yearly use.
 */
export const SPEND_ASSUMPTIONS = { usageRate: 0.3, supplyPerDay: 1.1, minDailyKwh: 6, maxDailyKwh: 60 };

export const SPEND_COPY = {
  or: "or",
  billBadge: "Most accurate",
  heading: "Tell us roughly what you spend",
  subheading: "No bill handy? Pick your usual electricity bill. We'll give you an indicative plan.",
  periodLabel: "How often are you billed?",
  bandLabel: "About how much is each bill?",
  indicative: "Indicative",
  chosen: "Indicative plan from what you spend",
  upgrade: "Upload your bill any time for the most accurate plan. We confirm everything from it on your 15-minute call.",
  savingsNote: "Indicative, from what you spend. Upload your bill for the most accurate figures.",
  priceNote: "Indicative price, from what you spend. Your bill gives the most accurate price; we confirm it on your 15-minute call.",
} as const;

const periodMonths = (p: BillingPeriod) => BILLING_PERIODS.find((x) => x.value === p)?.months ?? 1;
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/** "Up to $300", "$300–$600", "Over $900" for the chosen billing period. */
export function spendBandLabel(id: SpendBandId, period: BillingPeriod): string {
  const band = SPEND_BANDS.find((b) => b.id === id)!;
  const m = periodMonths(period);
  if (band.from === 0) return `Up to ${dollars(band.to! * m)}`;
  if (band.to === null) return `Over ${dollars(band.from * m)}`;
  return `${dollars(band.from * m)}–${dollars(band.to * m)}`;
}

/** "$150–$300 a month" etc., for staff notes. */
export function spendDescription(period: BillingPeriod, band: SpendBandId): string {
  const per = period === "monthly" ? "a month" : period === "two-monthly" ? "every 2 months" : "a quarter";
  return `${spendBandLabel(band, period)} ${per}`;
}

/** A stand-in bill from the spend range. No retailer, no solar, no time-of-day split. */
export function billFromSpend(period: BillingPeriod, band: SpendBandId): BillSummary {
  const b = SPEND_BANDS.find((x) => x.id === band) ?? SPEND_BANDS[1];
  const yearlySpend = b.typical * 12;
  const yearlyKwh = Math.max(0, yearlySpend - SPEND_ASSUMPTIONS.supplyPerDay * 365) / SPEND_ASSUMPTIONS.usageRate;
  const daily = Math.min(SPEND_ASSUMPTIONS.maxDailyKwh, Math.max(SPEND_ASSUMPTIONS.minDailyKwh, yearlyKwh / 365));
  const dailyUsageKwh = Math.round(daily * 10) / 10;
  return {
    retailer: null,
    periodDays: periodMonths(period) * 30,
    dailyUsageKwh,
    annualUsageKwh: Math.round(dailyUsageKwh * 365),
    annualSource: "period",
    eveningShare: null,
    usageRate: SPEND_ASSUMPTIONS.usageRate,
    feedInRate: null,
    hasSolar: false,
    exportedDailyKwh: null,
    estimate: { period, band },
  };
}

/** True when the plan comes from a spend range rather than a real bill. */
export function isIndicative(bill: BillSummary | null | undefined): boolean {
  return Boolean(bill?.estimate);
}
