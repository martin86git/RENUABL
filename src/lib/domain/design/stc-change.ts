/**
 * STC changes, and the installation period new quotes are priced for (22 Nov 2026, Martin: "we need STC change
 * notifications").
 *
 * The federal rebate is worked out for the day a system is installed: solar by the deeming years of the install year
 * (they step down every 1 January), a battery by the factor for the install date. A quote made in November for an
 * install in January is overstated when it is priced on November's figures. So: a rule that says when the next change
 * is and what it is, read only from the rebate rules the product already loads (`RebateRates`); a business setting,
 * `QuoteSettings.stcFrom`, for the first install day new quotes are priced for; and the notice built from both.
 *
 * Nothing here is a figure of our own: where the rules don't say what comes next, nothing is said. Every dollar
 * figure is an estimate at the business's own price per certificate. Pure, tested.
 */
import { batteryFactor, type RebateRates } from "../rebates";
import type { ISODate } from "../types";
import { cleanStcFrom } from "./pricing";
import { stcValue } from "./quote";

export { cleanStcFrom };

/** One day on which the rebate rules change. */
export interface StcChange {
  /** The first install day on the new figures. */
  on: ISODate;
  /** Solar's deeming years, before and from that day; null when they don't change or the rules don't give both. */
  solar: { from: number; to: number } | null;
  /** The battery's certificates per usable kWh, before and from that day; null as above. */
  battery: { from: number; to: number } | null;
}

/** The notice starts this many days before a change (8 weeks: a proposal's month to sign and a month to install). */
export const NOTICE_DAYS_BEFORE = 56;
/** And is still said this many days after it. */
export const NOTICE_DAYS_AFTER = 30;
/** "Later" puts it away this long, for that person. */
export const LATER_DAYS = 7;
/** The systems the drop is shown for: a usual home's solar, and a usual battery. Sizes only, for an example. */
export const TYPICAL = { solarKw: 6.6, batteryKwh: 16 } as const;

const DAY = 86_400_000;
const at = (iso: ISODate) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day: ISODate, n: number): ISODate => iso(at(day) + n * DAY);
export const daysBetween = (from: ISODate, to: ISODate) => Math.round((at(to) - at(from)) / DAY);
const isDay = (v: unknown): v is ISODate => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(at(v)) === v;

/** Every change the rules give, soonest first. */
export function stcChanges(rates: RebateRates): StcChange[] {
  const years = rates.stc.deemingYears;
  const days = new Set<ISODate>();
  for (const y of Object.keys(years)) if (/^\d{4}$/.test(y) && String(Number(y) - 1) in years) days.add(`${y}-01-01`);
  for (const p of rates.stc.batteryFactors) if (isDay(p.from)) days.add(p.from);
  const out: StcChange[] = [];
  for (const on of [...days].sort()) {
    const before = addDays(on, -1);
    const [yFrom, yTo] = [years[before.slice(0, 4)], years[on.slice(0, 4)]];
    const solar = typeof yFrom === "number" && typeof yTo === "number" && yFrom !== yTo ? { from: yFrom, to: yTo } : null;
    const [bFrom, bTo] = [batteryFactor(before, rates), batteryFactor(on, rates)];
    const battery = bFrom > 0 && bTo > 0 && bFrom !== bTo ? { from: bFrom, to: bTo } : null;
    if (solar || battery) out.push({ on, solar, battery });
  }
  return out;
}

/** The next change after today; null when the rules give none. */
export const nextStcChange = (today: ISODate, rates: RebateRates): StcChange | null => stcChanges(rates).find((c) => c.on > today) ?? null;

/** The latest change on or before today. */
export const lastStcChange = (today: ISODate, rates: RebateRates): StcChange | null =>
  stcChanges(rates)
    .filter((c) => c.on <= today)
    .pop() ?? null;

/**
 * The install day a quote is priced for: the business's chosen first day while it is still to come, else today.
 * A period that has passed is never priced for, so a setting left alone prices on the day's own figures.
 */
export const stcPricingDate = (stcFrom: ISODate | null | undefined, today: ISODate): ISODate =>
  stcFrom && stcFrom > today ? stcFrom : today;

/** The run of install days that share one set of figures: from a change (null before the first) to the day before the next. */
export function stcPeriod(day: ISODate, rates: RebateRates): { from: ISODate | null; to: ISODate | null } {
  const next = nextStcChange(day, rates);
  return { from: lastStcChange(day, rates)?.on ?? null, to: next ? addDays(next.on, -1) : null };
}

