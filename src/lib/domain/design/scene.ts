/**
 * The roof and what stands around it as a scene of clean shapes, for the
 * designer's 3D view: the home built from its own roof faces, the buildings
 * next door as walls under hipped roofs, and the trees as trunks under round
 * crowns. Worked out from Google's measurements (a building outline and the
 * height of everything above the ground) on a grid in the designer's own
 * metres. Pure, tested.
 *
 * It is a model to show a design on, drawn the way an architect's massing
 * model is: true to where things are and how tall, not to every detail.
 */
import { hull } from "./drawing";

type P = { x: number; y: number };

/** A building next door: its outline as a rectangle turned to fit it, how high its walls stand and how high its roof rises. */
export interface SceneBuilding {
  /** The rectangle's middle, its size (along and across) and its turn, degrees clockwise from east. */
  cx: number;
  cy: number;
  long: number;
  wide: number;
  angle: number;
  /** Metres above the ground: the top of the walls, and the ridge. */
  eave: number;
  ridge: number;
}

export interface SceneTree {
  x: number;
  y: number;
  /** The crown's radius, and the tree's height, metres. */
  radius: number;
  height: number;
}

export interface Scene {
  buildings: SceneBuilding[];
  trees: SceneTree[];
}

/** A grid of readings over the designer's picture, row by row from its top-left corner, `cell` metres a cell. */
export interface Grid<T extends ArrayLike<number>> {
  cols: number;
  rows: number;
  cell: number;
  values: T;
}

/** Below this, a reading isn't a tree or a building: a car, a fence, a hedge. */
const TALL = 2.4;

// ---------------------------------------------------------------------------
// Pieces of a grid
// ---------------------------------------------------------------------------

/** The cells of a grid that are "in", as groups that touch (side by side), each a list of cell indices. */
export function pieces(inside: (i: number) => boolean, cols: number, rows: number): number[][] {
  const seen = new Uint8Array(cols * rows);
  const out: number[][] = [];
  for (let start = 0; start < cols * rows; start++) {
    if (seen[start] || !inside(start)) continue;
    const piece: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      piece.push(i);
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const n = nr * cols + nc;
        if (!seen[n] && inside(n)) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    out.push(piece);
  }
  return out;
}

/** The middle of a cell, in the designer's metres from the middle of the picture (x east, y south). */
const at = <T extends ArrayLike<number>>(g: Grid<T>, i: number): P => {
  const c = i % g.cols;
  const r = (i - c) / g.cols;
  return { x: (c + 0.5) * g.cell - (g.cols * g.cell) / 2, y: (r + 0.5) * g.cell - (g.rows * g.cell) / 2 };
};

/** The smallest rectangle, turned to suit, that holds a set of points: its middle, size and turn (rotating the outline's edges). */
export function fitRectangle(points: readonly P[]): { cx: number; cy: number; long: number; wide: number; angle: number } {
  const outline = hull(points);
  let best = { area: Infinity, cx: 0, cy: 0, long: 0, wide: 0, angle: 0 };
  const edges = outline.length >= 2 ? outline : [...points];
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const b = edges[(i + 1) % edges.length];
    const t = Math.atan2(b.y - a.y, b.x - a.x);
    const [cos, sin] = [Math.cos(t), Math.sin(t)];
    let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of outline.length >= 3 ? outline : points) {
      const u = p.x * cos + p.y * sin;
      const v = -p.x * sin + p.y * cos;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area) {
      const mu = (u0 + u1) / 2;
      const mv = (v0 + v1) / 2;
      const [du, dv] = [u1 - u0, v1 - v0];
      const along = du >= dv;
      best = {
        area,
        cx: mu * cos - mv * sin,
        cy: mu * sin + mv * cos,
        long: Math.max(du, dv),
        wide: Math.min(du, dv),
        angle: ((((t * 180) / Math.PI + (along ? 0 : 90)) % 180) + 180) % 180,
      };
    }
  }
  return { cx: best.cx, cy: best.cy, long: best.long, wide: best.wide, angle: best.angle };
}

/** The value at a share (0 to 1) of the way up a sorted copy of some numbers. */
const share = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
};

