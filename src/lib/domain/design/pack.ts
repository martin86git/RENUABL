/**
 * Laying panels on a roof face the way an installer would (Martin, 18 Oct
 * 2026, after layouts at 3 Bill Place came out in odd shapes, landscape for no
 * reason, across two roofs and over the edge). Pure, tested.
 *
 * - **From the gutter up, in a pyramid.** The first row runs along the roof's
 *   lower edge, where the face is longest, and is the longest row; each row
 *   above is no longer than the one below it and sits centred over it.
 * - **Portrait unless it can't be.** Landscape on a tiled roof takes more
 *   brackets and rail, so a row is laid on its side only where portrait won't
 *   fit at least two there (near a hip's ridge, say) and landscape fits more.
 * - **Never near an edge, for wind.** Every panel, as drawn, is inside the
 *   face by at least twice the height of the gap under it (panel underside to
 *   roof surface) or `EDGE_CLEARANCE` (200 mm), whichever is greater
 *   (`clearanceFor`; Martin's rule, VERIFY against the racking maker's wind
 *   installation guide): nothing overhangs, nothing crosses onto the next roof,
 *   and the edge zones, where the wind load is highest, stay clear.
 * - **One face per array.** A face is packed on its own; arrays across faces
 *   are chosen by `packAreas`: one array when a face nearly as sunny as the
 *   best holds them all, else the fewest arrays (two, or three above 18
 *   panels), never one under `MIN_ARRAY_PANELS`.
 *
 * A face (`Area`) is anything that can say whether a point is on it: a traced
 * outline, or the area Google's roof model says panels may cover. Panels are
 * spaced at full size, as the designer draws them from above.
 */
import { MIN_ARRAY_PANELS } from "../roof-layout";
import {
  PANEL,
  faceFacing,
  inside,
  panelFacing,
  panelPlaces,
  planSize,
  type Face,
  type LoosePanel,
  type PanelSize,
  type Point,
} from "./roof-design";
import { TILT, yearOnPlane } from "./tilt";

/** The least distance from any edge of a face to any panel on it, metres. */
export const EDGE_CLEARANCE = 0.2;
/** The gap under a panel, from its underside to the roof surface, on flush rails, metres. PLACEHOLDER, VERIFY with the racking used. */
export const MOUNT_STANDOFF = 0.1;

/** How far panels are kept from a face's edges: twice the gap under them, or 200 mm, whichever is greater. */
export function clearanceFor(standoff: number = MOUNT_STANDOFF): number {
  return Math.max(EDGE_CLEARANCE, 2 * Math.max(0, standoff));
}
/** The fewest panels a row is laid with: one on its own is a straggler. */
export const MIN_ROW = 2;
/** The most steps the row search takes on one face before it lays the rest row by row (see `packArea`). */
export const SEARCH_BUDGET = 4000;
/** How far up the slope from where a first row fits the gutter row is also tried from, metres (`packArea`). */
export const GUTTER_SEARCH = 2.5;
/** The steps the gutter row is tried at further up, metres. */
export const GUTTER_STEP = 0.2;
/** Faces steeper than this are walls or gables, never a place for panels. */
export const STEEPEST = 45;
/** A face gets at least this share of the sunniest face's sun to be used. */
export const SUNNY_ENOUGH = 0.8;

const rad = (d: number) => (d * Math.PI) / 180;
const cm = (n: number) => Math.round(n * 100) / 100;
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
/** On the ground (metres east and south): the way down a slope that looks towards `bearing`, and across it. */
export const downOf = (bearing: number): Point => ({ x: Math.sin(rad(bearing)), y: -Math.cos(rad(bearing)) });
export const sideOf = (bearing: number): Point => ({ x: Math.cos(rad(bearing)), y: Math.sin(rad(bearing)) });