const D = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
const DY = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "1 January", and with its year. */
export const dayWords = (day: ISODate) => D.format(new Date(at(day)));
export const dayYearWords = (day: ISODate) => DY.format(new Date(at(day)));

/** The period a quote is priced for, in words: "installs up to 31 December 2026", "installs from 1 January 2027". */
export function pricedForWords(stcFrom: ISODate | null | undefined, today: ISODate, rates: RebateRates): string {
  const date = stcPricingDate(stcFrom, today);
  const { to } = stcPeriod(date, rates);
  if (date > today) return `installs from ${dayYearWords(date)}${to ? ` to ${dayYearWords(to)}` : ""}`;
  return to ? `installs up to ${dayYearWords(to)}` : "installs from today";
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** How much less a system gets from the change, in dollars at the business's certificate price. An estimate. */
export function stcDrop(
  system: { pvKw: number; batteryKwh: number },
  postcode: string | null,
  change: StcChange,
  rates: RebateRates,
  stcPrice: number,
): number {
  return stcValue(system, postcode, addDays(change.on, -1), rates, stcPrice) - stcValue(system, postcode, change.on, rates, stcPrice);
}

/** The drop on the usual systems, rounded to $10: solar alone, and a battery alone. 0 where that part doesn't change. */
export function typicalDrop(change: StcChange, rates: RebateRates, stcPrice: number): { solar: number; battery: number } {
  return {
    solar: change.solar ? round10(stcDrop({ pvKw: TYPICAL.solarKw, batteryKwh: 0 }, null, change, rates, stcPrice)) : 0,
    battery: change.battery ? round10(stcDrop({ pvKw: 0, batteryKwh: TYPICAL.batteryKwh }, null, change, rates, stcPrice)) : 0,
  };
}

/** What changes, in a sentence: "Solar's deeming years go from 5 to 4, and the battery factor from 6.8 to 5.7." */
export function changeWords(change: StcChange): string {
  const parts = [
    change.solar && `solar's deeming years go from ${change.solar.from} to ${change.solar.to}`,
    change.battery && `the battery factor ${change.solar ? "" : "goes "}from ${change.battery.from} to ${change.battery.to}`,
  ].filter(Boolean) as string[];
  const said = parts.join(", and ");
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/** The drop on the usual systems, in a sentence; "" when it comes to nothing. Always "about". */
export function dropWords(change: StcChange, rates: RebateRates, stcPrice: number): string {
  const d = typicalDrop(change, rates, stcPrice);
  const parts = [
    d.solar > 0 && `about ${money(d.solar)} less on a ${TYPICAL.solarKw} kW system`,
    d.battery > 0 && `about ${money(d.battery)} less on a ${TYPICAL.batteryKwh} kWh battery`,
  ].filter(Boolean) as string[];
  return parts.length ? `That is ${parts.join(" and ")}, at your price per certificate. An estimate.` : "";
}

/** Whether the change lowers what customers get (the rules only ever step down, but a rise would be said as a change). */
const lowers = (c: StcChange) => (c.solar ? c.solar.to < c.solar.from : true) && (c.battery ? c.battery.to < c.battery.from : true);

export interface StcNoticeInput {
  today: ISODate;
  rates: RebateRates;
  /** The business's setting (`QuoteSettings.stcFrom`). */
  stcFrom: ISODate | null;
  stcPrice: number;
  /** The install day each proposal out and not yet signed was priced for. */
  unsigned: readonly ISODate[];
}

export interface StcNotice {
  /** What it is about, so "Later" is kept for this notice alone. */
  key: string;
  kind: "coming" | "passed";
  change: StcChange;
  /** Days until the change, or since it. */
  days: number;
  title: string;
  /** What has happened, what is about to, in that order. */
  lines: string[];
  /** What is needed from the person; null when nothing is. */
  needed: string | null;
  /** The setting it offers: new quotes priced for installs from this day. Null when there is nothing to apply. */
  apply: { stcFrom: ISODate; label: string } | null;
  /** Proposals out, not signed, priced on the figures before the change. */
  outOld: number;
}

/**
 * The notice for a day, or null: from `NOTICE_DAYS_BEFORE` days ahead of a change, and for `NOTICE_DAYS_AFTER` after
 * one. Once new quotes are priced for the new period and no unsigned proposal is on the old figures, there is nothing
 * to say.
 */
export function stcNotice(input: StcNoticeInput): StcNotice | null {
  const { today, rates } = input;
  const coming = nextStcChange(today, rates);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  if (coming && daysBetween(today, coming.on) <= NOTICE_DAYS_BEFORE) {
    const days = daysBetween(today, coming.on);
    const outOld = input.unsigned.filter((d) => d < coming.on).length;
    const switched = stcPricingDate(input.stcFrom, today) >= coming.on;
    if (switched && outOld === 0) return null;
    const when = dayWords(coming.on);
    const verb = lowers(coming) ? "decrease" : "change";
    const out =
      outOld > 0
        ? `${outOld} ${plural(outOld, "proposal", "proposals")} not yet signed ${plural(outOld, "is", "are")} priced on the figures before ${when}. Nothing already sent has been changed.`
        : null;
    return {
      key: `coming:${coming.on}`,
      kind: "coming",
      change: coming,
      days,
      title: `STCs ${verb} on ${when}`,
      lines: [
        switched
          ? `New quotes are already priced for installs from ${when}.`
          : `New quotes are priced for ${pricedForWords(input.stcFrom, today, rates)}.`,
        `${changeWords(coming)} ${dropWords(coming, rates, input.stcPrice)}`.trim(),
        ...(out ? [out] : []),
      ],
      needed: switched
        ? `Publish ${plural(outOld, "it", "them")} again if ${plural(outOld, "its install", "their installs")} will land after ${when}.`
        : `Once your installs are booking past ${when}, price new quotes for the new figures.`,
      apply: switched ? null : { stcFrom: coming.on, label: `Price new quotes for installs from ${when}` },
      outOld,
    };
  }
  const passed = lastStcChange(today, rates);
  if (passed && daysBetween(passed.on, today) <= NOTICE_DAYS_AFTER) {
    const outOld = input.unsigned.filter((d) => d < passed.on).length;
    const when = dayWords(passed.on);
    return {
      key: `passed:${passed.on}`,
      kind: "passed",
      change: passed,
      days: daysBetween(passed.on, today),
      title: `STCs ${lowers(passed) ? "decreased" : "changed"} on ${when}`,
      lines: [
        `${changeWords(passed)} ${dropWords(passed, rates, input.stcPrice)}`.trim(),
        `New quotes have been priced on the new figures since ${when}.`,
        ...(outOld > 0
          ? [
              `${outOld} ${plural(outOld, "proposal", "proposals")} not yet signed ${plural(outOld, "was", "were")} priced on the old figures. Nothing already sent has been changed.`,
            ]
          : []),
      ],
      needed:
        outOld > 0 ? `Publish ${plural(outOld, "it", "them")} again to price ${plural(outOld, "it", "them")} on the new figures.` : null,
      apply: null,
      outOld,
    };
  }
  return null;
}

/** The day "Later" brings the notice back: a week on, but never past the change itself. */
export function laterUntil(notice: Pick<StcNotice, "kind" | "change">, today: ISODate): ISODate {
  const week = addDays(today, LATER_DAYS);
  return notice.kind === "coming" && week > notice.change.on ? notice.change.on : week;
}

/** Whether a notice put away until a day is still away. */
export const putAway = (key: string, kept: { key: string; until: ISODate } | null, today: ISODate) =>
  Boolean(kept && kept.key === key && today < kept.until);

/**
 * The quote builder's line under "After STCs": what the figure is priced for, and, when a change is near and the
 * quote is still on the earlier figures, what this very system would get after it.
 */
export function quoteStcLine(o: {
  today: ISODate;
  rates: RebateRates;
  stcFrom: ISODate | null | undefined;
  stcPrice: number;
  system: { pvKw: number; batteryKwh: number };
  postcode: string | null;
}): { pricedFor: string; warn: string | null; near: StcChange | null; ahead: boolean } {
  const date = stcPricingDate(o.stcFrom, o.today);
  const ahead = date > o.today;
  const next = nextStcChange(o.today, o.rates);
  const near = next && daysBetween(o.today, next.on) <= NOTICE_DAYS_BEFORE ? next : null;
  let warn: string | null = null;
  if (near && date < near.on) {
    const less = stcDrop(o.system, o.postcode, near, o.rates, o.stcPrice);
    if (less > 0) warn = `An install from ${dayWords(near.on)} gets about ${money(less)} less in STCs on this system.`;
  }
  return { pricedFor: `STCs priced for ${pricedForWords(o.stcFrom, o.today, o.rates)}`, warn, near, ahead };
}
