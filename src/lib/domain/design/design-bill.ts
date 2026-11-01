/**
 * The designer's bill box in kWh as well as dollars, and what Sol finds of the home's use in the customer's file
 * (1 Nov 2026, Martin, as Primero's: "quite often they mention it"). Pure, tested in `design-bill.test.ts`.
 */
import { BILL_INTERVALS, type BillFields, type BillInterval } from "./quote";

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** The amount for a bill whose usage is in kWh: that many kWh at the rate, plus the supply charge for the interval. */
function amountFromUsage(b: BillFields): string {
  const kwh = num(b.usage);
  return kwh ? String(Math.round(kwh * num(b.rate) + num(b.supplyPerDay) * BILL_INTERVALS[b.interval])) : b.amount;
}

/**
 * The bill box after one change. Typing kWh works the amount out from it; typing dollars clears the kWh; changing the
 * rate, the supply charge or how often it is billed works the amount out again while the usage was typed in kWh, so
 * the two never disagree.
 */
export function billWith(bill: BillFields, change: Partial<BillFields>): BillFields {
  const next = { ...bill, ...change };
  if ("amount" in change && !("usage" in change)) {
    delete next.usage;
    return next;
  }
  if (!num(next.usage)) {
    if ("usage" in change) {
      delete next.usage;
      // Emptying the kWh empties the amount it had made.
      if (num(bill.usage)) next.amount = "";
    }
    return next;
  }
  return { ...next, amount: amountFromUsage(next) };
}

/** The kWh a bill in dollars comes to over its interval (the box's hint while it isn't typed in kWh), or null. */
export function usageFromAmount(bill: BillFields): number | null {
  const span = BILL_INTERVALS[bill.interval];
  const rate = num(bill.rate);
  const use = rate ? (num(bill.amount) - num(bill.supplyPerDay) * span) / rate : 0;
  return use > 0 ? Math.round(use) : null;
}

/** What Sol found about the home's use in the customer's file (notes, emails, calls, the chat). */
export interface FileUsageRead {
  found: boolean;
  /** kWh used over a stated period, with the period's length in days. */
  usageKwh: number | null;
  periodDays: number | null;
  /** kWh a day, when that is how it was said. */
  dailyKwh: number | null;
  /** A bill in dollars, with the period it covers in days (a quarterly bill is 91). */
  billAmount: number | null;
  billPeriodDays: number | null;
  /** The words it was found in, as written, and where. */
  quote: string;
  source: string;
}

export type FileUsageResult = { ok: true; fields: BillFields; notes: string[] } | { ok: false; message: string };

const NOT_FOUND = "Sol didn't find their usage or a bill amount in the customer's file.";
const EVERY: Record<BillInterval, string> = { annual: "a year", quarterly: "a quarter", bimonthly: "two months", monthly: "a month" };
const pos = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);
/** The bill interval closest to a period in days. */
export function nearestInterval(days: number): BillInterval {
  return (Object.keys(BILL_INTERVALS) as BillInterval[]).reduce((best, k) =>
    Math.abs(BILL_INTERVALS[k] - days) < Math.abs(BILL_INTERVALS[best] - days) ? k : best,
  );
}

/**
 * Sol's find into the bill box: kWh first (scaled to the bill's own length when the period is said, else kept to the
 * box's), else a daily figure, else the bill in dollars. Nothing found leaves the box as it was.
 */
export function billFieldsFromFile(read: Partial<FileUsageRead>, current: BillFields): FileUsageResult {
  if (!read.found) return { ok: false, message: NOT_FOUND };
  const usage = pos(read.usageKwh, 100_000);
  const period = pos(read.periodDays, 400);
  const daily = pos(read.dailyKwh, 500);
  const amount = pos(read.billAmount, 50_000);
  const billDays = pos(read.billPeriodDays, 400);
  const said = read.quote ? `“${read.quote.slice(0, 240)}”${read.source ? ` (${read.source.slice(0, 80)})` : ""}` : "";
  const notes = said ? [`Found ${said}.`] : [];
  if (usage || daily) {
    const interval = usage && period ? nearestInterval(period) : current.interval;
    const span = BILL_INTERVALS[interval];
    const kwh = usage && period ? (usage / period) * span : usage ? usage : (daily as number) * span;
    if (usage && !period) notes.push("The period wasn't said, so it is taken as one bill of the length in the box: check it.");
    if (usage && period && Math.abs(period - span) > 7)
      notes.push(`It covers ${Math.round(period)} days, so it is scaled to ${EVERY[interval]}.`);
    return { ok: true, fields: billWith({ ...current, interval }, { usage: String(Math.round(kwh)) }), notes };
  }
  if (amount) {
    const interval = billDays ? nearestInterval(billDays) : current.interval;
    const span = BILL_INTERVALS[interval];
    const scaled = billDays ? (amount * span) / billDays : amount;
    if (!billDays) notes.push("How often it is billed wasn't said: check it.");
    notes.push("A bill in dollars can carry credits and discounts: their usage in kWh is better if you can get it.");
    return { ok: true, fields: billWith({ ...current, interval }, { amount: String(Math.round(scaled)) }), notes };
  }
  return { ok: false, message: NOT_FOUND };
}

