/**
 * The home's day (10 Nov 2026, Martin: the roof design is one dimension of what a design shows; the second is time).
 * A design played through one day, half hour by half hour: where the sun is, which panels it reaches, what they make,
 * what the home uses, what goes into the battery and comes out of it, and what the grid still supplies. Pure, tested.
 *
 * It is a modelled day, and says so wherever it is shown. What the panels make over the day is the designer's own
 * figure for that month (so it agrees with the output shown everywhere else), shaped through the day by where the sun
 * is and how squarely it meets each panel, and then lessened by whatever stands in the sun's way when the heights are
 * to hand. What the home uses is its daily use from the bill laid on a typical household's pattern, not this home's
 * own hours: a customer's smart-meter data would make that real. No dollars are worked out here.
 */
import { MONTH_MID_DAYS, sunPosition, type SunPosition } from "./shade";

/** The days the seasons are shown by: the middle of January, of April and of June. */
export const DAY_SEASONS = [
  { id: "summer", label: "Summer", month: 0 },
  { id: "mid", label: "Autumn", month: 3 },
  { id: "winter", label: "Winter", month: 5 },
] as const;
export type DaySeason = (typeof DAY_SEASONS)[number]["id"];

/** Half hours in a day, and the hours each stands for. */
export const DAY_STEPS = 48;
const STEP_HOURS = 24 / DAY_STEPS;

/**
 * A typical household's use through the day, hour by hour from midnight (shares of the day, made to add to 1):
 * a low night, a morning rise, a quiet middle and the evening's peak. PLACEHOLDER: a common shape, not a
 * measurement of any home; about six tenths of it falls outside 7am to 5pm, in step with the evening share the
 * savings rules use.
 */
export const USE_SHAPE = [
  2.2, 2.0, 1.9, 1.9, 2.0, 2.4, 3.6, 4.8, 4.4, 3.6, 3.3, 3.2, 3.3, 3.2, 3.2, 3.6, 4.6, 6.2, 7.4, 7.6, 6.9, 5.6, 4.2, 3.0,
] as const;

/**
 * How far the clock runs ahead of the sun in Victoria: Melbourne sits west of its time zone's meridian (about 20
 * minutes), and daylight saving adds an hour from October to March. VERIFY before use outside Victoria.
 */
export function clockAheadOfSun(month: number): number {
  const daylightSaving = month >= 9 || month <= 2;
  return 0.35 + (daylightSaving ? 1 : 0);
}

export interface DayPanel {
  /** Its size, kW. */
  kw: number;
  /** Degrees up from flat, and the way it faces, clockwise from north. */
  tilt: number;
  facing: number;
}

export interface HomeDayInput {
  /** South is negative. */
  latitude: number;
  /** 0 is January. */
  month: number;
  panels: readonly DayPanel[];
  /** What the design makes on an average day of this month, kWh, by the designer's own figures (no shade in them). */
  dayKwh: number;
  /** What the home uses a day, kWh, when the bill is in. */
  homeDayKwh: number | null;
  /** What the battery can give and take in a day, kWh (its size less anything held for blackouts, at its usable share). */
  batteryKwh: number;
  /** Whether something stands between a panel and the sun at a moment, when the heights round the roof are known. */
  shaded?: (panel: number, sun: SunPosition) => boolean;
}

export interface DayStep {
  /** The clock's hour at the middle of the step (0 to 24). */
  hour: number;
  sun: SunPosition;
  /** kW, averaged over the step. */
  solar: number;
  use: number;
  /** Of the solar: used by the home as it is made, put into the battery, sent to the grid. */
  direct: number;
  charge: number;
  exported: number;
  /** Of the home's use: from the battery, from the grid. */
  discharge: number;
  imported: number;
  /** What the battery holds at the end of the step, kWh, and as a share of what it can hold. */
  level: number;
  share: number;
  /** Each panel's output as a share of the best any panel does in the day: 0 in the dark or in shade. */
  glow: number[];
}

