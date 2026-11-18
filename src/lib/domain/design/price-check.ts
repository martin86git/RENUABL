/**
 * Sol's price check on a quote (18 Nov 2026, Martin: "is there opportunity for Sol to provide any intelligence guidance
 * advice on pricing?"). Read by rule, so free, from the business's own published proposals only: never market prices,
 * never another business's. Four checks:
 *
 * 1. The price against signed jobs of about this size (`priceAgainstSigned`).
 * 2. A cost typed by hand far from the price list, or from what the business costed it at before (`typedCostFlags`).
 * 3. The margin against the signed jobs' margins, the quarter's lowest, and the business's own floor (`marginCheck`).
 * 4. Where signed proposals sit against ones that went quiet (`signedAgainstQuiet`).
 *
 * Each says nothing when there are too few jobs to judge by. Advice only: the person sets the price.
 */
import { lineKey, type CostLine, type LineEdit } from "./quote";
import { internalForChoice, viewForChoice, type OptionKey, type ProposalInternal, type ProposalView } from "./proposal";

/** One proposal as a price point: what was offered, at what margin, and whether it was signed. */
export interface PricePoint {
  /** The deal it was for, so the quote's own deal is left out. */
  jobId: string;
  kw: number;
  batteryKwh: number;
  /** What the customer pays after STCs, GST included. */
  youPay: number;
  /** Margin as a share of the price ex GST (0 to 1). */
  marginShare: number;
  signed: boolean;
  /** Not signed, and out long enough (or the deal lost) to count as gone quiet. */
  quiet: boolean;
  /** When it was published, or signed. */
  at: string;
  /** The cost each of every product on it, by code. */
  costs: { sku: string; each: number }[];
}

/** The quote being priced now. */
export interface QuoteNow {
  kw: number;
  batteryKwh: number;
  youPay: number;
  marginShare: number;
}

/** How many jobs it takes before a comparison is made. */
export const MIN_LIKE = 5;
/** Days a proposal is out unsigned before it counts as gone quiet. */
export const QUIET_DAYS = 21;
/** How far a typed cost may be from the list or the business's last cost before it is flagged. */
export const TYPED_GAP = 0.1;
/** Within this of the middle is "in line". */
const IN_LINE = 0.05;
/** How far back proposals count. */
export const HISTORY_DAYS = 365;

const DAY = 86_400_000;

/**
 * A published version as a price point. A signed version counts as the system the customer chose; an unsigned one as
 * the one recommended. Indicative proposals are left out (they can't be signed, so they'd read as lost).
 */
export function pointOf(input: {
  jobId: string;
  view: ProposalView;
  internal: ProposalInternal;
  publishedAt: string;
  acceptedAt: string | null;
  acceptedOption: string | null;
  lost: boolean;
  now: Date;
}): PricePoint | null {
  if (input.view.indicative) return null;
  const signed = Boolean(input.acceptedAt);
  const goal = (signed ? input.acceptedOption : null) as OptionKey | null;
  const view = viewForChoice(input.view, goal);
  const internal = internalForChoice(input.internal, goal);
  if (!(view.system.kw > 0) || !(internal.priceExGst > 0)) return null;
  const age = input.now.getTime() - new Date(input.publishedAt).getTime();
  const costs: PricePoint["costs"] = [];
  for (const l of internal.lines as { sku?: string; qty?: number; amount: number }[]) {
    if (!l.sku || !(l.amount > 0)) continue;
    costs.push({ sku: l.sku, each: Math.round((l.amount / (l.qty && l.qty > 0 ? l.qty : 1)) * 100) / 100 });
  }
  return {
    jobId: input.jobId,
    kw: view.system.kw,
    batteryKwh: view.system.batteryKwh,
    youPay: view.price.youPay,
    marginShare: internal.margin / internal.priceExGst,
    signed,
    quiet: !signed && (input.lost || age > QUIET_DAYS * DAY),
    at: signed ? (input.acceptedAt as string) : input.publishedAt,
    costs,
  };
}