// ---------------------------------------------------------------------------
// Buildings and trees
// ---------------------------------------------------------------------------

/**
 * The buildings on the grid, from the building outline and the height of
 * each cell above the ground: each piece of outline big enough to be a
 * building (a garden shed counts, a hot-water unit doesn't), as the
 * rectangle that fits it, its walls as high as most of its roof's lower part
 * and its ridge as high as its top. A piece that reaches `skip` (the home
 * itself, drawn from its own faces) is left out.
 */
export function buildingsFrom(
  mask: Grid<ArrayLike<number>>,
  height: Grid<ArrayLike<number>>,
  skip: (p: P) => boolean = () => false,
): SceneBuilding[] {
  const cellArea = mask.cell * mask.cell;
  const out: SceneBuilding[] = [];
  for (const piece of pieces((i) => mask.values[i] > 0 && height.values[i] > 1.6, mask.cols, mask.rows)) {
    if (piece.length * cellArea < 6) continue;
    const points = piece.map((i) => at(mask, i));
    if (points.some(skip)) continue;
    const tops = piece.map((i) => height.values[i]);
    const ridge = Math.max(2.6, share(tops, 0.95));
    const eave = Math.max(2.2, Math.min(ridge - 0.3, share(tops, 0.15)));
    const rect = fitRectangle(points);
    // A shape that fills little of its rectangle (an L, a long thin wing) still gets a rectangle, a little smaller.
    const fill = (piece.length * cellArea) / Math.max(1, rect.long * rect.wide);
    const shrink = fill < 0.75 ? Math.sqrt(Math.max(0.6, fill / 0.75)) : 1;
    out.push({ ...rect, long: rect.long * shrink, wide: rect.wide * shrink, eave, ridge });
  }
  return out;
}

/**
 * The trees on the grid: wherever something stands tall outside the
 * building outline. A wide canopy is more than one tree, so the crowns are
 * found at its high points (each the tallest within about two metres, at
 * least `apart` metres from a taller one), and every tall cell is given to
 * the nearest of them; each tree's crown is as wide as the cells it was
 * given. Its height is its high point.
 */
