import type { InverterSpec, Point } from "./roof-design";

/**
 * How far each inverter stands from the main switchboard (26 Nov 2026, Martin: "when a switchboard icon is input as
 * the actual location it should allow for a distance to be calculated between the inverter location and the msb").
 * Measured on the drawing from above, in a straight line, mark to mark: the cable runs further (round walls, up and
 * down), so it is a guide to the run, never the cable length to order.
 */
export interface MsbRun {
  /** The inverter's place in the design's list. */
  index: number;
  from: Point;
  to: Point;
  /** Metres in a straight line, to the tenth. */
  metres: number;
}

/** Only inverters put in their place count: one still in its waiting spot beside the picture hasn't been placed. */
export function msbRuns(inverters: Pick<InverterSpec, "x" | "y">[], msb: Point | null | undefined): MsbRun[] {
  if (!msb) return [];
  return inverters.flatMap((spec, index) => {
    if (typeof spec.x !== "number" || typeof spec.y !== "number") return [];
    const from = { x: spec.x, y: spec.y };
    const metres = Math.round(Math.hypot(msb.x - from.x, msb.y - from.y) * 10) / 10;
    return [{ index, from, to: msb, metres }];
  });
}

/** "8.4 m", or "under 1 m" when the two are side by side. */
export function runWords(metres: number): string {
  return metres < 1 ? "under 1 m" : `${metres.toFixed(1)} m`;
}

export const RUN_NOTE = "In a straight line from above. The cable runs further, round walls and up and down.";