/** A roof face to lay panels on. */
export interface Area {
  /** The way its panels look, clockwise from north. */
  facing: number;
  pitch: number;
  /** Whether a point (metres east and south of the picture's middle) is on the face. */
  covers: (p: Point) => boolean;
  /** Points round its edge, for its extent. */
  outline: Point[];
  /** How much sun it gets, for choosing between faces (any scale, higher is sunnier). */
  sun: number;
  /** A distance from its edges asked for on top (a traced face's own setback); the wind rule's still applies. */
  clearance?: number;
  /** The gap under its panels, panel underside to roof surface, metres (`MOUNT_STANDOFF` when not said). */
  standoff?: number;
  /** Places on it to keep clear (existing panels, vents, skylights: `roof-check.ts`), outlines in metres. */
  avoid?: Point[][];
}

const avoidKept = new WeakMap<Area, Map<string, Area>>();
/**
 * The area with places to keep clear (9 Nov 2026, Martin: Design it for me laid panels over a home's existing ones):
 * no panel is laid over or within its clearance of one. Kept with the area, so the rows found on it are kept too.
 */
export function avoiding(area: Area, avoid: readonly Point[][] | undefined): Area {
  if (!avoid?.length) return area;
  const key = JSON.stringify(avoid);
  const byKey = avoidKept.get(area) ?? new Map<string, Area>();
  avoidKept.set(area, byKey);
  const kept = byKey.get(key);
  if (kept) return kept;
  const made: Area = { ...area, avoid: [...avoid], covers: (p) => area.covers(p) && !avoid.some((q) => inside(p, q)) };
  byKey.set(key, made);
  return made;
}

/**
 * Up to `n` panels on one face: rows from the gutter up, each no longer than the one below and centred over it, each
 * portrait or on its side as fits the most panels on the face (portrait when it fits as many), every panel at least
 * the clearance inside the face.
 */
/** Where rows fit on a face, kept with the face for each panel size and clearance (`packArea`). */
type Runs = { a: number; b: number; count: number }[];
const rowsKept = new WeakMap<Area, Map<string, Map<string, Runs>>>();
function rowsFound(area: Area, sizeKey: string): Map<string, Runs> {
  const bySize = rowsKept.get(area) ?? new Map<string, Map<string, Runs>>();
  rowsKept.set(area, bySize);
  const found = bySize.get(sizeKey) ?? new Map<string, Runs>();
  bySize.set(sizeKey, found);
  return found;
}

