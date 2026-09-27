/**
 * Electricity bill → usage basis for sizing. The bill is read by Claude on the
 * server (`src/lib/server/bill-reader.ts`); this module validates what came
 * back and turns it into the figures the recommendation uses. Pure and tested.
 */

/** Raw figures read from a bill. Every field is optional: bills differ. */
export interface BillReading {
  isElectricityBill: boolean;
  retailer: string | null;
  periodDays: number | null;
  /** Grid electricity bought over the billing period. */
  usageKwh: number | null;
  /** Last 12 months, when the bill shows a usage history. */
  annualUsageKwh: number | null;
  /** Share of usage outside ~9am–5pm, when the bill splits usage by time of day. */
  eveningShare: number | null;
  /** Average price paid per kWh, in dollars. */
  usageRate: number | null;
  /** Solar feed-in credit per kWh, in dollars. */
  feedInRate: number | null;
  /** Solar exported to the grid over the period (existing solar). */
  exportedKwh: number | null;
}

/** What the rest of the app keeps (no personal details from the bill). */
export interface BillSummary {
  retailer: string | null;
  periodDays: number;
  dailyUsageKwh: number;
  annualUsageKwh: number;
  /** "history" = the bill's own 12-month figure; "period" = scaled up from this bill. */
  annualSource: "history" | "period";
  eveningShare: number | null;
  usageRate: number | null;
  feedInRate: number | null;
  hasSolar: boolean;
  /** Solar exported per day by an existing system (null when unknown or no solar). */
  exportedDailyKwh: number | null;
  /** True when this is a stand-in reading (preview without a Claude API key). */
  sample?: boolean;
}

export type BillProblem = "not-a-bill" | "unreadable";

export const BILL_UPLOAD = {
  maxBytes: 4 * 1024 * 1024, // below Vercel's 4.5 MB request limit
  types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const,
};

export type BillMediaType = (typeof BILL_UPLOAD.types)[number];

export function isBillMediaType(type: string): type is BillMediaType {
  return (BILL_UPLOAD.types as readonly string[]).includes(type);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function within(v: number | null, min: number, max: number) {
  return v !== null && v >= min && v <= max ? v : null;
}

/** Rates arrive as dollars (0.31) or cents (31); store dollars. */
function dollars(v: number | null, max: number) {
  if (v === null) return null;
  return within(v > 3 ? v / 100 : v, 0, max);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function exportedPerDay(exported: number | null, periodDays: number | null) {
  if (!exported || exported <= 0 || !periodDays) return null;
  return round1(exported / periodDays);
}

/**
 * Validates a reading and derives daily and annual usage. Returns a problem
 * instead when it isn't an electricity bill or the usage can't be trusted.
 */
export function summariseBill(raw: Partial<Record<keyof BillReading, unknown>>): BillSummary | BillProblem {
  if (raw.isElectricityBill === false) return "not-a-bill";

  const periodDays = within(num(raw.periodDays), 7, 400);
  const usage = within(num(raw.usageKwh), 1, 100_000);
  const history = within(num(raw.annualUsageKwh), 365, 100_000);
  if (!history && !(periodDays && usage)) return "unreadable";

  const annualUsageKwh = Math.round(history ?? (usage! / periodDays!) * 365);
  const dailyUsageKwh = round1(annualUsageKwh / 365);
  if (dailyUsageKwh < 1 || dailyUsageKwh > 200) return "unreadable";

  const retailer = typeof raw.retailer === "string" && raw.retailer.trim() ? raw.retailer.trim().slice(0, 60) : null;
  const evening = within(num(raw.eveningShare), 0, 1);

  return {
    retailer,
    periodDays: periodDays ?? 365,
    dailyUsageKwh,
    annualUsageKwh,
    annualSource: history ? "history" : "period",
    eveningShare: evening === null ? null : Math.round(evening * 100) / 100,
    usageRate: dollars(num(raw.usageRate), 1.5),
    feedInRate: dollars(num(raw.feedInRate), 0.5),
    hasSolar: (num(raw.exportedKwh) ?? 0) > 0,
    exportedDailyKwh: exportedPerDay(num(raw.exportedKwh), periodDays),
  };
}

export function isBillSummary(v: BillSummary | BillProblem): v is BillSummary {
  return typeof v === "object";
}

export const BILL_PROBLEM_MESSAGES: Record<BillProblem, string> = {
  "not-a-bill": "That doesn't look like an electricity bill. Try your latest bill from your energy retailer.",
  unreadable: "We couldn't read the usage on that bill. Try a clearer photo, or the PDF from your retailer's email.",
};