/** Points read back from a browser or a server: only well-formed ones kept. */
export function cleanPoints(raw: unknown): PricePoint[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const out: PricePoint[] = [];
  for (const r of raw.slice(0, 2000)) {
    if (!r || typeof r !== "object") continue;
    const p = r as Record<string, unknown>;
    const kw = num(p.kw);
    const youPay = num(p.youPay);
    const marginShare = num(p.marginShare);
    if (!(kw > 0) || !(youPay > 0) || !Number.isFinite(marginShare) || typeof p.at !== "string") continue;
    out.push({
      jobId: typeof p.jobId === "string" ? p.jobId : "",
      kw,
      batteryKwh: num(p.batteryKwh) > 0 ? num(p.batteryKwh) : 0,
      youPay,
      marginShare,
      signed: p.signed === true,
      quiet: p.quiet === true,
      at: p.at,
      costs: Array.isArray(p.costs)
        ? (p.costs as unknown[]).flatMap((c) => {
            const x = c as Record<string, unknown>;
            return typeof x?.sku === "string" && num(x.each) > 0 ? [{ sku: x.sku, each: num(x.each) }] : [];
          })
        : [],
    });
  }
  return out;
}

/** Two systems alike enough to compare: both with a battery or both without, sizes within about a third. */
export function alike(a: { kw: number; batteryKwh: number }, b: { kw: number; batteryKwh: number }): boolean {
  const near = (x: number, y: number) => x > 0 && y > 0 && x / y <= 1.35 && y / x <= 1.35;
  if (a.batteryKwh > 0 !== b.batteryKwh > 0) return false;
  return near(a.kw, b.kw) && (a.batteryKwh === 0 || near(a.batteryKwh, b.batteryKwh));
}

/** What a price is compared by: dollars a watt after STCs for solar alone, the price itself for a battery system. */
function measure(p: { kw: number; batteryKwh: number; youPay: number }): number {
  return p.batteryKwh > 0 ? p.youPay : p.youPay / (p.kw * 1000);
}

function measureWords(value: number, battery: boolean): string {
  return battery ? `$${Math.round(value).toLocaleString("en-AU")}` : `$${value.toFixed(2)}/W`;
}

const kindWords = (battery: boolean) => (battery ? "solar and battery" : "solar-only");

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const recent = (points: PricePoint[], now: Date) => points.filter((p) => now.getTime() - new Date(p.at).getTime() <= HISTORY_DAYS * DAY);

/** One line of advice, and how it reads. */
export interface Advice {
  tone: "ok" | "warn" | "info";
  text: string;
}

/** 1. This price against the signed jobs of about this size: the middle of them, and the middle half. */
export function priceAgainstSigned(now: QuoteNow, points: PricePoint[], today: Date): Advice | null {
  if (!(now.kw > 0) || !(now.youPay > 0)) return null;
  const battery = now.batteryKwh > 0;
  const like = recent(points, today)
    .filter((p) => p.signed && alike(p, now))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
  const mine = measure(now);
  if (like.length < MIN_LIKE)
    return {
      tone: "info",
      text: `${measureWords(mine, battery)} after STCs. Not enough signed ${kindWords(battery)} jobs this size to compare yet (${like.length} of ${MIN_LIKE}).`,
    };
  const sorted = like.map(measure).sort((a, b) => a - b);
  const mid = quantile(sorted, 0.5);
  const gap = (mine - mid) / mid;
  const where =
    Math.abs(gap) <= IN_LINE ? "in line with" : gap > 0 ? `${Math.round(gap * 100)}% above` : `${Math.round(-gap * 100)}% below`;
  return {
    tone: Math.abs(gap) <= IN_LINE ? "ok" : "warn",
    text:
      `${measureWords(mine, battery)} after STCs, ${where} your last ${like.length} signed ${kindWords(battery)} jobs this size ` +
      `(${measureWords(mid, battery)}; the middle half ${measureWords(quantile(sorted, 0.25), battery)}–${measureWords(quantile(sorted, 0.75), battery)}).`,
  };
}

/**
 * 2. Costs typed by hand that sit well away from the price list's cost, or from the cost the business put on that
 * product the last time it published a proposal. By the line's key.
 */