export function packArea(area: Area, n: number, size: PanelSize, newId: () => string): LoosePanel[] {
  const want = Math.max(0, Math.floor(n));
  if (!want || area.outline.length < 3) return [];
  const down = downOf(area.facing);
  const side = sideOf(area.facing);
  const at = (u: number, v: number): Point => ({ x: u * side.x + v * down.x, y: u * side.y + v * down.y });
  const us = area.outline.map((p) => dot(p, side));
  const vs = area.outline.map((p) => dot(p, down));
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  // A centimetre over, so rounding where a panel is drawn can never bring it inside the line.
  const edge = Math.max(clearanceFor(area.standoff), area.clearance ?? 0) + 0.01;
  const tilt = Math.max(0, Math.min(TILT.max, Math.round(area.pitch)));
  const facing = Math.round(area.facing) % 360;
  const avoidUV = (area.avoid ?? []).map((q) => q.map((p) => ({ u: dot(p, side), v: dot(p, down) })));

  /** Whether a panel centred at (u, v), `across` wide and `along` down the slope, is wholly on the face with the clearance round it. */
  const fits = (u: number, v: number, across: number, along: number) => {
    const hu = across / 2 + edge;
    const hv = along / 2 + edge;
    for (const a of [-1, -0.5, 0, 0.5, 1])
      for (const b of [-1, -0.5, 0, 0.5, 1]) if (!area.covers(at(u + a * hu, v + b * hv))) return false;
    // A place to keep clear smaller than the gaps between those points (a vent) still stops it: any corner within.
    for (const q of avoidUV) if (q.some((c) => Math.abs(c.u - u) <= hu && Math.abs(c.v - v) <= hv)) return false;
    return true;
  };
  const STEP = 0.1;
  /** The runs of centres along a row at `v` where a panel fits, and how many panels side by side each takes. */
  const runs = (v: number, across: number, along: number) => {
    const out: { a: number; b: number; count: number }[] = [];
    let start: number | null = null;
    let last = 0;
    for (let u = u0; u <= u1 + 1e-9; u += STEP) {
      if (fits(u, v, across, along)) {
        if (start === null) start = u;
        last = u;
      } else if (start !== null) {
        out.push({ a: start, b: last, count: Math.floor((last - start) / (across + size.gap) + 1e-9) + 1 });
        start = null;
      }
    }
    if (start !== null) out.push({ a: start, b: last, count: Math.floor((last - start) / (across + size.gap) + 1e-9) + 1 });
    return out;
  };

  // First the rows the face holds, from the gutter up. Each row is tried portrait and on its side, and the mix that
  // holds the most panels on the face is kept (Martin, 3 Bill Place: a portrait row along the gutter, then shallower
  // landscape rows where the hip narrows towards the ridge). Ties go to fewer panels on their side (landscape takes
  // more brackets and rail on tile), then fewer rows. Each row is no longer, in metres, than the one below it.
  type Row = { landscape: boolean; along: number; across: number; v: number; run: { a: number; b: number }; room: number };
  type Below = { width: number; lo: number; hi: number } | null;
  // Kept with the face, so laying another count on it doesn't measure the same rows again.
  const found = rowsFound(area, `${size.long}|${size.short}|${size.gap}|${edge}|${tilt}`);
  const tryWay = (lowerEdge: number, below: Below, landscape: boolean): Row | null => {
    // Down the slope, as seen from above: shorter by the cosine of the pitch, as the designer draws it (`planSize`).
    const along = (landscape ? size.short : size.long) * Math.cos((tilt * Math.PI) / 180);
    const across = landscape ? size.long : size.short;
    const v = lowerEdge - along / 2;
    const key = `${landscape ? 1 : 0}|${v.toFixed(3)}`;
    if (!found.has(key)) found.set(key, runs(v, across, along));
    const options = found.get(key)!;
    const overlap = (r: { a: number; b: number }) => (below ? Math.min(r.b, below.hi) - Math.max(r.a, below.lo) : 0);
    const run = options.reduce<(typeof options)[number] | null>((best, r) => {
      if (!best) return r;
      if (below) return overlap(r) > overlap(best) ? r : best;
      return r.count > best.count ? r : best;
    }, null);
    if (!run) return null;
    // No longer than the row below: as many of this shape as fit in its width.
    const fitBelow = below ? Math.floor((below.width + size.gap) / (across + size.gap) + 1e-9) : Infinity;
    const room = Math.min(run.count, fitBelow);
    return room >= MIN_ROW ? { landscape, along, across, v, run, room } : null;
  };
  const score = (plan: Row[]) => {
    let left = want;
    let total = 0;
    let onSide = 0;
    for (const row of plan) {
      const take = Math.min(row.room, left);
      total += take;
      if (row.landscape) onSide += take;
      left -= take;
    }
    return { total, onSide, rows: plan.length };
  };
  const better = (a: Row[], b: Row[]) => {
    const [x, y] = [score(a), score(b)];
    if (x.total !== y.total) return x.total > y.total;
    if (x.onSide !== y.onSide) return x.onSide < y.onSide;
    return x.rows < y.rows;
  };
  // The search takes at most `SEARCH_BUDGET` steps a face: past it, each row is laid portrait where it fits, else on its side, so a
  // large flat roof (hundreds of places, dozens of rows) can never hold the page up (2 Nov 2026: a commercial roof
  // froze the designer for minutes).
  const planned = new Map<string, Row[]>();
  let steps = 0;
  const plan = (lowerEdge: number, below: Below, depth: number): Row[] => {
    if (lowerEdge <= v0 || depth >= 40) return [];
    const key = `${lowerEdge.toFixed(3)}|${below ? `${below.width.toFixed(2)}|${below.lo.toFixed(2)}|${below.hi.toFixed(2)}` : "-"}`;
    const known = planned.get(key);
    if (known) return known;
    const searching = ++steps <= SEARCH_BUDGET;
    let best: Row[] = [];
    for (const landscape of [false, true]) {
      const row = tryWay(lowerEdge, below, landscape);
      if (!row) continue;
      const width = row.room * (row.across + size.gap) - size.gap;
      const middle = (row.run.a + row.run.b) / 2;
      const next: Below = { width, lo: middle - width / 2, hi: middle + width / 2 };
      const candidate = [row, ...plan(row.v - row.along / 2 - size.gap, next, depth + 1)];
      if (!best.length || better(candidate, best)) best = candidate;
      if (!searching) break;
    }
    planned.set(key, best);
    return best;
  };
  // The gutter edge may be ragged: look a little further up until a first row fits.
  let rows: Row[] = [];
  let first = v1;
  for (let lowerEdge = v1; lowerEdge > v0 && !rows.length; lowerEdge -= STEP) {
    rows = plan(lowerEdge, null, 0);
    first = lowerEdge;
  }
  // A first row that is only a stub (a face read from heights, a hip's corner) would cap every row above it, since none
  // may be longer (9 Nov 2026, Martin: on a ragged east face the first row held four, so 70 m² held eight panels). Then
  // the gutter row is also tried further up the slope, every `GUTTER_STEP` for `GUTTER_SEARCH`, and a start is taken only
  // when it holds more panels in all.
  const across = Math.min(size.short, size.long) + size.gap;
  const stub = rows.length > 0 && rows[0].room * 2 <= Math.floor((u1 - u0) / across);
  if (stub) {
    let best = score(rows).total;
    for (let lowerEdge = first - GUTTER_STEP; lowerEdge > v0 && first - lowerEdge <= GUTTER_SEARCH; lowerEdge -= GUTTER_STEP) {
      const tried = plan(lowerEdge, null, 0);
      const total = score(tried).total;
      if (total > best) {
        best = total;
        rows = tried;
      }
    }
  }

  // Then the panels shared out: the gutter row first and fullest. A top row that would be a lone panel takes one
  // from the row below instead, when that row stays at least as long; otherwise the lone panel is left off.
  const counts: number[] = [];
  let left = want;
  for (const row of rows) {
    if (left <= 0) break;
    const take = Math.min(row.room, left);
    counts.push(take);
    left -= take;
  }
  const last = counts.length - 1;
  if (last >= 0 && counts[last] < MIN_ROW && want >= MIN_ROW) {
    if (last > 0 && counts[last - 1] - (MIN_ROW - counts[last]) >= MIN_ROW && rows[last].room >= MIN_ROW) {
      counts[last - 1] -= MIN_ROW - counts[last];
      counts[last] = MIN_ROW;
    } else counts.pop();
  }

  // Laid: each row centred over the one below it (or in its run), kept within its run.
  const panels: LoosePanel[] = [];
  let centre: number | null = null;
  counts.forEach((k, i) => {
    const row = rows[i];
    const step = row.across + size.gap;
    const span = (k - 1) * step;
    const aim = centre ?? (row.run.a + row.run.b) / 2;
    const start = Math.min(Math.max(aim - span / 2, row.run.a), row.run.b - span);
    for (let j = 0; j < k; j++) {
      const at0 = at(start + j * step, row.v);
      panels.push(
        row.landscape
          ? { id: newId(), x: cm(at0.x), y: cm(at0.y), angle: (facing + 270) % 360, across: true, tilt }
          : { id: newId(), x: cm(at0.x), y: cm(at0.y), angle: facing, tilt },
      );
    }
    centre = start + span / 2;
  });
  return panels;
}

