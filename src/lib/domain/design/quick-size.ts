/**
 * The calculator in the top bar (8 Nov 2026, Martin: on the phone and asked a question, asking Sol is a wait and a
 * long answer; this answers at once): a bill or a day's use in, a rough system out, and plain sums. Rules of thumb
 * only, from the same assumptions the homeowner plan uses (`ASSUMPTIONS` in recommendation.ts: Melbourne's average
 * sunshine, 40% used as it's made, the battery sized for a winter evening, 90% of it usable). Never a design.
 */
import { ASSUMPTIONS } from "../recommendation";
import { SPEND_ASSUMPTIONS } from "../spend-estimate";

export type BillPeriod = "month" | "two-months" | "quarter";

export const BILL_PERIODS: { id: BillPeriod; label: string; days: number }[] = [
  { id: "month", label: "Month", days: 30.4 },
  { id: "two-months", label: "2 months", days: 60.8 },
  { id: "quarter", label: "Quarter", days: 91.3 },
];

/** What the calculator starts with: the usual rate and supply charge, editable. */
export const QUICK_DEFAULTS = {
  rateCents: Math.round(SPEND_ASSUMPTIONS.usageRate * 100),
  supplyPerDay: SPEND_ASSUMPTIONS.supplyPerDay,
  panelWatts: ASSUMPTIONS.panelWatts,
};

/** Inverter sizes a rough answer rounds up to, in kW. */
export const INVERTER_STEPS = [3, 5, 6, 8, 10, 15] as const;
/** The most panels a system is given here, so a huge bill doesn't come back as a commercial roof. */
export const MAX_QUICK_KW = 20;

export interface QuickInput {
  /** Use a day in kWh, when known; else worked out from the bill. */
  kwhPerDay?: number | null;
  bill?: number | null;
  period?: BillPeriod;
  rateCents?: number;
  supplyPerDay?: number;
  panelWatts?: number;
}

export interface QuickSize {
  kwhPerDay: number;
  /** True when the day's use was worked out from a bill. */
  fromBill: boolean;
  yearKwh: number;
  solar: { kw: number; panels: number; inverterKw: number };
  /** Solar sized so a winter day's spare fills the battery for the evening. */
  withBattery: { kw: number; panels: number; inverterKw: number; batteryKwh: number; eveningKwh: number };
  /** Hit the ceiling: worth a proper look. */
  capped: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The day's use from a bill: what was spent less the supply charge, at the rate. Null when it can't be read. */
export function dailyFromBill(bill: number, period: BillPeriod, rateCents: number, supplyPerDay: number): number | null {
  const days = BILL_PERIODS.find((p) => p.id === period)?.days;
  if (!days || !(bill > 0) || !(rateCents > 0)) return null;
  const usage = bill / days - Math.max(0, supplyPerDay);
  return usage > 0 ? usage / (rateCents / 100) : null;
}

const panelsFor = (kw: number, watts: number) => Math.ceil((kw * 1000) / watts - 1e-9);
const inverterFor = (kw: number, ratio: number) => INVERTER_STEPS.find((s) => s * ratio >= kw - 1e-9) ?? INVERTER_STEPS.at(-1)!;

/** A rough system from a bill or a day's use; null until there is something to work from. */
export function quickSize(input: QuickInput): QuickSize | null {
  const watts = input.panelWatts && input.panelWatts > 100 ? input.panelWatts : QUICK_DEFAULTS.panelWatts;
  let daily = input.kwhPerDay && input.kwhPerDay > 0 ? input.kwhPerDay : null;
  const fromBill = daily === null;
  if (daily === null && input.bill)
    daily = dailyFromBill(
      input.bill,
      input.period ?? "quarter",
      input.rateCents ?? QUICK_DEFAULTS.rateCents,
      input.supplyPerDay ?? QUICK_DEFAULTS.supplyPerDay,
    );
  if (daily === null || !(daily > 0)) return null;

  const sun = ASSUMPTIONS.dailyYieldKwhPerKw;
  // Solar only: the least that makes a year's use at average sunshine, never under the smallest system.
  const soloKw = Math.max(ASSUMPTIONS.minSystemKw, daily / sun);
  // With a battery: the evening's use (after dark), filled from a winter day's spare.
  const evening = daily * ASSUMPTIONS.eveningShare;
  const winterSpare = sun * ASSUMPTIONS.winterSunShare * (1 - ASSUMPTIONS.baseSelfConsumption);
  const batteryKw = Math.max(soloKw, evening / winterSpare);
  const capped = soloKw > MAX_QUICK_KW || batteryKw > MAX_QUICK_KW;
  const solarPanels = panelsFor(Math.min(soloKw, MAX_QUICK_KW), watts);
  const batteryPanels = panelsFor(Math.min(batteryKw, MAX_QUICK_KW), watts);
  const kwOf = (panels: number) => round1((panels * watts) / 1000);
  return {
    kwhPerDay: round1(daily),
    fromBill,
    yearKwh: Math.round(daily * 365),
    solar: { kw: kwOf(solarPanels), panels: solarPanels, inverterKw: inverterFor(kwOf(solarPanels), 1.33) },
    withBattery: {
      kw: kwOf(batteryPanels),
      panels: batteryPanels,
      inverterKw: inverterFor(kwOf(batteryPanels), 1.5),
      batteryKwh: Math.ceil(evening / ASSUMPTIONS.batteryUsableShare),
      eveningKwh: round1(evening),
    },
    capped,
  };
}

/**
 * A sum typed in the calculator ("450*4/365", "(1200-300)*0.9", "15%" of nothing is 0.15): numbers, + - * / %,
 * brackets and spaces only. Read by hand, never `eval`. Null when it isn't a whole sum or divides by nothing.
 */
export function sumOf(text: string): number | null {
  const src = text.replace(/,/g, "").replace(/\s+/g, "").replace(/[×x]/g, "*").replace(/÷/g, "/");
  if (!src || src.length > 200 || !/^[\d.+\-*/%()]+$/.test(src)) return null;
  let at = 0;
  const peek = () => src[at];
  const number = (): number | null => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(at));
    if (!m) return null;
    at += m[0].length;
    let n = Number(m[0]);
    if (peek() === "%") {
      at++;
      n /= 100;
    }
    return Number.isFinite(n) ? n : null;
  };
  const factor = (): number | null => {
    if (peek() === "-") {
      at++;
      const f = factor();
      return f === null ? null : -f;
    }
    if (peek() === "+") {
      at++;
      return factor();
    }
    if (peek() === "(") {
      at++;
      const e = expr();
      if (e === null || peek() !== ")") return null;
      at++;
      return e;
    }
    return number();
  };
  const term = (): number | null => {
    let left = factor();
    while (left !== null && (peek() === "*" || peek() === "/")) {
      const op = src[at++];
      const right = factor();
      if (right === null) return null;
      if (op === "/" && right === 0) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };
  function expr(): number | null {
    let left = term();
    while (left !== null && (peek() === "+" || peek() === "-")) {
      const op = src[at++];
      const right = term();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  const value = expr();
  return value !== null && at === src.length && Number.isFinite(value) ? value : null;
}

/** A sum's answer as people read it: up to 4 decimal places, grouped thousands. */
export const sumWords = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 4 });

