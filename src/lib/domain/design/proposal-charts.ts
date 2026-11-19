/**
 * The proposal's charts, drawn RENUABL's way (19 Nov 2026, Martin: the output chart "looks exactly the way Pylon would
 * present it"; "imagine RENUABL were the sister company of SpaceX, Tesla and Apple: what would our analytics look like";
 * "allow for the colours to be customised… a second alternative graph… apply this approach to other parts of the
 * proposal"). Pure, tested: the colours a chart is drawn in, the home's use set month by month beside the output, and
 * the words a tapped month reads. Nothing here works out an estimate of its own: every figure is the proposal's.
 */

/** The colours a chart can be drawn in: the sun (ours), the business's two colours, or two of its own. */
export const CHART_TONES = [
  { id: "sun", name: "Sun", blurb: "Orange rising to gold." },
  { id: "brand", name: "Your colours", blurb: "Your main colour into your accent." },
  { id: "own", name: "Pick two", blurb: "Any two colours you like." },
] as const;
export type ChartTone = (typeof CHART_TONES)[number]["id"];

export const SUN_FROM = "#ff5a1f";
export const SUN_TO = "#ffb23f";

/** The two colours a chart is drawn in, from the bottom of a bar to its top. */
export function chartColours(t: { chartTone?: ChartTone; chartFrom?: string; chartTo?: string; primary: string; accent: string }): {
  from: string;
  to: string;
} {
  if (t.chartTone === "brand") return { from: t.primary, to: t.accent };
  if (t.chartTone === "own" && isHex(t.chartFrom) && isHex(t.chartTo)) return { from: t.chartFrom!, to: t.chartTo! };
  return { from: SUN_FROM, to: SUN_TO };
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * What the home uses each month, from its daily use as the bill gives it. The same every day, as the proposal's own
 * figures assume ("The same use every day"), so it never claims a season the bill doesn't show.
 */
export function monthlyUse(dailyKwh: number): number[] {
  return MONTH_DAYS.map((d) => Math.round(dailyKwh * d));
}

const kwh = (n: number) => `${Math.round(n).toLocaleString("en-AU")} kWh`;

/** The line under the big figure: the year, or a month; with the home's use when it is shown. */
export function readoutWords(p: { kwh: number[]; month: number | null; use: number[] | null }): string {
  const year = p.kwh.reduce((a, b) => a + b, 0);
  if (p.month === null) {
    const day = `About ${kwh(year / 365)} on an average day.`;
    if (!p.use) return day;
    return `${day} The home uses about ${kwh(p.use.reduce((a, b) => a + b, 0))} a year.`;
  }
  const made = p.kwh[p.month];
  const day = `About ${kwh(made / MONTH_DAYS[p.month])} a day.`;
  if (!p.use) return day;
  const gap = made - p.use[p.month];
  return gap >= 0
    ? `About ${kwh(gap)} more than the home uses: the rest goes to the battery or the grid.`
    : `About ${kwh(-gap)} less than the home uses: that comes from the battery or the grid.`;
}

/** The sunniest and darkest months, and an average day's output. */
export function yearFacts(kwhs: number[]): { best: number; worst: number; dayKwh: number } {
  const best = kwhs.indexOf(Math.max(...kwhs));
  const worst = kwhs.indexOf(Math.min(...kwhs));
  return { best, worst, dayKwh: Math.round(kwhs.reduce((a, b) => a + b, 0) / 365) };
}

/** A month's output in a day, whole kWh. */
export const dayOf = (kwhs: number[], month: number) => Math.round(kwhs[month] / MONTH_DAYS[month]);

/**
 * The payback line under the saving: how far through it each year is, up to the payback year, and the years after it
 * ahead, as shares of a run of `span` years. Null without a payback.
 */
export function paybackRun(years: number | null, span = 10): { paid: number; span: number } | null {
  if (years === null || !(years > 0)) return null;
  const s = Math.max(span, Math.ceil(years) + 2);
  return { paid: Math.min(1, years / s), span: s };
}