/**
 * Up to `n` panels across a roof's faces, in as few tidy arrays as will hold them: one array when a face nearly
 * as sunny as the best (within 5%) holds them all; else the sunniest faces in turn, at most two arrays (three above
 * 18 panels), none under `MIN_ARRAY_PANELS`, leaving room for a second proper array rather than a remainder too
 * small to lay. Faces too steep, or under `SUNNY_ENOUGH` of the best face's sun, are left alone.
 */
export function packAreas(areas: Area[], n: number, size: PanelSize, newId: () => string, most = 60): LoosePanel[] {
  const want = Math.min(most, Math.max(0, Math.round(n)));
  if (!want) return [];
  const usable = areas
    .filter((a) => a.pitch <= STEEPEST)
    .flatMap((a) => regionsOf(a, size))
    .sort((a, b) => b.sun - a.sun);
  if (!usable.length) return [];
  let tried = 0;
  // How many panels each face holds, worked out only when asked (laying a face is the slow part).
  const counted = new Map<Area, number>();
  const room = {
    get: (a: Area) => {
      if (!counted.has(a)) counted.set(a, packArea(a, most, size, () => `t${tried++}`).length);
      return counted.get(a)!;
    },
  };
  // The best sun among faces with room for an array: a sunny face already full (of existing panels, say) rules nothing out.
  const top = usable.find((a) => room.get(a) >= MIN_ARRAY_PANELS)?.sun ?? usable[0].sun;
  // As sunny as each other (the parts of one face), the one that holds the most first.
  const sunny = usable.filter((a) => a.sun >= top * SUNNY_ENOUGH).sort((a, b) => b.sun - a.sun || room.get(b) - room.get(a));

  const whole = sunny.find((a) => room.get(a) >= want && a.sun >= top * 0.95);
  if (whole) return packArea(whole, want, size, newId);

  const arraysAllowed = want > 18 ? 3 : 2;
  const out: LoosePanel[] = [];
  let left = want;
  let arrays = 0;
  sunny.forEach((a, i) => {
    if (!left || arrays >= arraysAllowed) return;
    let take = Math.min(left, room.get(a) ?? 0);
    const rest = left - take;
    const later = sunny.slice(i + 1).some((b) => (room.get(b) ?? 0) >= MIN_ARRAY_PANELS);
    if (rest > 0 && rest < MIN_ARRAY_PANELS && later && arrays + 1 < arraysAllowed && take - (MIN_ARRAY_PANELS - rest) >= MIN_ARRAY_PANELS)
      take -= MIN_ARRAY_PANELS - rest;
    if (take < MIN_ARRAY_PANELS) return;
    const panels = packArea(a, take, size, newId);
    if (panels.length < MIN_ARRAY_PANELS) return;
    out.push(...panels);
    arrays += 1;
    left -= panels.length;
  });
  return out;
}

