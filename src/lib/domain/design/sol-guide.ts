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

export type GuideStepId = "home" | "flat" | "target" | "panel" | "place" | "reached" | "inverter" | "string" | "battery" | "backup";

/** The size aimed for: kW of panels, and kWh of battery (0: none). */
export interface GuideTarget {
  kw: number;
  kwh: number;
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
  if (!suggested) return "I don't have their bill yet. Set the size to aim for, or add the bill.";
  const size = `${suggested.kw} kW of panels${suggested.kwh > 0 ? ` with a ${suggested.kwh} kWh battery` : ""}`;
  return suggested.spend ? `${who} ${first ? "spends" : "spend"} ${suggested.spend}, so we should aim for ${size}.` : `Aim for ${size}.`;
}

/** The line once the target is reached: more panels only add cost. */
export function reachedWords(kw: number, target: GuideTarget | null): string {
  return target
    ? `Target reached: ${Math.round(kw * 100) / 100} kW of ${target.kw} kW. More panels only drive the cost up.`
    : `${Math.round(kw * 100) / 100} kW on the roof. Done placing?`;
}