export function typedCostFlags(lines: readonly CostLine[], edits: Record<string, LineEdit>, points: PricePoint[]): Record<string, string> {
  const before = new Map<string, { each: number; at: string }>();
  for (const p of [...points].sort((a, b) => b.at.localeCompare(a.at)))
    for (const c of p.costs) if (!before.has(c.sku)) before.set(c.sku, { each: c.each, at: p.at });
  const out: Record<string, string> = {};
  for (const l of lines) {
    const e = edits[lineKey(l)];
    if (!l.sku || e?.amount === undefined || e.removed || !(e.amount > 0)) continue;
    const qty = e.qty ?? l.qty ?? 1;
    if (!(qty > 0)) continue;
    const typed = e.amount / qty;
    const listed =
      !l.missing && l.qty && l.qty > 0 && l.amount > 0 ? l.amount / l.qty : !l.missing && !l.qty && l.amount > 0 ? l.amount : null;
    const was = before.get(l.sku);
    const each = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString("en-AU")}`;
    const far = (ref: number) => Math.abs(typed - ref) / ref > TYPED_GAP;
    if (listed !== null && far(listed)) out[lineKey(l)] = `Typed ${each(typed)} each; your price list has ${each(listed)}.`;
    else if (listed === null && was && far(was.each))
      out[lineKey(l)] = `Typed ${each(typed)} each; you costed it at ${each(was.each)} on ${dayWords(was.at)}.`;
  }
  return out;
}

function dayWords(at: string): string {
  return new Date(at).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
}

/** The start of the quarter `today` is in (calendar quarters), as an ISO date. */
function quarterStart(today: Date): string {
  const d = new Date(today.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const m = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
}

/**
 * 3. The margin: below the business's floor (a warning before publishing), the lowest sent this quarter, and set
 * against the signed jobs' margins. `floor` is a share (0 to 1); 0 means none set.
 */
export function marginCheck(now: QuoteNow, points: PricePoint[], floor: number, today: Date): Advice[] {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const out: Advice[] = [];
  if (!(now.youPay > 0)) return out;
  if (floor > 0 && now.marginShare < floor - 0.0005)
    out.push({ tone: "warn", text: `${pct(now.marginShare)} margin is under your ${pct(floor)} floor.` });
  const quarter = quarterStart(today);
  const thisQuarter = points.filter((p) => p.at.slice(0, 10) >= quarter);
  if (thisQuarter.length >= 3 && thisQuarter.every((p) => p.marginShare > now.marginShare + 0.0005))
    out.push({ tone: "warn", text: `The lowest margin of anything you've sent this quarter (${thisQuarter.length} proposals).` });
  const signed = recent(points, today)
    .filter((p) => p.signed)
    .map((p) => p.marginShare)
    .sort((a, b) => a - b);
  if (signed.length >= MIN_LIKE) {
    const mid = quantile(signed, 0.5);
    const gap = now.marginShare - mid;
    out.push({
      tone: gap < -0.03 ? "warn" : "ok",
      text: `${pct(now.marginShare)} margin; your ${signed.length} signed jobs this year sit at ${pct(mid)} in the middle.`,
    });
  }
  return out;
}

/**
 * 4. Where proposals that were signed sit against those that went quiet, at about this size; and where this one falls.
 * Only once there are enough of each.
 */
export function signedAgainstQuiet(now: QuoteNow, points: PricePoint[], today: Date): Advice | null {
  if (!(now.kw > 0) || !(now.youPay > 0)) return null;
  const battery = now.batteryKwh > 0;
  const like = recent(points, today).filter((p) => alike(p, now));
  const signed = like
    .filter((p) => p.signed)
    .map(measure)
    .sort((a, b) => a - b);
  const quiet = like
    .filter((p) => p.quiet)
    .map(measure)
    .sort((a, b) => a - b);
  if (signed.length < MIN_LIKE || quiet.length < MIN_LIKE) return null;
  const top = signed[signed.length - 1];
  const above = quiet.filter((q) => q > top);
  const mine = measure(now);
  const w = (n: number) => measureWords(n, battery);
  if (above.length >= 3)
    return {
      tone: mine > top ? "warn" : "info",
      text:
        `Above ${w(top)} none of your ${kindWords(battery)} proposals this size signed (${above.length} went quiet). ` +
        (mine > top ? "This one is above that." : `Signed ones sit at ${w(quantile(signed, 0.25))}–${w(quantile(signed, 0.75))}.`),
    };
  return {
    tone: "info",
    text: `Signed ones this size sit at ${w(quantile(signed, 0.25))}–${w(quantile(signed, 0.75))}; ones that went quiet at ${w(quantile(quiet, 0.25))}–${w(quantile(quiet, 0.75))}.`,
  };
}

/** Every check for the quote, in the order shown. The quote's own deal is left out. */
export function priceAdvice(now: QuoteNow, points: PricePoint[], floor: number, today: Date, jobId?: string | null): Advice[] {
  const others = jobId ? points.filter((p) => p.jobId !== jobId) : points;
  return [
    ...marginCheck(now, others, floor, today).filter((a) => a.tone === "warn" && a.text.includes("floor")),
    priceAgainstSigned(now, others, today),
    signedAgainstQuiet(now, others, today),
    ...marginCheck(now, others, floor, today).filter((a) => !a.text.includes("floor")),
  ].filter((a): a is Advice => Boolean(a));
}