/** The grid the clear parts of a face are found on, metres. */
const REGION_STEP = 0.25;
const regionsKept = new WeakMap<Area, Map<string, Area[]>>();

/**
 * The separate clear parts of a face that places to keep clear split up (9 Nov 2026, Martin: at a roof whose existing
 * panels ran down its middle, only four panels went in a corner and the clear roof to the south was never used: the
 * rows climb from the gutter in one pyramid, so the first row cut short by the existing panels stopped every row after
 * it). Each part is where a panel fits, joined to its neighbours, and is packed as an array of its own. A face with
 * nothing to keep clear, or one part, is itself.
 */
export function regionsOf(area: Area, size: PanelSize): Area[] {
  if (!area.avoid?.length || area.outline.length < 3) return [area];
  const sizeKey = `${size.long}|${size.short}|${size.gap}`;
  const byKey = regionsKept.get(area) ?? new Map<string, Area[]>();
  regionsKept.set(area, byKey);
  const kept = byKey.get(sizeKey);
  if (kept) return kept;

  const down = downOf(area.facing);
  const side = sideOf(area.facing);
  const at = (u: number, v: number): Point => ({ x: u * side.x + v * down.x, y: u * side.y + v * down.y });
  const us = area.outline.map((p) => dot(p, side));
  const vs = area.outline.map((p) => dot(p, down));
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const edge = Math.max(clearanceFor(area.standoff), area.clearance ?? 0) + 0.01;
  const cos = Math.cos((Math.max(0, Math.min(TILT.max, area.pitch)) * Math.PI) / 180);
  const shapes = [
    { across: size.short, along: size.long * cos },
    { across: size.long, along: size.short * cos },
  ];
  const avoidUV = area.avoid.map((q) => q.map((p) => ({ u: dot(p, side), v: dot(p, down) })));
  const fitsAt = (u: number, v: number) =>
    shapes.some(({ across, along }) => {
      const hu = across / 2 + edge;
      const hv = along / 2 + edge;
      for (const a of [-1, -0.5, 0, 0.5, 1])
        for (const b of [-1, -0.5, 0, 0.5, 1]) if (!area.covers(at(u + a * hu, v + b * hv))) return false;
      return !avoidUV.some((q) => q.some((c) => Math.abs(c.u - u) <= hu && Math.abs(c.v - v) <= hv));
    });

  const cols = Math.max(1, Math.ceil((u1 - u0) / REGION_STEP) + 1);
  const rowsN = Math.max(1, Math.ceil((v1 - v0) / REGION_STEP) + 1);
  if (cols * rowsN > 200_000) return [area];
  const free = new Uint8Array(cols * rowsN);
  for (let j = 0; j < rowsN; j++)
    for (let i = 0; i < cols; i++) free[j * cols + i] = fitsAt(u0 + i * REGION_STEP, v0 + j * REGION_STEP) ? 1 : 0;

  // Joined places, by a flood from each one not yet reached.
  const label = new Int32Array(cols * rowsN).fill(-1);
  const parts: number[][] = [];
  for (let s = 0; s < free.length; s++) {
    if (!free[s] || label[s] >= 0) continue;
    const id = parts.length;
    const cells: number[] = [];
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const i = c % cols;
      const j = (c - i) / cols;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rowsN) continue;
        const k = nj * cols + ni;
        if (free[k] && label[k] < 0) {
          label[k] = id;
          stack.push(k);
        }
      }
    }
    parts.push(cells);
  }
  if (parts.length <= 1) {
    byKey.set(sizeKey, [area]);
    return [area];
  }

  // Each part covers what a panel centred on any of its places would: its places grown by the largest panel's reach.
  const reachU = Math.ceil((Math.max(...shapes.map((s) => s.across)) / 2 + edge) / REGION_STEP) + 1;
  const reachV = Math.ceil((Math.max(...shapes.map((s) => s.along)) / 2 + edge) / REGION_STEP) + 1;
  const made = parts.map((cells, id): Area => {
    const mine = new Uint8Array(cols * rowsN);
    let [lu, hu, lv, hv] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const c of cells) {
      const i = c % cols;
      const j = (c - i) / cols;
      for (let dj = -reachV; dj <= reachV; dj++)
        for (let di = -reachU; di <= reachU; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && nj >= 0 && ni < cols && nj < rowsN) mine[nj * cols + ni] = 1;
        }
      lu = Math.min(lu, i);
      hu = Math.max(hu, i);
      lv = Math.min(lv, j);
      hv = Math.max(hv, j);
    }
    const ownCell = (p: Point) => {
      const i = Math.round((dot(p, side) - u0) / REGION_STEP);
      const j = Math.round((dot(p, down) - v0) / REGION_STEP);
      if (i < 0 || j < 0 || i >= cols || j >= rowsN) return false;
      // Only this part's own places, never another part's (two parts' reach can overlap between them).
      const k = j * cols + i;
      return mine[k] === 1 && (label[k] < 0 || label[k] === id);
    };
    const [a0, a1] = [u0 + (lu - reachU) * REGION_STEP, u0 + (hu + reachU) * REGION_STEP];
    const [b0, b1] = [v0 + (lv - reachV) * REGION_STEP, v0 + (hv + reachV) * REGION_STEP];
    return {
      ...area,
      covers: (p) => area.covers(p) && ownCell(p),
      outline: [at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)],
    };
  });
  byKey.set(sizeKey, made);
  return made;
}

