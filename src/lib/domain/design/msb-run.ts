import type { InverterSpec, Point } from "./roof-design";
import { MAX_ROUTE_BENDS } from "./roof-design";

/**
 * How far each inverter's cable runs to the main switchboard (26 Nov 2026, Martin: "when a switchboard icon is input
 * as the actual location it should allow for a distance to be calculated between the inverter location and the msb";
 * then "pull the gold line to change its route… from different points to make it run in different directions").
 * Measured on the drawing from above, mark to mark through any bends dragged into the line: up and down a wall isn't
 * in it, so it is a guide to the run, never the cable length to order.
 */
export interface MsbRun {
  /** The inverter's place in the design's list. */
  index: number;
  from: Point;
  to: Point;
  /** Every point the line passes through: the inverter, its bends, the switchboard. */
  points: Point[];
  /** How many bends were dragged into it. */
  bends: number;
  /** Metres along the line, to the tenth. */
  metres: number;
}

const gap = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Only inverters put in their place count: one still in its waiting spot beside the picture hasn't been placed. */
export function msbRuns(inverters: Pick<InverterSpec, "x" | "y" | "route">[], msb: Point | null | undefined): MsbRun[] {
  if (!msb) return [];
  return inverters.flatMap((spec, index) => {
    if (typeof spec.x !== "number" || typeof spec.y !== "number") return [];
    const from = { x: spec.x, y: spec.y };
    const route = spec.route ?? [];
    const points = [from, ...route, msb];
    let total = 0;
    for (let i = 1; i < points.length; i++) total += gap(points[i - 1], points[i]);
    return [{ index, from, to: msb, points, bends: route.length, metres: Math.round(total * 10) / 10 }];
  });
}

/** "8.4 m", or "under 1 m" when the two are side by side. */
export function runWords(metres: number): string {
  return metres < 1 ? "under 1 m" : `${metres.toFixed(1)} m`;
}

export const RUN_NOTE =
  "Along the line from above. Drag the line to bend it round the house, double click a bend to take it away. The cable runs further, up and down walls.";

/** Where a press lands on a run: on one of its bends, on the line between two points (a new bend goes in there), or neither. */
export type RunHit = { kind: "bend"; bend: number } | { kind: "line"; insertAt: number } | null;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return gap(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * What a press at `p` takes hold of, within `reach` metres. Bends win over the line; the ends (the inverter and the
 * switchboard) are left to their own marks. A full run takes no more bends.
 */
export function hitRun(run: MsbRun, p: Point, reach: number): RunHit {
  for (let i = 1; i < run.points.length - 1; i++) if (gap(p, run.points[i]) <= reach) return { kind: "bend", bend: i - 1 };
  if (run.bends >= MAX_ROUTE_BENDS) return null;
  let best: { at: number; d: number } | null = null;
  for (let i = 1; i < run.points.length; i++) {
    const d = distanceToSegment(p, run.points[i - 1], run.points[i]);
    // Not right on top of either end, where a press means the inverter or the switchboard.
    if (d <= reach && gap(p, run.points[0]) > reach * 1.5 && gap(p, run.points[run.points.length - 1]) > reach * 1.5)
      if (!best || d < best.d) best = { at: i - 1, d };
  }
  return best ? { kind: "line", insertAt: best.at } : null;
}

/** Where the length is written: the middle of the run's longest stretch. */
export function labelAt(run: MsbRun): Point {
  let best = 0;
  let at = { x: (run.from.x + run.to.x) / 2, y: (run.from.y + run.to.y) / 2 };
  for (let i = 1; i < run.points.length; i++) {
    const a = run.points[i - 1];
    const b = run.points[i];
    const d = gap(a, b);
    if (d > best) {
      best = d;
      at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return at;
}