/**
 * A system from its size (9 Nov 2026, Martin: "a calculator that would emerge out of Sol, with input fields: PV kW,
 * battery yes / no, size the battery or allow for backup, whatever fields are needed to design a system"). The solar's
 * kW in; the panels, inverter and battery it takes out, by the same rules of thumb. Never a design.
 */
export type BatteryChoice = "none" | "solar" | "backup";

export const BATTERY_CHOICES: { id: BatteryChoice; label: string; detail: string }[] = [
  { id: "none", label: "No battery", detail: "Solar only" },
  { id: "solar", label: "Battery", detail: "Filled by the solar" },
  { id: "backup", label: "With backup", detail: "+8 kWh for blackouts" },
];

/** One battery module held back for blackouts (the 8 kWh modules most stackable batteries come in; VERIFY per battery). */
export const BACKUP_MODULE_KWH = 8;
/** The most solar a single-phase home exports without the network's approval or export limiting (VERIFY per network). */
export const SINGLE_PHASE_KW = 5;

export interface KwInput {
  kw: number;
  battery: BatteryChoice;
  phase: "single" | "three";
  /** The home's use a day, when known: the battery is then never larger than its evenings. */
  kwhPerDay?: number | null;
  panelWatts?: number;
}

export interface KwSize {
  kw: number;
  panels: number;
  inverterKw: number;
  hybrid: boolean;
  /** What the solar makes on an average day and in a year, kWh. */
  dayKwh: number;
  yearKwh: number;
  /** What a winter day's spare could put into a battery, kWh. */
  winterSpareKwh: number;
  /** The battery to fit, kWh (nominal), with the part of it held for blackouts; null without one. */
  batteryKwh: number | null;
  backupKwh: number | null;
  /** The share of a year's use the solar makes, when the use is known (never over 100). */
  yearShare: number | null;
  /** What the home uses after dark, kWh, when its use is known. */
  eveningKwh: number | null;
  /** The battery was kept to the evenings: the solar could fill more than they use after dark. */
  toEvenings: boolean;
  /** Over the single-phase export size: the network's pre-approval or export limiting is likely needed. */
  exportCheck: boolean;
  /** The kW asked for was over what the calculator goes to. */
  overMax: boolean;
  /** Things to know: export limits, a battery capped by the evenings. */
  notes: string[];
}