/** A traced face as an area: on it means inside its outline and off any place switched off; its own distance from the edges, never under the wind rule. */
export function tracedArea(face: Face, size: PanelSize = PANEL): Area {
  const tilt = face.tilt ?? TILT.roof;
  // A place someone switched off (over a vent or a skylight, say) stays clear: panels are laid round it. A grid switched
  // off whole, or mostly (a face reshaped since), is the face laid by hand (`packFaces` leaves it so), not a roof of
  // obstacles: then nothing is blocked (8 Nov 2026: laying a face a second time found no room at all).
  const off = new Set(face.off);
  const places = panelPlaces(face, size);
  const whole = places.length > 0 && places.filter((place) => off.has(place.index)).length > places.length / 2;
  const blocked = whole ? [] : places.filter((place) => off.has(place.index)).map((place) => place.corners);
  return {
    facing: faceFacing(face),
    pitch: tilt,
    covers: (p) => inside(p, face.points) && !blocked.some((quad) => inside(p, quad)),
    outline: face.points,
    sun: yearOnPlane(tilt, faceFacing(face)),
    clearance: face.setback,
  };
}

/**
 * Up to `n` panels on traced faces, as panels placed by hand (`packAreas`), and the faces with every place in
 * their own grid switched off, so the faces stay as the roof's outline and the panels are the ones laid here.
 */