const n = (description: string) => ({ type: ["number", "null"] as ("number" | "null")[], description });

/** What Claude answers with when Sol looks through a file. */
export const FILE_USAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean", description: "True only if the file states the home's electricity use or bill amount." },
    usageKwh: n("kWh of grid electricity the home used over a stated period, as written. Null if not stated."),
    periodDays: n(
      "The length in days of the period that usage covers (a quarter is 91, two months 61, a month 30, a year 365). Null if not said.",
    ),
    dailyKwh: n("kWh a day, only when the file says it that way. Null otherwise."),
    billAmount: n("An electricity bill in dollars, as written, GST included. Null if not stated."),
    billPeriodDays: n("The length in days of the period that bill covers. Null if not said."),
    quote: {
      type: "string",
      description: "The words the figure was found in, copied exactly, under 240 characters. Empty if nothing found.",
    },
    source: { type: "string", description: "Where it was: e.g. 'Email to the customer, 2 Oct 2026', 'Note', 'Chat with the customer'." },
  },
  required: ["found", "usageKwh", "periodDays", "dailyKwh", "billAmount", "billPeriodDays", "quote", "source"],
} as const;

export const FILE_USAGE_PROMPT = `You are Sol, a solar business's assistant. Above is a customer's file. Find what their home uses in electricity, for designing their solar.

- Prefer usage in kWh with the period it covers. If several are given, take the most recent, and a whole bill's figure over a guess.
- If only a bill in dollars is given, give that with its period (a quarterly bill is 91 days).
- Never work a figure out or estimate one: give only figures written in the file, and quote the words they are in.
- Ignore figures about solar sent to the grid, a system's size (kW), a battery's size (kWh of storage) or a price for a system.
- If nothing is written, set found to false and every figure to null.`;

/** What the bill reader gives the designer (the homeowner site's own reader): never the customer's personal details. */
export interface BillPhotoRead {
  periodDays: number;
  dailyUsageKwh: number;
  usageRate: number | null;
  feedInRate: number | null;
  exportedDailyKwh: number | null;
}

/**
 * A bill photo or PDF into the bill box (2 Nov 2026, Martin): the usage in kWh for the bill's own length (the nearest
 * interval), its price per kWh and feed-in tariff where it shows them; the supply charge stays as the box had it,
 * since the reader doesn't take it. What was read is said, to check against the bill.
 */
export function billFieldsFromPhoto(read: BillPhotoRead, current: BillFields): { fields: BillFields; notes: string[] } {
  const interval = nearestInterval(read.periodDays);
  const span = BILL_INTERVALS[interval];
  const notes = [
    `About ${Math.round(read.dailyUsageKwh * 10) / 10} kWh a day over ${Math.round(read.periodDays)} days, put in as ${EVERY[interval]}.`,
  ];
  const rate = read.usageRate && read.usageRate > 0 && read.usageRate < 2 ? read.usageRate.toFixed(4).replace(/0+$/, "") : null;
  const feedIn =
    read.feedInRate !== null && read.feedInRate >= 0 && read.feedInRate < 1
      ? read.feedInRate.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
      : null;
  if (rate) notes.push(`Price per kWh $${rate}.`);
  else notes.push("The price per kWh wasn't clear on the bill: check it.");
  if (feedIn) notes.push(`Feed-in $${feedIn} a kWh.`);
  notes.push("The daily supply charge isn't read: check it against the bill.");
  if (read.exportedDailyKwh)
    notes.push(`It already exports about ${Math.round(read.exportedDailyKwh * 10) / 10} kWh a day: there's solar on the roof.`);
  const withRates = { ...current, interval, ...(rate ? { rate } : {}), ...(feedIn ? { feedIn } : {}) };
  return { fields: billWith(withRates, { usage: String(Math.round(read.dailyUsageKwh * span)) }), notes };
}