export interface HomeDay {
  steps: DayStep[];
  /** The day's totals, kWh. */
  solarKwh: number;
  useKwh: number;
  directKwh: number;
  fromBatteryKwh: number;
  importedKwh: number;
  exportedKwh: number;
  /** The share of the day's sun on the panels lost to things in its way (0 when the heights aren't known). */
  shadeLoss: number;
  /** The clock's hour the sun first and last reaches a panel, when it does. */
  firstLight: number | null;
  lastLight: number | null;
  /** The clock's hour the battery fills, and the hour it runs out after dark; null when it never does. */
  fullAt: number | null;
  emptyAt: number | null;
  /** The most the panels and the home reach in the day, kW: for drawing them to one scale. */
  peakKw: number;
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/** The home's use at a clock hour, as a share of the day's use an hour: between the hours it runs straight from one to the next. */
export function shareOfUseAt(hour: number): number {
  const total = USE_SHAPE.reduce((a, b) => a + b, 0);
  // Each figure is its hour's middle.
  const at = (((hour - 0.5) % 24) + 24) % 24;
  const a = Math.floor(at);
  const b = (a + 1) % 24;
  const t = at - a;
  return (USE_SHAPE[a] * (1 - t) + USE_SHAPE[b] * t) / total;
}

/**
 * How strongly the sun falls on a panel at a moment, in no particular unit: the beam (weaker low in the sky, through
 * more air) by how squarely it meets the panel, plus the light of the open sky, which shade doesn't stop.
 */
function sunOn(panel: DayPanel, sun: SunPosition, shaded: boolean): number {
  if (sun.elevation <= 0) return 0;
  const el = rad(sun.elevation);
  const az = rad(sun.azimuth);
  const tilt = rad(panel.tilt);
  const facing = rad(panel.facing);
  const square =
    Math.sin(tilt) * Math.sin(facing) * Math.cos(el) * Math.sin(az) +
    Math.sin(tilt) * Math.cos(facing) * Math.cos(el) * Math.cos(az) +
    Math.cos(tilt) * Math.sin(el);
  const airMass = 1 / Math.max(Math.sin(el), 0.05);
  const beam = shaded ? 0 : 0.7 ** (airMass ** 0.678) * Math.max(0, square);
  const sky = 0.12 * Math.sin(el) * ((1 + Math.cos(tilt)) / 2);
  return beam + sky;
}

/** A design's day. With no panels the home still has its day; with no bill the panels still have theirs. */
export function homeDay(input: HomeDayInput): HomeDay {
  const month = Math.max(0, Math.min(11, Math.round(input.month)));
  const ahead = clockAheadOfSun(month);
  const day = MONTH_MID_DAYS[month];
  const panels = input.panels;
  const homeKwh = input.homeDayKwh && input.homeDayKwh > 0 ? input.homeDayKwh : 0;
  const holds = Math.max(0, input.batteryKwh);

  // The sun on each panel at each step, open and as shaded.
  const suns: SunPosition[] = [];
  const open: number[][] = [];
  const reached: number[][] = [];
  for (let i = 0; i < DAY_STEPS; i++) {
    const hour = (i + 0.5) * STEP_HOURS;
    const sun = sunPosition(input.latitude, day, hour - ahead);
    suns.push(sun);
    open.push(panels.map((p) => sunOn(p, sun, false) * p.kw));
    reached.push(panels.map((p, n) => sunOn(p, sun, sun.elevation > 0 && input.shaded ? input.shaded(n, sun) : false) * p.kw));
  }
  const sum = (rows: number[][]) => rows.reduce((all, row) => all + row.reduce((a, b) => a + b, 0), 0);
  const openAll = sum(open);
  const reachedAll = sum(reached);
  // The day's output is the designer's own figure, shaped by the open sun; shade then takes its share away.
  const scale = openAll > 0 ? Math.max(0, input.dayKwh) / (openAll * STEP_HOURS) : 0;
  // The most any panel gets at any moment, for each kW of it: what a panel's glow is measured against.
  const best = Math.max(0, ...open.flatMap((row) => row.map((v, n) => (panels[n].kw > 0 ? v / panels[n].kw : 0))));

  // Twice through, so the battery starts the day as the day before left it.
  let level = 0;
  let steps: DayStep[] = [];
  for (let pass = 0; pass < 2; pass++) {
    steps = [];
    for (let i = 0; i < DAY_STEPS; i++) {
      const hour = (i + 0.5) * STEP_HOURS;
      const solar = reached[i].reduce((a, b) => a + b, 0) * scale;
      const use = homeKwh * shareOfUseAt(hour);
      const direct = Math.min(solar, use);
      const spare = solar - direct;
      const short = use - direct;
      const charge = Math.min(spare, (holds - level) / STEP_HOURS);
      const discharge = Math.min(short, level / STEP_HOURS);
      level = Math.max(0, Math.min(holds, level + (charge - discharge) * STEP_HOURS));
      steps.push({
        hour,
        sun: suns[i],
        solar,
        use,
        direct,
        charge,
        exported: spare - charge,
        discharge,
        imported: short - discharge,
        level,
        share: holds > 0 ? level / holds : 0,
        glow: reached[i].map((v, n) => (best > 0 && panels[n].kw > 0 ? Math.min(1, v / panels[n].kw / best) : 0)),
      });
    }
  }

  const total = (of: (s: DayStep) => number) => round(steps.reduce((a, s) => a + of(s), 0) * STEP_HOURS, 1);
  const lit = steps.filter((s) => s.glow.some((g) => g > 0.02));
  const fullAt = holds > 0 ? (steps.find((s) => s.share >= 0.995)?.hour ?? null) : null;
  // It runs out when, after it last held something, the home is left drawing on the grid with the sun down.
  let emptyAt: number | null = null;
  if (holds > 0 && homeKwh > 0) {
    const afterNoon = steps.findIndex((s) => s.hour >= 12);
    const order = [...steps.slice(afterNoon), ...steps.slice(0, afterNoon)];
    const had = order.findIndex((s) => s.level > 0.01);
    const out = had < 0 ? -1 : order.findIndex((s, n) => n > had && s.level <= 0.01 && s.imported > 0.01);
    emptyAt = out >= 0 ? order[out].hour : null;
  }
  return {
    steps,
    solarKwh: total((s) => s.solar),
    useKwh: total((s) => s.use),
    directKwh: total((s) => s.direct),
    fromBatteryKwh: total((s) => s.discharge),
    importedKwh: total((s) => s.imported),
    exportedKwh: total((s) => s.exported),
    shadeLoss: openAll > 0 ? round(Math.max(0, 1 - reachedAll / openAll), 3) : 0,
    firstLight: lit.length ? lit[0].hour : null,
    lastLight: lit.length ? lit[lit.length - 1].hour : null,
    fullAt,
    emptyAt,
    peakKw: round(Math.max(0.1, ...steps.map((s) => Math.max(s.solar, s.use))), 2),
  };
}

/** A clock hour in words: "6:30 am", "12 noon", "7 pm". */
export function clockWords(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  let whole = Math.floor(h);
  let minutes = Math.round(((h - whole) * 60) / 15) * 15;
  if (minutes === 60) {
    minutes = 0;
    whole = (whole + 1) % 24;
  }
  if (minutes === 0 && whole === 12) return "12 noon";
  if (minutes === 0 && whole === 0) return "midnight";
  const twelve = whole % 12 === 0 ? 12 : whole % 12;
  return `${twelve}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${whole < 12 ? "am" : "pm"}`;
}

/** What is happening at a moment, in a line for each part: the sun, the home, the battery, the grid. */
export function momentWords(
  step: DayStep,
  hasBattery: boolean,
  hasHome: boolean,
): { sun: string; home: string; battery: string; grid: string } {
  const kw = (n: number) => `${n >= 9.95 ? Math.round(n) : (Math.round(n * 10) / 10).toFixed(1)} kW`;
  const sun = step.sun.elevation <= 0 ? "Sun down" : step.solar < 0.05 ? "No sun on the panels" : `Panels ${kw(step.solar)}`;
  const home = hasHome ? `Home ${kw(step.use)}` : "";
  const pct = `${Math.round(step.share * 100)}%`;
  const battery = !hasBattery
    ? ""
    : step.charge > 0.05
      ? `Battery charging ${kw(step.charge)} · ${pct}`
      : step.discharge > 0.05
        ? `Battery running the home ${kw(step.discharge)} · ${pct}`
        : step.share >= 0.995
          ? "Battery full"
          : step.share <= 0.005
            ? "Battery empty"
            : `Battery ${pct}`;
  const grid = !hasHome
    ? ""
    : step.imported > 0.05
      ? `Grid supplying ${kw(step.imported)}`
      : step.exported > 0.05
        ? `Sending ${kw(step.exported)} to the grid`
        : "Nothing from the grid";
  return { sun, home, battery, grid };
}

/**
 * The day in a sentence or two, for under its chart: what it makes against what the home uses, and how the battery
 * fares. Never that the home needs nothing from the grid: a modelled day isn't a promise. `yours` words it for the
 * customer reading their own proposal.
 */
export function dayWords(day: HomeDay, season: string, hasBattery: boolean, yours = false): string[] {
  const k = (n: number) => `${n >= 99.5 ? Math.round(n) : Math.round(n * 10) / 10} kWh`;
  const home = yours ? "your home" : "the home";
  const lines: string[] = [];
  if (day.solarKwh <= 0) lines.push(`No panels on the design yet: this is ${home}'s day without them.`);
  else if (day.useKwh > 0)
    lines.push(`A ${season.toLowerCase()} day: the panels make about ${k(day.solarKwh)} and ${home} uses about ${k(day.useKwh)}.`);
  else lines.push(`A ${season.toLowerCase()} day: the panels make about ${k(day.solarKwh)}.`);
  if (day.useKwh > 0 && day.solarKwh > 0) {
    if (hasBattery) {
      if (day.fromBatteryKwh < 0.1) lines.push("The battery gets nothing to store on a day like this.");
      else if (day.emptyAt !== null)
        lines.push(`The battery carries the evening until about ${clockWords(day.emptyAt)}, then the grid takes over.`);
      else
        lines.push(
          yours
            ? "On a day like this the battery is estimated to carry your home through the night."
            : "The battery carries the home through the night on a day like this.",
        );
    } else if (day.exportedKwh > 0.5) lines.push(`About ${k(day.exportedKwh)} goes to the grid unused, and the evening runs on the grid.`);
    if (day.importedKwh >= 0.1) lines.push(`About ${k(day.importedKwh)} still comes from the grid.`);
  }
  if (day.shadeLoss >= 0.02) lines.push(`Shade takes about ${Math.round(day.shadeLoss * 100)}% of the day's sun off the panels.`);
  return lines;
}

/** What goes under the day wherever it is shown: what it is, and what it isn't. */
export const DAY_NOTE = "A modelled day: the home's hours follow a typical household, not this home's own.";
/** The same for a customer reading their proposal: an estimate, with what it leaves out. */
export const DAY_NOTE_YOURS =
  "A modelled day, to show how the system works with your home. An estimate, nothing guaranteed: your hours follow a typical household's, not your own, it leaves out shade, and real days vary with the weather.";
/** With no bill entered, the home's side of the day isn't known. */
export const DAY_NO_BILL = "Add the customer's bill to see the home's side of the day.";