export function packFaces(
  faces: Face[],
  size: PanelSize,
  n: number,
  newId: () => string,
  /** Places to keep clear (`avoiding`). */
  avoid?: readonly Point[][],
): { faces: Face[]; loose: LoosePanel[] } {
  const loose = packAreas(
    faces.map((f) => avoiding(tracedArea(f, size), avoid)),
    n,
    size,
    newId,
  );
  return { faces: faces.map((f) => ({ ...f, off: panelPlaces(f, size).map((p) => p.index) })), loose };
}

/** Panels within this far of each other down the slope are taken to be in the same row, metres. */
const SAME_ROW = 0.3;

/**
 * Picked panels turned onto their side (`landscape`) or back upright, and laid again tidily (Martin, 18 Oct 2026: a
 * Landscape button for what is picked). Each group facing one way keeps its rows and the count in each; the row
 * nearest the gutter keeps its lower edge where it was, the rows above are spaced again for the new shape, and each
 * row stays centred where it was. The panels keep their ids (so strings keep them), their tilt and the way they look.
 */
/**
 * One panel laid portrait or on its side where it is, still looking the same way (the Add a panel tool's choice,
 * Martin): on its side its long edge runs across the slope, a quarter turn from the way it looks.
 */
export function laidAs<T extends Pick<LoosePanel, "angle" | "across">>(panel: T, landscape: boolean): T {
  if (Boolean(panel.across) === landscape) return panel;
  const facing = panelFacing(panel);
  const { across: _was, ...rest } = panel;
  void _was;
  return { ...rest, angle: (((facing - (landscape ? 90 : 0)) % 360) + 360) % 360, ...(landscape ? { across: true } : {}) } as T;
}

/** How many panels go in each of `rows` rows, gutter first: as even as can be, any extra in the rows nearest the gutter. */
export function rowCounts(n: number, rows: number): number[] {
  const r = Math.max(1, Math.min(Math.round(rows), n));
  const each = Math.floor(n / r);
  return Array.from({ length: r }, (_, i) => each + (i < n % r ? 1 : 0));
}

/**
 * Panels laid again in so many rows (8 Nov 2026, Martin: Sol should lay panels in rows), each group facing one way on
 * its own: the same panels (ids, portrait or landscape, tilt, the way they look), rows as even as can be with any extra
 * nearest the gutter, each row centred on where the group was, the whole block centred where it stood.
 */
