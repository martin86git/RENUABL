/**
 * Sol leads the design (11 Nov 2026, Martin: "Sol needs to try and replace as much of the manual tools as possible,
 * whilst I do the physical placement"; and "the key to this product is also what it does when I say no: it should
 * still allow me down the next path"). Pure, tested.
 *
 * A design is led through a fixed run of steps, each a question with its answers: whether the lot outlined from the land
 * register is the home (18 Nov 2026, Martin), the home (phase, storeys, roof),
 * on a flat roof the Kliplok interfaces and the tilt, the size to aim for (from the customer's bill when it is known),
 * the panel, placing the panels, the target reached, the shade analysis, the inverter, the strings, the battery, and blackout backup.
 * Each step is answered once, yes or no alike, and the next applicable one comes up; a step the design has already
 * done (an inverter on it, every panel strung) is passed over. After the last, Sol's suggestions take over.
 */

import { ASSUMPTIONS } from "../recommendation";
import { BACKUP_MODULE_KWH } from "./quick-size";

export type GuideStepId =
  | "house"
  | "home"
  | "flat"
  | "target"
  | "existing"
  | "panel"
  | "place"
  | "reached"
  | "shade"
  | "inverter"
  | "string"
  | "unstrung"
  | "battery"
  | "backup";

/** The size aimed for: kW of panels, and kWh of battery (0: none). */
export interface GuideTarget {
  kw: number;
  kwh: number;
  /**
   * A second version's battery, sized for the three free hours (12 Nov 2026, Martin): the battery step then makes two
   * designs side by side, one each, so the customer sees both prices.
   */
  freeKwh?: number;
}

/** The free hours a day some retailers offer (12 Nov 2026, Martin: "the 3 hour free electricity window"). */
export const FREE_HOURS = 3;

/** A battery as Sol names it in the two versions: how many, which, and what they hold together. */
export interface VersionBattery {
  qty: number;
  name: string;
  /** What one holds, kWh. */
  kwh: number;
}

/**
 * The two versions as Sol lists them (19 Nov 2026, Martin: "this can be written clearer… v1: 1x Sigenergy 8.0kW
 * SigenStor Battery Module (7kWh - charged by solar surplus) v2: 2x … (16kWh - charged by 3x free grid charge hours)"):
 * one line each, the count, the battery and what they hold together, and how it is charged.
 */
export function versionLines(v1: VersionBattery, v2: VersionBattery | null, v2Kwh: number): { v1: string; v2: string } {
  const holds = (b: VersionBattery) => Math.round(b.qty * b.kwh * 10) / 10;
  return {
    v1: `${v1.qty}× ${v1.name} (${holds(v1)} kWh, charged by the solar surplus)`,
    v2: v2
      ? `${v2.qty}× ${v2.name} (${holds(v2)} kWh, charged in the ${FREE_HOURS} free grid hours)`
      : `A bigger battery (about ${v2Kwh} kWh, charged in the ${FREE_HOURS} free grid hours)`,
  };
}
/** The share of what panels make that is spare once the home has used its share as it's made: Martin's 60%. */
export const SPARE_SHARE = 1 - ASSUMPTIONS.baseSelfConsumption;

