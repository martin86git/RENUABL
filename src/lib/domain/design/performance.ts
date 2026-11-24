import { todayInMarket } from "../market";
import type { ISODate } from "../types";
import { WON_STAGES, INSTALLED_STAGES, type Job } from "./crm";
import { jobHas } from "./customers";

/**
 * Performance on Today's tray (21 Nov 2026, Martin: "i should also be able to toggle the performance dates (set
 * different ranges). and i should be able to customise the fields being reported"). Read by rule from the deals the
 * member may see, each figure against the period before it of the same length. Sales count as the deal-level
 * dashboard does (deal.ts `dashboard`): a deal at a won stage, on the day it was won, at its price with GST.
 */

export const PERF_RANGES = [
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "quarter", label: "This quarter" },
  { id: "last-quarter", label: "Last quarter" },
  { id: "fy", label: "This financial year" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "custom", label: "Custom" },
] as const;
export type PerfRange = (typeof PERF_RANGES)[number]["id"];

export const PERF_METRICS = [
  { id: "sales", label: "Sales", kind: "dollars" },
  { id: "sold", label: "Deals sold", kind: "count" },
  { id: "average", label: "Average deal", kind: "dollars" },
  { id: "kw", label: "kW sold", kind: "kw" },
  { id: "batteries", label: "Batteries sold", kind: "count" },
  { id: "leads", label: "New leads", kind: "count" },
  { id: "conversion", label: "Leads to sales", kind: "share" },
  { id: "installs", label: "Installs done", kind: "count" },
] as const;
export type PerfMetric = (typeof PERF_METRICS)[number]["id"];
export type PerfKind = (typeof PERF_METRICS)[number]["kind"];

/** What Performance shows until the member chooses. */
export const DEFAULT_METRICS: PerfMetric[] = ["sales", "sold", "kw", "leads"];

export interface PerfPeriod {
  from: ISODate;
  to: ISODate;
  /** The period before it of the same length, to compare with. */
  prevFrom: ISODate;
  prevTo: ISODate;
}

const DAY = 86_400_000;
const at = (d: ISODate) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: ISODate, n: number) => iso(at(d) + n * DAY);
const two = (n: number) => String(n).padStart(2, "0");
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** The first of a month `n` months from (y, m), as [year, month]. */
const shift = (y: number, m: number, n: number): [number, number] => {
  const k = y * 12 + (m - 1) + n;
  return [Math.floor(k / 12), (k % 12) + 1];
};
const first = (y: number, m: number) => `${y}-${two(m)}-01`;
const last = (y: number, m: number) => `${y}-${two(m)}-${two(lastDayOf(y, m))}`;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (d: unknown): d is ISODate => typeof d === "string" && ISO_DAY.test(d) && !Number.isNaN(at(d));

/**
 * The days a range covers, up to today, and the period before it. A period still running (this month, quarter or
 * year) is compared with the same number of days of the one before; a finished one with the whole one before.
 */
export function perfPeriod(range: PerfRange, today: ISODate, custom?: { from: ISODate; to: ISODate } | null): PerfPeriod {
  const [y, m, d] = today.split("-").map(Number);
  const running = (from: ISODate, prevFrom: ISODate): PerfPeriod => {
    const days = Math.round((at(today) - at(from)) / DAY);
    return { from, to: today, prevFrom, prevTo: addDays(prevFrom, days) };
  };
  const whole = (from: ISODate, to: ISODate): PerfPeriod => {
    const days = Math.round((at(to) - at(from)) / DAY) + 1;
    return { from, to, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) };
  };
  const quarterStart = (qy: number, qm: number): [number, number] => [qy, qm - ((qm - 1) % 3)];
  switch (range) {
    case "last-month": {
      const [ly, lm] = shift(y, m, -1);
      const [py, pm] = shift(y, m, -2);
      return { from: first(ly, lm), to: last(ly, lm), prevFrom: first(py, pm), prevTo: last(py, pm) };
    }
    case "quarter": {
      const [qy, qm] = quarterStart(y, m);
      const [py, pm] = shift(qy, qm, -3);
      return running(first(qy, qm), first(py, pm));
    }
    case "last-quarter": {
      const [qy, qm] = shift(...quarterStart(y, m), -3);
      const [ey, em] = shift(qy, qm, 2);
      const [py, pm] = shift(qy, qm, -3);
      const [pey, pem] = shift(py, pm, 2);
      return { from: first(qy, qm), to: last(ey, em), prevFrom: first(py, pm), prevTo: last(pey, pem) };
    }
    case "fy": {
      const fy = m >= 7 ? y : y - 1;
      return running(`${fy}-07-01`, `${fy - 1}-07-01`);
    }
    case "30d":
      return whole(addDays(today, -29), today);
    case "90d":
      return whole(addDays(today, -89), today);
    case "custom":
      if (custom && isDay(custom.from) && isDay(custom.to)) {
        const [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
        return whole(from, to > today ? today : to);
      }
      return perfPeriod("month", today);
    default: {
      const [py, pm] = shift(y, m, -1);
      // The same days of last month, never past its end.
      return { from: first(y, m), to: today, prevFrom: first(py, pm), prevTo: `${py}-${two(pm)}-${two(Math.min(d, lastDayOf(py, pm)))}` };
    }
  }
}

