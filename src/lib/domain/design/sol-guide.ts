/**
 * Sol leads the design (11 Nov 2026, Martin: "Sol needs to try and replace as much of the manual tools as possible,
 * whilst I do the physical placement"; and "the key to this product is also what it does when I say no: it should
 * still allow me down the next path"). Pure, tested.
 *
 * A design is led through a fixed run of steps, each a question with its answers: the home (phase, storeys, roof),
 * on a flat roof the Kliplok interfaces and the tilt, the size to aim for (from the customer's bill when it is known),
 * the panel, placing the panels, the target reached, the inverter, the strings, the battery, and blackout backup.
 * Each step is answered once, yes or no alike, and the next applicable one comes up; a step the design has already
 * done (an inverter on it, every panel strung) is passed over. After the last, Sol's suggestions take over.
 */

import { ASSUMPTIONS } from "../recommendation";

export type GuideStepId =
  "home" | "flat" | "target" | "panel" | "place" | "reached" | "inverter" | "string" | "unstrung" | "battery" | "backup";

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
/** The share of what panels make that is spare once the home has used its share as it's made: Martin's 60%. */
export const SPARE_SHARE = 1 - ASSUMPTIONS.baseSelfConsumption;

/** The battery for a size of panels, with and without the free hours, and the figures behind it. */
export interface GuideBattery {
  /** Filled by the panels alone: what a winter day's spare fills, so it fills all year; kWh, whole. */
  solarKwh: number;
  /**
   * With the three free hours: the grid tops it up free each day, so the panels' winter spare isn't the limit. Sized
   * to the evenings when the home's use is known, else to an average day's spare; never smaller than the solar one.
   */
  freeKwh: number;
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
  const freeKwh = Math.max(solarKwh, toBattery(evening ?? spare));
  return {
    solarKwh,
    freeKwh,
    spareKwh: round1(spare),
    winterSpareKwh: round1(winter),
    eveningKwh: evening === null ? null : round1(evening),
  };
}

/** The battery's line under the boxes: what the panels spare, and what the free hours change. */
export function batteryWords(b: GuideBattery): string {
  const spare = `The panels spare about ${Math.round(b.spareKwh)} kWh on an average day, ${Math.round(b.winterSpareKwh)} in winter.`;
  return b.eveningKwh !== null ? `${spare} They use about ${Math.round(b.eveningKwh)} kWh after dark.` : spare;
}

/** What the design and the deal say right now. */
export interface GuideFacts {
  roof: "tile" | "tin" | "flat";
  /** The size Sol suggests from the bill (null without one), and the bill in words for the line. */
  suggested: (GuideTarget & { spend: string | null }) | null;
  /** The size aimed for, once set on the target step. */
  target: GuideTarget | null;
  panels: number;
  kw: number;
  inverters: number;
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
  if (open("home")) return "home";
  if (facts.roof === "flat" && open("flat")) return "flat";
  if (open("target")) return "target";
  if (open("panel")) return "panel";
  if (open("place")) return "place";
  // Placing: the target reached (or panels down with no target) asks whether placing is done.
  if (open("reached")) {
    const reached = facts.target ? facts.kw >= facts.target.kw - 0.01 : facts.panels > 0;
    if (!reached) return null;
    return "reached";
  }
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
