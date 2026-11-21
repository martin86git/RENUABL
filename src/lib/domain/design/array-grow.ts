/**
 * Growing an array from its sides (21 Nov 2026, Martin: a drag either adds panels or pivots, so rows need their own
 * move). Pure, tested in `array-grow.test.ts`.
 *
 * Panels picked together that lie on one grid (the same way round, the same tilt, a whole number of steps apart) have
 * a handle on each side. Dragging a handle out copies the row or column on that side, one for each step dragged;
 * dragging it in takes rows or columns away, never the last one.
 */
import { planSize, type LoosePanel, type PanelSize, type Point } from "./roof-design";

/** A side of the array in its own frame: across its rows (left, right) or along them (top, bottom). */
export type GrowSide = "left" | "right" | "top" | "bottom";
export const GROW_SIDES: readonly GrowSide[] = ["left", "right", "top", "bottom"];

/** The most rows or columns one drag adds. */
export const GROW_MAX = 40;

export interface ArrayFrame {
  /** The first panel, where the grid is counted from. */
  origin: Point;
  /** The panels' angle, in degrees. */
  angle: number;
  stepX: number;
  stepY: number;
  /** A panel's size from above. */
  w: number;
  h: number;
  /** Each panel's place on the grid, by its id. */
  cells: Record<string, { i: number; j: number }>;
  iMin: number;
  iMax: number;
  jMin: number;
  jMax: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const cm = (n: number) => Math.round(n * 100) / 100;

/** The grid a group of panels lies on, or null when they don't lie on one. */
export function arrayFrame(group: readonly LoosePanel[], size: PanelSize): ArrayFrame | null {
  const first = group[0];
  if (!first) return null;
  const plan = planSize(first, size);
  const stepX = plan.w + size.gap;
  const stepY = plan.h + size.gap;
  const a = rad(first.angle);
  const cells: ArrayFrame["cells"] = {};
  const taken = new Set<string>();
  for (const p of group) {
    const turned = Math.abs(((p.angle - first.angle + 540) % 360) - 180);
    if (turned > 0.5 || Boolean(p.across) !== Boolean(first.across) || (p.tilt ?? null) !== (first.tilt ?? null)) return null;
    const dx = p.x - first.x;
    const dy = p.y - first.y;
    const fi = (dx * Math.cos(a) + dy * Math.sin(a)) / stepX;
    const fj = (-dx * Math.sin(a) + dy * Math.cos(a)) / stepY;
    const i = Math.round(fi);
    const j = Math.round(fj);
    if (Math.abs(fi - i) > 0.12 || Math.abs(fj - j) > 0.12 || taken.has(`${i}:${j}`)) return null;
    taken.add(`${i}:${j}`);
    cells[p.id] = { i, j };
  }
  const all = Object.values(cells);
  return {
    origin: { x: first.x, y: first.y },
    angle: first.angle,
    stepX,
    stepY,
    w: plan.w,
    h: plan.h,
    cells,
    iMin: Math.min(...all.map((c) => c.i)),
    iMax: Math.max(...all.map((c) => c.i)),
    jMin: Math.min(...all.map((c) => c.j)),
    jMax: Math.max(...all.map((c) => c.j)),
  };
}

/** A point of the frame's own grid (in steps) as a point on the roof. */
const onRoof = (f: ArrayFrame, lx: number, ly: number): Point => {
  const a = rad(f.angle);
  return { x: f.origin.x + lx * Math.cos(a) - ly * Math.sin(a), y: f.origin.y + lx * Math.sin(a) + ly * Math.cos(a) };
};

/** The way out from a side, as a unit vector on the roof, and the step a row or column on that side takes. */
export function growWay(f: ArrayFrame, side: GrowSide): { out: Point; step: number } {
  const a = rad(f.angle);
  const x = { x: Math.cos(a), y: Math.sin(a) };
  const y = { x: -Math.sin(a), y: Math.cos(a) };
  if (side === "right") return { out: x, step: f.stepX };
  if (side === "left") return { out: { x: -x.x, y: -x.y }, step: f.stepX };
  if (side === "bottom") return { out: y, step: f.stepY };
  return { out: { x: -y.x, y: -y.y }, step: f.stepY };
}

/** Where each side's handle sits: the middle of that side, `off` metres out from the panels' edge. */
export function growHandles(f: ArrayFrame, off: number): { side: GrowSide; at: Point }[] {
  const midX = ((f.iMin + f.iMax) / 2) * f.stepX;
  const midY = ((f.jMin + f.jMax) / 2) * f.stepY;
  return [
    { side: "left", at: onRoof(f, f.iMin * f.stepX - f.w / 2 - off, midY) },
    { side: "right", at: onRoof(f, f.iMax * f.stepX + f.w / 2 + off, midY) },
    { side: "top", at: onRoof(f, midX, f.jMin * f.stepY - f.h / 2 - off) },
    { side: "bottom", at: onRoof(f, midX, f.jMax * f.stepY + f.h / 2 + off) },
  ];
}

/** How many rows or columns a drag of a side's handle from `from` to `p` comes to: out adds, in takes away. */
export function growCount(f: ArrayFrame, side: GrowSide, from: Point, p: Point): number {
  const { out, step } = growWay(f, side);
  const n = Math.round(((p.x - from.x) * out.x + (p.y - from.y) * out.y) / step);
  const across = side === "left" || side === "right";
  const has = across ? f.iMax - f.iMin + 1 : f.jMax - f.jMin + 1;
  return Math.max(1 - has, Math.min(GROW_MAX, n)) || 0;
}

/**
 * The group with `n` rows or columns added on a side (copies of the one on that side), or taken away when `n` is
 * under zero. Panels kept keep their ids; new ones are named from `seed`, the same each time, so a drag that passes
 * through the same count twice makes the same panels.
 */
export function growArray<T extends LoosePanel>(group: readonly T[], f: ArrayFrame, side: GrowSide, n: number, seed: string): T[] {
  if (!n) return [...group];
  const across = side === "left" || side === "right";
  const outward = side === "right" || side === "bottom";
  const edge = across ? (outward ? f.iMax : f.iMin) : outward ? f.jMax : f.jMin;
  const at = (p: T) => (across ? f.cells[p.id].i : f.cells[p.id].j);
  if (n < 0) {
    // Those within |n| of the side go.
    return group.filter((p) => (outward ? at(p) <= edge + n : at(p) >= edge - n));
  }
  const { out, step } = growWay(f, side);
  const from = group.filter((p) => at(p) === edge);
  const added: T[] = [];
  for (let k = 1; k <= n; k++) {
    from.forEach((p, m) => {
      added.push({ ...p, id: `${seed}${side[0]}${k}x${m}`, x: cm(p.x + out.x * step * k), y: cm(p.y + out.y * step * k) });
    });
  }
  return [...group, ...added];
}