export type PerfJob = Pick<Job, "stage" | "value" | "kw" | "wonAt" | "installedAt" | "createdAt" | "title" | "details"> & {
  sample?: boolean;
};

export interface PerfFigure {
  metric: PerfMetric;
  label: string;
  kind: PerfKind;
  value: number | null;
  prev: number | null;
  /** The change on the period before, as a share (0.25 = up a quarter); null with nothing to compare. */
  change: number | null;
}

/** The figures for one period, by metric. */
/**
 * A deal's figures worked out once: its days in the market's time and whether it is sold, installed or has a battery.
 * Turning a time into the market's day goes through Intl, slow enough that doing it for every deal in every bar of the
 * period made Performance wait seconds on a phone with a few thousand deals (22 Nov 2026, Martin).
 */
export interface PerfRow {
  won: ISODate | null;
  created: ISODate | null;
  installed: ISODate | null;
  sold: boolean;
  isInstalled: boolean;
  value: number;
  kw: number;
  battery: boolean;
}

/**
 * What Performance counts from: the deals themselves, or rows already worked out (the small download Today asks for as
 * it opens, so Performance needn't wait for the whole deals list: 22 Nov 2026, Martin, it took a second to open).
 */
export type PerfSource = readonly PerfJob[] | { rows: readonly PerfRow[] };

function rowsOf(source: PerfSource): readonly PerfRow[] {
  return "rows" in source ? source.rows : perfRows(source);
}

/** A row as it travels: [won, created, installed] ("" for none), flags (1 sold, 2 installed, 4 battery), value, kW. */
export type PackedPerfRow = [string, string, string, number, number, number];

export function packPerfRows(rows: readonly PerfRow[]): PackedPerfRow[] {
  return rows.map((r) => [
    r.won ?? "",
    r.created ?? "",
    r.installed ?? "",
    (r.sold ? 1 : 0) | (r.isInstalled ? 2 : 0) | (r.battery ? 4 : 0),
    Math.round(r.value * 100) / 100,
    Math.round(r.kw * 1000) / 1000,
  ]);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayOrNull = (x: unknown): ISODate | null => (typeof x === "string" && DAY_RE.test(x) ? x : null);
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Rows read back from the download; anything not shaped as a row is left out, and anything not a list is null. */
export function unpackPerfRows(raw: unknown): PerfRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PerfRow[] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 6) continue;
    const flags = num(r[3]);
    out.push({
      won: dayOrNull(r[0]),
      created: dayOrNull(r[1]),
      installed: dayOrNull(r[2]),
      sold: (flags & 1) !== 0,
      isInstalled: (flags & 2) !== 0,
      battery: (flags & 4) !== 0,
      value: num(r[4]),
      kw: num(r[5]),
    });
  }
  return out;
}

const dayedCache = new WeakMap<readonly PerfJob[], PerfRow[]>();

/** Every deal but the samples as the rows Performance counts. */
export function perfRows(jobs: readonly PerfJob[]): PerfRow[] {
  const kept = dayedCache.get(jobs);
  if (kept) return kept;
  const days = new Map<string, ISODate>();
  const day = (when: string | null): ISODate | null => {
    if (!when) return null;
    let d = days.get(when);
    if (d === undefined) {
      d = todayInMarket(new Date(when));
      days.set(when, d);
    }
    return d;
  };
  const out = jobs
    .filter((j) => !j.sample)
    .map((j) => {
      const sold = WON_STAGES.includes(j.stage);
      return {
        won: sold ? day(j.wonAt) : null,
        created: day(j.createdAt),
        installed: INSTALLED_STAGES.includes(j.stage) ? day(j.installedAt) : null,
        sold,
        isInstalled: INSTALLED_STAGES.includes(j.stage),
        value: j.value ?? 0,
        kw: j.kw ?? 0,
        battery: sold && jobHas(j).battery,
      };
    });
  dayedCache.set(jobs, out);
  return out;
}