/** The battery for a size of panels, with and without the free hours, and the figures behind it. */
export interface GuideBattery {
  /** Filled by the panels alone: what a winter day's spare fills, so it fills all year; kWh, whole. */
  solarKwh: number;
  /**
   * With the three free hours: the grid tops it up free each day, so neither the panels' winter spare nor the evenings
   * are the limit (19 Nov 2026, Martin: even when the evenings don't need it, filled free it is a reserve for blackouts
   * at no running cost, so it is offered on the bill as on a size). An average day's spare, never under the solar one
   * with a module more (`BACKUP_MODULE_KWH`).
   */
  freeKwh: number;
  /** What of the free-hours battery is more than the evenings take: a reserve for blackouts, when the evenings are known. */
  reserveKwh: number | null;
  /** What the panels spare on an average day and on a winter day, kWh. */
  spareKwh: number;
  winterSpareKwh: number;
  /** What the home uses after dark, when known. */
  eveningKwh: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const toBattery = (stored: number) => Math.max(5, Math.ceil(stored / ASSUMPTIONS.batteryUsableShare - 1e-9));

/**
 * The battery a size of panels points to (12 Nov 2026, Martin: "if I enter a PV kW the battery should propose itself;
 * by rule of thumb 60% will be surplus"). Never more than the home uses after dark, when its use is known. Rules of
 * thumb only (`ASSUMPTIONS`); null without panels.
 */
export function batteryForKw(kw: number, kwhPerDay?: number | null): GuideBattery | null {
  if (!(kw > 0)) return null;
  const spare = kw * ASSUMPTIONS.dailyYieldKwhPerKw * SPARE_SHARE;
  const winter = spare * ASSUMPTIONS.winterSunShare;
  const evening = kwhPerDay && kwhPerDay > 0 ? kwhPerDay * ASSUMPTIONS.eveningShare : null;
  const solarKwh = toBattery(evening !== null ? Math.min(winter, evening) : winter);
  const freeKwh = Math.max(solarKwh + BACKUP_MODULE_KWH, toBattery(spare), toBattery(evening ?? 0));
  const reserve = evening !== null ? Math.floor(freeKwh * ASSUMPTIONS.batteryUsableShare - evening) : null;
  return {
    solarKwh,
    freeKwh,
    reserveKwh: reserve !== null && reserve > 0 ? reserve : null,
    spareKwh: round1(spare),
    winterSpareKwh: round1(winter),
    eveningKwh: evening === null ? null : round1(evening),
  };
}

/** What the free-hours battery is for, under the choices. */
export function freeHoursWords(b: GuideBattery): string {
  const top = `With the ${FREE_HOURS} free hours the grid tops the battery up free each day, so it can be bigger: it stores more, and costs more.`;
  return b.reserveKwh ? `${top} About ${b.reserveKwh} kWh is more than their evenings take: a reserve for blackouts, filled free.` : top;
}

/** The battery's line under the boxes: what the panels spare, and what the free hours change. */
export function batteryWords(b: GuideBattery): string {
  const spare = `The panels spare about ${Math.round(b.spareKwh)} kWh on an average day, ${Math.round(b.winterSpareKwh)} in winter.`;
  return b.eveningKwh !== null ? `${spare} They use about ${Math.round(b.eveningKwh)} kWh after dark.` : spare;
}

/** What the design and the deal say right now. */
export interface GuideFacts {
  /** There is an address to confirm: Sol asks "Is this the home?" first, with the land register's lot outlined when it answers. */
  lot?: boolean;
  roof: "tile" | "tin" | "flat";
  /** The size Sol suggests from the bill (null without one), and the bill in words for the line. */
  suggested: (GuideTarget & { spend: string | null }) | null;
  /** The size aimed for, once set on the target step. */
  target: GuideTarget | null;
  panels: number;
  kw: number;
  inverters: number;
  /** The roof check found panels already on the roof (12 Nov 2026, Martin: replace them or work around them?). */
  existingSolar?: boolean;
  /** Panels on the design not on a string, once there is an inverter. */
  unstrung: number;
  /** Why Sol's stringing left panels, a phrase each, when it did (12 Nov 2026, Martin: it left four and said nothing). */
  leftWhy?: string[];
  battery: { kwh: number; backup?: boolean } | null;
}

/** Answered: the steps done with, yes or no. */
export type GuideAnswered = readonly GuideStepId[];

/** The step to show now, or null when the run is done. */
export function guideStep(answered: GuideAnswered, facts: GuideFacts): GuideStepId | null {
  const open = (id: GuideStepId) => !answered.includes(id);
  // Is this the home? Asked first, and still asked when the register answers late, until panels go down.
  if (facts.lot && open("house") && open("place") && facts.panels === 0) return "house";
  if (open("home")) return "home";
  if (facts.roof === "flat" && open("flat")) return "flat";
  if (open("target")) return "target";
  if (open("existing") && open("place") && facts.existingSolar) return "existing";
  if (open("panel")) return "panel";
  if (open("place")) return "place";
  // Placing: the target reached (or panels down with no target) asks whether placing is done.
  if (open("reached")) {
    const reached = facts.target ? facts.kw >= facts.target.kw - 0.01 : facts.panels > 0;
    if (!reached) return null;
    return "reached";
  }
  // The shade analysis, once the panels are down (19 Nov 2026, Martin: "commence shade analysis yes / no").
  if (open("shade") && facts.panels > 0) return "shade";
  if (open("inverter") && facts.panels > 0 && !facts.inverters) return "inverter";
  if (open("string") && facts.inverters > 0 && facts.unstrung > 0) return "string";
  if (open("unstrung") && answered.includes("string") && facts.unstrung > 0 && facts.leftWhy?.length) return "unstrung";
  if (open("battery") && !facts.battery && (facts.target?.kwh ?? 0) > 0) return "battery";
  if (open("backup") && facts.battery && facts.battery.backup === undefined) return "backup";
  return null;
}

/** Whether the run is still going: a step to show, or panels still being placed towards the target. */
export function guiding(answered: GuideAnswered, facts: GuideFacts): boolean {
  return guideStep(answered, facts) !== null || (answered.includes("place") && !answered.includes("reached"));
}

/** Panels for a kW at a panel's watts, whole panels, at least one. */
export const panelsFor = (kw: number, watts: number) => Math.max(1, Math.ceil((kw * 1000) / (watts || 475) - 1e-9));

/** The line the target step opens with. */
export function targetWords(first: string | null, suggested: GuideFacts["suggested"]): string {
  const who = first ?? "They";
  if (!suggested) return "I don't have their bill yet. Add it, or set the system size.";
  const size = `${suggested.kw} kW of panels${suggested.kwh > 0 ? ` with a ${suggested.kwh} kWh battery` : ""}`;
  return suggested.spend ? `${who} ${first ? "spends" : "spend"} ${suggested.spend}, so we should aim for ${size}.` : `Aim for ${size}.`;
}

/** What Sol says when his stringing left panels: how many, and why. */
export function unstrungWords(left: number, why: readonly string[]): string {
  return `I couldn't string ${left === 1 ? "one panel" : `${left} panels`}: ${why.join("; ")}.`;
}

/** Whether panels were left for want of an inverter input: an inverter with more inputs would take them. */
export const wantsInputs = (why: readonly string[]) => why.some((w) => /input/.test(w));

/** The line once the target is reached: more panels only add cost. */
export function reachedWords(kw: number, target: GuideTarget | null): string {
  return target
    ? `Target reached: ${Math.round(kw * 100) / 100} kW of ${target.kw} kW. More panels only drive the cost up.`
    : `${Math.round(kw * 100) / 100} kW on the roof. Done placing?`;
}

/**
 * What Sol says over a row of panels while it is being dragged out (16 Nov 2026, Martin: "as panels are being dragged
 * to form an array, sol should let me know how many panels left"; he was counting them before letting go). `laying`
 * is the panels in the row now, `placed` those already on the roof; with a target it says how many more to reach it,
 * that the row reaches it, or how many it goes over.
 */
export function layingWords(
  laying: number,
  placed: number,
  watts: number,
  target: GuideTarget | null,
): { row: string; left: string | null; state: "short" | "on" | "over" | "none" } {
  const total = laying + placed;
  const kw = Math.round((total * (watts || 475)) / 10) / 100;
  const row = `${laying} ${laying === 1 ? "panel" : "panels"} · ${kw.toFixed(2)} kW${placed ? " in all" : ""}`;
  if (!target || !(target.kw > 0)) return { row, left: null, state: "none" };
  const need = panelsFor(target.kw, watts) - total;
  if (need > 0) return { row, left: `${need} more to reach ${target.kw} kW`, state: "short" };
  if (need === 0) return { row, left: `Target reached: ${target.kw} kW`, state: "on" };
  return { row, left: `${-need} over the ${target.kw} kW target`, state: "over" };
}

/** One cell of the panels-to-go bar: laid already, in the row being dragged out, still to lay, or past the target. */
export type PanelCell = "laid" | "laying" | "empty" | "over";

/** The most cells drawn; past it the bar says how many more as "+N". */
export const MAX_PANEL_CELLS = 40;

/**
 * The panels-to-go bar (19 Nov 2026, Martin: "small panel placeholders (like battery cells) being filled that represent
 * the number of panels to go"): a cell a panel of the target, filled as they go down, and cells past it marked over.
 * Null without a target. `toGo` is how many more reach it, `over` how many past it.
 */
export function panelCells(
  laid: number,
  laying: number,
  watts: number,
  target: GuideTarget | null,
): { cells: PanelCell[]; more: number; toGo: number; over: number } | null {
  if (!target || !(target.kw > 0)) return null;
  const need = panelsFor(target.kw, watts);
  const total = laid + laying;
  const all: PanelCell[] = [];
  for (let i = 0; i < Math.max(need, total); i++) all.push(i >= need ? "over" : i < laid ? "laid" : i < total ? "laying" : "empty");
  return {
    cells: all.slice(0, MAX_PANEL_CELLS),
    more: Math.max(0, all.length - MAX_PANEL_CELLS),
    toGo: Math.max(0, need - total),
    over: Math.max(0, total - need),
  };
}

/** The words beside the bar: only what is still to do, or how far past it. */
export function cellWords(c: { toGo: number; over: number }): string {
  if (c.over > 0) return `${c.over} over`;
  if (c.toGo === 0) return "On target";
  return `${c.toGo} to go`;
}