export function sizeFromKw(input: KwInput): KwSize | null {
  if (!(input.kw > 0)) return null;
  const watts = input.panelWatts && input.panelWatts > 100 ? input.panelWatts : QUICK_DEFAULTS.panelWatts;
  const panels = panelsFor(Math.min(input.kw, MAX_QUICK_KW), watts);
  const kw = round1((panels * watts) / 1000);
  const hybrid = input.battery !== "none";
  const sun = ASSUMPTIONS.dailyYieldKwhPerKw;
  const dayKwh = round1(kw * sun);
  const winterSpareKwh = round1(kw * sun * ASSUMPTIONS.winterSunShare * (1 - ASSUMPTIONS.baseSelfConsumption));
  const notes: string[] = [];
  let batteryKwh: number | null = null;
  let backupKwh: number | null = null;
  const evening = input.kwhPerDay && input.kwhPerDay > 0 ? input.kwhPerDay * ASSUMPTIONS.eveningShare : null;
  const toEvenings = hybrid && evening !== null && evening < winterSpareKwh;
  if (hybrid) {
    const fill = evening !== null ? Math.min(winterSpareKwh, evening) : winterSpareKwh;
    if (toEvenings) notes.push(`Battery sized to the ${round1(evening!)} kWh they use after dark: a bigger one wouldn't be used.`);
    batteryKwh = Math.max(5, Math.ceil(fill / ASSUMPTIONS.batteryUsableShare));
    if (input.battery === "backup") {
      backupKwh = BACKUP_MODULE_KWH;
      batteryKwh += BACKUP_MODULE_KWH;
    }
  }
  const overMax = input.kw > MAX_QUICK_KW;
  if (overMax) notes.push(`Kept to ${MAX_QUICK_KW} kW here: worth a proper look in the designer.`);
  const exportCheck = input.phase === "single" && kw > SINGLE_PHASE_KW;
  if (exportCheck)
    notes.push(`Over ${SINGLE_PHASE_KW} kW on single phase: the network's pre-approval or export limiting is likely needed.`);
  const use = input.kwhPerDay && input.kwhPerDay > 0 ? input.kwhPerDay * 365 : null;
  return {
    kw,
    panels,
    inverterKw: inverterFor(kw, hybrid ? 1.5 : 1.33),
    hybrid,
    dayKwh,
    yearKwh: Math.round(dayKwh * 365),
    winterSpareKwh,
    batteryKwh,
    backupKwh,
    yearShare: use ? Math.min(100, Math.round((dayKwh * 365 * 100) / use)) : null,
    eveningKwh: evening !== null ? round1(evening) : null,
    toEvenings,
    exportCheck,
    overMax,
    notes,
  };
}

/**
 * The solar Sol puts in the calculator from the home's use (10 Nov 2026, Martin: "Sol should recommend the system size
 * based on consumption, then allow me to overwrite"): with a battery, enough to fill it on a winter day; without, about
 * a year's use. The same rules as `quickSize`; null until the use is known.
 */
export interface KwPick {
  kw: number;
  why: string;
}

export function recommendKw(kwhPerDay: number | null | undefined, battery: BatteryChoice): KwPick | null {
  const size = kwhPerDay && kwhPerDay > 0 ? quickSize({ kwhPerDay }) : null;
  if (!size) return null;
  if (battery !== "none")
    return {
      kw: size.withBattery.kw,
      why: `Enough for ${size.kwhPerDay} kWh a day with a winter day's spare to fill the battery for the evening.`,
    };
  const smallest = size.yearKwh / ASSUMPTIONS.dailyYieldKwhPerKw / 365 < ASSUMPTIONS.minSystemKw;
  return {
    kw: size.solar.kw,
    why: smallest
      ? `${size.kwhPerDay} kWh a day is covered by the smallest system.`
      : `About a year's use (${size.yearKwh.toLocaleString("en-AU")} kWh) at Melbourne's average sunshine.`,
  };
}

/** Below this many kWh after dark a battery is slow to pay its way, so Sol leads with solar alone. */
export const EVENING_WORTH_STORING = 5;

/**
 * What Sol says as the designer opens on a home whose use he knows (9 Nov 2026, Martin: "tell you that it's read from
 * the notes the customer's consumption and therefore recommends solar + battery and the size and why"): the system he'd
 * lead with and the reasons, from `quickSize`. Plain words; every figure a rule of thumb.
 */
export interface OpeningAdvice {
  lead: "battery" | "solar";
  headline: string;
  why: string[];
}

export function openingAdvice(size: QuickSize): OpeningAdvice {
  const evening = size.withBattery.eveningKwh;
  const day = `They use about ${size.kwhPerDay} kWh a day (${size.yearKwh.toLocaleString("en-AU")} kWh a year).`;
  if (evening >= EVENING_WORTH_STORING)
    return {
      lead: "battery",
      headline: `I'd go solar and a battery: about ${size.withBattery.kw} kW with a ${size.withBattery.batteryKwh} kWh battery.`,
      why: [
        day,
        `About ${evening} kWh of that is after dark, which solar alone can't cover: the battery holds it.`,
        `${size.withBattery.kw} kW leaves enough spare on a winter day to fill it; solar alone would be ${size.solar.kw} kW.`,
      ],
    };
  return {
    lead: "solar",
    headline: `I'd start with solar alone: about ${size.solar.kw} kW.`,
    why: [
      day,
      `Their evenings are small (about ${evening} kWh after dark), so a battery would be slow to pay its way.`,
      `${size.solar.kw} kW makes about a year's use at Melbourne's average sunshine.`,
    ],
  };
}