export function treesFrom(mask: Grid<ArrayLike<number>>, height: Grid<ArrayLike<number>>, apart = 3): SceneTree[] {
  const { cols, rows, cell } = height;
  const tall = (i: number) => !(mask.values[i] > 0) && height.values[i] >= TALL;
  const reach = Math.max(1, Math.round(2 / cell));
  // High points: tall cells that are the tallest within reach.
  let peaks: number[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (!tall(i)) continue;
    const c = i % cols;
    const r = (i - c) / cols;
    let top = true;
    for (let dr = -reach; dr <= reach && top; dr++)
      for (let dc = -reach; dc <= reach; dc++) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || (dc === 0 && dr === 0)) continue;
        const n = nr * cols + nc;
        if (height.values[n] > height.values[i] || (height.values[n] === height.values[i] && n < i)) {
          top = false;
          break;
        }
      }
    if (top) peaks.push(i);
  }
  // Tallest first, each keeping clear of a taller one.
  peaks.sort((a, b) => height.values[b] - height.values[a]);
  const kept: { i: number; p: P }[] = [];
  for (const i of peaks) {
    const p = at(height, i);
    if (kept.every((k) => Math.hypot(k.p.x - p.x, k.p.y - p.y) >= apart)) kept.push({ i, p });
  }
  peaks = kept.map((k) => k.i);
  if (!kept.length) return [];
  const area = new Array<number>(kept.length).fill(0);
  for (let i = 0; i < cols * rows; i++) {
    if (!tall(i)) continue;
    const p = at(height, i);
    let best = 0;
    let bestD = Infinity;
    kept.forEach((k, j) => {
      const d = Math.hypot(k.p.x - p.x, k.p.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    if (bestD <= 9) area[best] += cell * cell;
  }
  return kept
    .map((k, j) => ({
      x: Math.round(k.p.x * 100) / 100,
      y: Math.round(k.p.y * 100) / 100,
      radius: Math.round(Math.min(8, Math.max(0.9, Math.sqrt(area[j] / Math.PI))) * 100) / 100,
      height: Math.round(height.values[k.i] * 100) / 100,
    }))
    .filter((t) => t.radius >= 0.9 && area[kept.findIndex((k) => k.p.x === t.x)] !== 0);
}

// ---------------------------------------------------------------------------
// The home, from its own roof faces
// ---------------------------------------------------------------------------

/** A roof face as the 3D view builds it: its outline (the designer's metres), the way it faces and its pitch. */
export interface SceneFace {
  points: P[];
  /** Degrees clockwise from north: the way its slope runs down. */
  facing: number;
  tilt: number;
}

/** How high the walls of a home of so many storeys stand, metres. */
export const eaveFor = (storeys: "single" | "double") => (storeys === "double" ? 5.7 : 2.8);

/**
 * The height of a roof face at a point: its lowest edge (the one furthest
 * the way it faces) sits on the walls, and it rises from there at its pitch.
 */
export function roofHeightAt(face: SceneFace, eave: number, p: P): number {
  const t = (face.facing * Math.PI) / 180;
  // The way the slope runs down, on the ground: x east, y south (so north is -y).
  const down = { x: Math.sin(t), y: -Math.cos(t) };
  const lowest = Math.max(...face.points.map((v) => v.x * down.x + v.y * down.y));
  const up = lowest - (p.x * down.x + p.y * down.y);
  return eave + Math.max(0, up) * Math.tan((Math.max(0, Math.min(60, face.tilt)) * Math.PI) / 180);
}

/** Whether a point is inside an outline (even-odd). */
export function insideOutline(p: P, outline: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The roof face a point is on (the first whose outline holds it), else the nearest by its middle. Null with no faces. */
export function faceUnder(faces: readonly SceneFace[], p: P): SceneFace | null {
  if (!faces.length) return null;
  const on = faces.find((f) => insideOutline(p, f.points));
  if (on) return on;
  const middle = (f: SceneFace) => ({
    x: f.points.reduce((n, v) => n + v.x, 0) / f.points.length,
    y: f.points.reduce((n, v) => n + v.y, 0) / f.points.length,
  });
  return [...faces].sort((a, b) => {
    const ma = middle(a);
    const mb = middle(b);
    return Math.hypot(ma.x - p.x, ma.y - p.y) - Math.hypot(mb.x - p.x, mb.y - p.y);
  })[0];
}

// ---------------------------------------------------------------------------
// Sending it to the browser
// ---------------------------------------------------------------------------

/** A number within bounds, or null: anything outside them is refused, not bent to fit. */
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

/** A scene read back: only well-formed buildings and trees, within sensible bounds. */
export function cleanScene(raw: unknown): Scene {
  const r = (raw && typeof raw === "object" ? raw : {}) as { buildings?: unknown; trees?: unknown };
  const buildings: SceneBuilding[] = [];
  for (const b of Array.isArray(r.buildings) ? r.buildings.slice(0, 400) : []) {
    const o = (b ?? {}) as Record<string, unknown>;
    const v = [
      num(o.cx, -500, 500),
      num(o.cy, -500, 500),
      num(o.long, 0.5, 300),
      num(o.wide, 0.5, 300),
      num(o.angle, 0, 180),
      num(o.eave, 0, 200),
      num(o.ridge, 0, 200),
    ];
    if (v.some((x) => x === null)) continue;
    const [cx, cy, long, wide, angle, eave, ridge] = v as number[];
    buildings.push({ cx, cy, long, wide, angle, eave, ridge: Math.max(eave, ridge) });
  }
  const trees: SceneTree[] = [];
  for (const t of Array.isArray(r.trees) ? r.trees.slice(0, 2000) : []) {
    const o = (t ?? {}) as Record<string, unknown>;
    const v = [num(o.x, -500, 500), num(o.y, -500, 500), num(o.radius, 0.3, 30), num(o.height, 1, 80)];
    if (v.some((x) => x === null)) continue;
    const [x, y, radius, height] = v as number[];
    trees.push({ x, y, radius, height });
  }
  return { buildings, trees };
}