export function inRows(panels: LoosePanel[], size: PanelSize, rows: number): LoosePanel[] {
  const out = new Map<string, LoosePanel>();
  const groups = new Map<number, LoosePanel[]>();
  for (const p of panels) {
    const facing = Math.round(panelFacing(p)) % 360;
    groups.set(facing, [...(groups.get(facing) ?? []), p]);
  }
  for (const [facing, group] of groups) {
    const down = downOf(facing);
    const side = sideOf(facing);
    // Kept in the order they stand: gutter first, then across.
    const order = [...group].sort((a, b) => dot(b, down) - dot(a, down) || dot(a, side) - dot(b, side));
    const plan = planSize(order[0], size);
    const along = order[0].across ? plan.w : plan.h;
    const across = order[0].across ? plan.h : plan.w;
    const mu = order.reduce((t, p) => t + dot(p, side), 0) / order.length;
    const mv = order.reduce((t, p) => t + dot(p, down), 0) / order.length;
    const counts = rowCounts(order.length, rows);
    // The block's rows, from the gutter (furthest down) up, centred on where the group stood.
    const depth = counts.length * along + (counts.length - 1) * size.gap;
    let at = 0;
    counts.forEach((count, r) => {
      const v = mv + depth / 2 - along / 2 - r * (along + size.gap);
      for (let j = 0; j < count; j++) {
        const p = order[at++];
        const u = mu + (j - (count - 1) / 2) * (across + size.gap);
        out.set(p.id, { ...p, x: cm(u * side.x + v * down.x), y: cm(u * side.y + v * down.y) });
      }
    });
  }
  return panels.map((p) => out.get(p.id) ?? p);
}

export function reorient(panels: LoosePanel[], size: PanelSize, landscape: boolean): LoosePanel[] {
  const out = new Map<string, LoosePanel>();
  const groups = new Map<number, LoosePanel[]>();
  for (const p of panels) {
    const facing = Math.round(panelFacing(p)) % 360;
    groups.set(facing, [...(groups.get(facing) ?? []), p]);
  }
  for (const [facing, group] of groups) {
    const down = downOf(facing);
    const side = sideOf(facing);
    // Each panel's place on the slope, and how far it reaches down it now (seen from above).
    const placed = group.map((p) => {
      const plan = planSize(p, size);
      return { p, u: dot(p, side), v: dot(p, down), along: p.across ? plan.w : plan.h };
    });
    // Rows from the gutter (furthest down the slope) up.
    placed.sort((a, b) => b.v - a.v);
    const rows: (typeof placed)[] = [];
    for (const item of placed) {
      const row = rows.find((r) => Math.abs(r[0].v - item.v) <= SAME_ROW);
      if (row) row.push(item);
      else rows.push([item]);
    }
    let edge = Math.max(...rows[0].map((i) => i.v + i.along / 2));
    for (const row of rows) {
      row.sort((a, b) => a.u - b.u);
      const turned = row.map(({ p }) =>
        landscape ? { ...p, angle: (facing + 270) % 360, across: true } : { ...p, angle: facing, across: false },
      );
      const plan = planSize(turned[0], size);
      const along = landscape ? plan.w : plan.h;
      const across = landscape ? plan.h : plan.w;
      const v = edge - along / 2;
      const middle = row.reduce((t, i) => t + i.u, 0) / row.length;
      turned.forEach((p, j) => {
        const u = middle + (j - (row.length - 1) / 2) * (across + size.gap);
        const next: LoosePanel = {
          id: p.id,
          x: cm(u * side.x + v * down.x),
          y: cm(u * side.y + v * down.y),
          angle: p.angle,
          ...(landscape ? { across: true } : {}),
          ...(p.tilt !== undefined ? { tilt: p.tilt } : {}),
        };
        out.set(p.id, next);
      });
      edge = v - along / 2 - size.gap;
    }
  }
  return panels.map((p) => out.get(p.id) ?? p);
}