function figuresIn(jobs: readonly PerfRow[], from: ISODate, to: ISODate): Record<PerfMetric, number | null> {
  const inside = (d: ISODate | null) => d !== null && d >= from && d <= to;
  let sold = 0;
  let sales = 0;
  let kw = 0;
  let batteries = 0;
  let leads = 0;
  let installs = 0;
  for (const j of jobs) {
    if (j.sold && inside(j.won)) {
      sold++;
      sales += j.value;
      kw += j.kw;
      if (j.battery) batteries++;
    }
    if (inside(j.created)) leads++;
    if (j.isInstalled && inside(j.installed)) installs++;
  }
  return {
    sales,
    sold,
    average: sold ? Math.round(sales / sold) : null,
    kw: Math.round(kw * 100) / 100,
    batteries,
    leads,
    conversion: leads ? sold / leads : null,
    installs,
  };
}

/** Each metric asked for, in the order asked, for the period and the one before it. Sample deals are left out. */
export function performance(jobs: PerfSource, period: PerfPeriod, metrics: readonly PerfMetric[]): PerfFigure[] {
  const real = rowsOf(jobs);
  const now = figuresIn(real, period.from, period.to);
  const before = figuresIn(real, period.prevFrom, period.prevTo);
  return metrics.map((metric) => {
    const meta = PERF_METRICS.find((x) => x.id === metric)!;
    const value = now[metric];
    const prev = before[metric];
    const change = value === null || prev === null || prev === 0 ? null : (value - prev) / prev;
    return { metric, label: meta.label, kind: meta.kind, value, prev, change };
  });
}

/** The metrics kept on the device, cleaned: known ones, once each, in order; none kept is the defaults. */
export function cleanMetrics(raw: unknown): PerfMetric[] {
  if (!Array.isArray(raw)) return [...DEFAULT_METRICS];
  const known = new Set<string>(PERF_METRICS.map((x) => x.id));
  const out = raw.filter((x): x is PerfMetric => typeof x === "string" && known.has(x)).filter((x, i, all) => all.indexOf(x) === i);
  return out.length ? out : [...DEFAULT_METRICS];
}

/** A range kept on the device, cleaned. */
export function cleanRange(raw: unknown): PerfRange {
  return PERF_RANGES.some((r) => r.id === raw) ? (raw as PerfRange) : "month";
}

const DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
const DATE_YEAR = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "1 Nov to 21 Nov", for under the range; with the year when it isn't `thisYear` or the period spans two. */
export const periodWords = (p: { from: ISODate; to: ISODate }, thisYear?: string) => {
  const year = p.from.slice(0, 4) !== p.to.slice(0, 4) || (thisYear !== undefined && p.from.slice(0, 4) !== thisYear);
  const f = year ? DATE_YEAR : DATE;
  return `${f.format(at(p.from))} to ${f.format(at(p.to))}`;
};

export interface PerfBucket {
  from: ISODate;
  to: ISODate;
  /** Each metric's figure in this stretch of the period. */
  values: Record<PerfMetric, number | null>;
}

/**
 * The period cut into stretches for the small bars under each figure: days up to a month, weeks up to about four
 * months, else calendar months (the first and last cut to the period).
 */
export function perfSeries(jobs: PerfSource, period: { from: ISODate; to: ISODate }): PerfBucket[] {
  const real = rowsOf(jobs);
  const days = Math.round((at(period.to) - at(period.from)) / DAY) + 1;
  const spans: [ISODate, ISODate][] = [];
  if (days <= 31) {
    for (let i = 0; i < days; i++) spans.push([addDays(period.from, i), addDays(period.from, i)]);
  } else if (days <= 120) {
    for (let d = period.from; d <= period.to; d = addDays(d, 7)) {
      const end = addDays(d, 6);
      spans.push([d, end > period.to ? period.to : end]);
    }
  } else {
    let [y, m] = period.from.split("-").map(Number);
    for (;;) {
      const s = first(y, m) < period.from ? period.from : first(y, m);
      if (s > period.to) break;
      const e = last(y, m) > period.to ? period.to : last(y, m);
      spans.push([s, e]);
      [y, m] = shift(y, m, 1);
    }
  }
  return spans.map(([from, to]) => ({ from, to, values: figuresIn(real, from, to) }));
}
