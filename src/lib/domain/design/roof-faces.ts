/**
 * A roof's faces found in its heights (9 Nov 2026, Martin: on a Nearmap picture, the faces from Nearmap's own heights,
 * not Google's roof model, which can be years older than the roof). Pure, tested.
 *
 * Inside the home's roof outline, each quarter-metre of roof gets its own slope from a small plane fitted through the
 * heights round it (`LOCAL`); where that plane fits badly (a ridge, a hip, a valley, a vent, the gutter's edge) the
 * slope is set aside. Neighbours that slope the same way are grown into one face (`GROW`), smallest wobble first. Then
 * every part of the roof inside the outline, the ridges and edges too, goes to the face whose plane it sits on, so
 * each face reaches its own ridge and gutter. Each face's outline is traced round its cells and simplified, and its
 * pitch and direction come from the plane through all of it (`aspectFromHeights`'s convention: the way down,
 * clockwise from north).
 *
 * A starting point to check against the picture: heights can be older than the roof, and a tree over it bends a face.
 */
import { ASPECT, type FaceAspect } from "./face-aspect";
import { FACE_MAX_POINTS, clearOf, inside, type Point } from "./roof-design";
import type { Terrain } from "./shade";

export const ROOF_FACES = {
  /** Cells either side used for each cell's own slope (2: a window 1.25 m across at 0.25 m cells, narrow enough for a narrow hip face). */
  window: 2,
  /** A cell's own plane must fit this well to set a slope, metres. */
  localRms: 0.06,
  /** Slopes differing by less than this (as a rise per metre, either way) belong to one face. */
  sameSlope: 0.12,
  /** A height this far off a face's plane is not on it, metres. */
  onPlane: 0.2,
  /** A face smaller than this from above is left out (a dormer, a box gutter, noise), square metres. */
  minArea: 4,
  /** Kept this far in from the outline when slopes are read, metres (the gutter and the wall below it). */
  inset: 0.2,
  /** Joined faces whose slopes differ by less than this (a rise per metre, either way) are merged into one. */
  mergeSlope: 0.1,
  /** A face not joined to the home's roof is still its own when its middle is this near the address, metres. */
  nearHome: 10,
  /** A face this steep or more is a wall, not a roof, degrees. */
  wall: 45,
  /** A face steeper than this ... */
  steep: 32,
  /** ...and smaller than this is the band where one roof steps down to another, square metres. */
  steepMinArea: 25,
  /** Two faces meeting where the heights step less than this are one roof's faces, metres. */
  seamStep: 0.3,
  /** ...along at least this much of their edge, metres. */
  seamMin: 1,
  /** Each part of the roof goes to the plane it sits on among the faces within this many cells. */
  reassign: 6,
  /** Passes of tidying each face's edge. */
  tidyPasses: 2,
  /** A corner this near a seam between two faces, or the roof's outline, is put on it, metres. */
  snap: 0.7,
  /** Outlines simplified to within this, metres. */
  simplify: 0.45,
  /** A face smaller than this, square metres... */
  enclosedMax: 12,
  /** ...with at least this share of its edge against one other face, is part of that face (existing panels read as a slope of their own). */
  enclosedShare: 0.7,
} as const;

/** One face found: its outline (metres east and south of the picture's middle), slope and size from above. */
export interface FoundFace {
  points: Point[];
  aspect: FaceAspect;
  /** Square metres, seen from above. */
  areaM2: number;
}

const turn360 = (d: number) => ((d % 360) + 360) % 360;
const deg = (r: number) => (r * 180) / Math.PI;

interface Fit {
  a: number;
  b: number;
  c: number;
  rms: number;
}

/** Running sums for a least-squares plane z = a·x + b·y + c. */
class Sums {
  n = 0;
  x = 0;
  y = 0;
  z = 0;
  xx = 0;
  xy = 0;
  yy = 0;
  xz = 0;
  yz = 0;
  zz = 0;
  add(x: number, y: number, z: number) {
    this.n++;
    this.x += x;
    this.y += y;
    this.z += z;
    this.xx += x * x;
    this.xy += x * y;
    this.yy += y * y;
    this.xz += x * z;
    this.yz += y * z;
    this.zz += z * z;
  }
  fit(): Fit | null {
    const n = this.n;
    if (n < 3) return null;
    const mx = this.x / n;
    const my = this.y / n;
    const mz = this.z / n;
    const sxx = this.xx / n - mx * mx;
    const sxy = this.xy / n - mx * my;
    const syy = this.yy / n - my * my;
    const sxz = this.xz / n - mx * mz;
    const syz = this.yz / n - my * mz;
    const det = sxx * syy - sxy * sxy;
    if (Math.abs(det) < 1e-12) return null;
    const a = (sxz * syy - syz * sxy) / det;
    const b = (syz * sxx - sxz * sxy) / det;
    const c = mz - a * mx - b * my;
    // The spread off the plane, from the sums: mean of (z - a x - b y - c)^2.
    const szz = this.zz / n - mz * mz;
    const resid = Math.max(0, szz - a * sxz - b * syz);
    return { a, b, c, rms: Math.sqrt(resid) };
  }
}

/** The plane's slope and direction as `face-aspect.ts` gives them. */
function aspectOf(fit: Fit): FaceAspect {
  const pitch = deg(Math.atan(Math.hypot(fit.a, fit.b)));
  return {
    azimuth: turn360(Math.round(deg(Math.atan2(-fit.a, fit.b)))),
    pitch: Math.round(pitch * 10) / 10,
    flat: pitch < ASPECT.flatBelow,
    from: "heights",
  };
}

/** The largest four-way-joined piece of a set of cells. */
function largestPiece(cells: Set<number>, cols: number): Set<number> {
  const seen = new Set<number>();
  let best = new Set<number>();
  for (const start of cells) {
    if (seen.has(start)) continue;
    const piece = new Set<number>([start]);
    seen.add(start);
    for (const queue = [start]; queue.length;) {
      const i = queue.pop()!;
      for (const j of [i - 1, i + 1, i - cols, i + cols])
        if (cells.has(j) && !seen.has(j) && (j === i - 1 || j === i + 1 ? Math.floor(j / cols) === Math.floor(i / cols) : true)) {
          seen.add(j);
          piece.add(j);
          queue.push(j);
        }
    }
    if (piece.size > best.size) best = piece;
  }
  return best;
}

/** Douglas–Peucker on a closed ring. */
function simplifyRing(ring: Point[], tolerance: number): Point[] {
  if (ring.length <= 4) return ring;
  const far = (a: Point, b: Point, p: Point) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
  };
  const run = (pts: Point[]): Point[] => {
    if (pts.length < 3) return pts;
    let best = 0;
    let at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = far(pts[0], pts[pts.length - 1], pts[i]);
      if (d > best) {
        best = d;
        at = i;
      }
    }
    if (best <= tolerance) return [pts[0], pts[pts.length - 1]];
    return [...run(pts.slice(0, at + 1)).slice(0, -1), ...run(pts.slice(at))];
  };
  // Split the ring at its two furthest-apart points and simplify each half.
  let i0 = 0;
  let i1 = 0;
  let best = -1;
  for (let i = 0; i < ring.length; i++)
    for (let j = i + 1; j < ring.length; j++) {
      const d = Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y);
      if (d > best) [best, i0, i1] = [d, i, j];
    }
  const first = run(ring.slice(i0, i1 + 1));
  const second = run([...ring.slice(i1), ...ring.slice(0, i0 + 1)]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/**
 * The outline round a set of cells (one piece), cell corners in grid units: the boundary edges of the cells, joined
 * into the longest ring.
 */
function ringOf(cells: Set<number>, cols: number): [number, number][] {
  // Each boundary edge, directed with the cells on its left, from corner to corner.
  const next = new Map<string, [number, number][]>();
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = `${x0},${y0}`;
    next.set(k, [...(next.get(k) ?? []), [x1, y1]]);
  };
  for (const i of cells) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    if (!cells.has(i - cols) || r === 0) add(c + 1, r, c, r);
    if (!cells.has(i + cols)) add(c, r + 1, c + 1, r + 1);
    if (!cells.has(i - 1) || c === 0) add(c, r, c, r + 1);
    if (!cells.has(i + 1) || c === cols - 1) add(c + 1, r + 1, c + 1, r);
  }
  let longest: [number, number][] = [];
  const used = new Set<string>();
  for (const [start, outs] of next)
    for (const first of outs) {
      const edge = `${start}>${first[0]},${first[1]}`;
      if (used.has(edge)) continue;
      const ring: [number, number][] = [];
      let at = start.split(",").map(Number) as [number, number];
      let to = first;
      for (let guard = 0; guard < 200_000; guard++) {
        used.add(`${at[0]},${at[1]}>${to[0]},${to[1]}`);
        ring.push(at);
        at = to;
        const k = `${at[0]},${at[1]}`;
        if (k === start) break;
        const choices = (next.get(k) ?? []).filter((n) => !used.has(`${k}>${n[0]},${n[1]}`));
        if (!choices.length) break;
        to = choices[0];
      }
      if (ring.length > longest.length) longest = ring;
    }
  return longest;
}

/**
 * The faces of the home's roof inside `outline` (metres east and south of the picture's middle), from the heights over the
 * picture: largest first, at most `most`. Empty when the heights don't show faces there (too few, or all one wobble).
 */
export function facesFromHeights(
  outline: Point[],
  t: Terrain,
  /** The address, metres from the picture's middle: the faces kept are its roof's. */
  home: Point = { x: 0, y: 0 },
  most = 12,
  /**
   * Places inside the outline that aren't the home's roof (a pergola, a clear roof over a side path: the roof check's
   * structures, 10 Nov 2026), left out before the faces are read, so they make no face and no face reaches into them.
   */
  skip: readonly Point[][] = [],
): FoundFace[] {
  if (outline.length < 3) return [];
  const { cols, rows, cell } = t;
  const xOf = (c: number) => -t.widthM / 2 + (c + 0.5) * cell;
  const yOf = (r: number) => -t.heightM / 2 + (r + 0.5) * cell;
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) + t.widthM / 2) / cell));
  const c1 = Math.min(cols - 1, Math.ceil((Math.max(...xs) + t.widthM / 2) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(...ys) + t.heightM / 2) / cell));
  const r1 = Math.min(rows - 1, Math.ceil((Math.max(...ys) + t.heightM / 2) / cell));

  // The roof's cells: inside the outline, and those kept in from its edge for reading slopes.
  const onRoof = new Set<number>();
  const readable = new Set<number>();
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const p = { x: xOf(c), y: yOf(r) };
      if (!inside(p, outline) || skip.some((box) => inside(p, box))) continue;
      const i = r * cols + c;
      if (!Number.isFinite(t.heights[i])) continue;
      onRoof.add(i);
      if (clearOf(p, outline, ROOF_FACES.inset)) readable.add(i);
    }
  if (onRoof.size < (3 * ROOF_FACES.minArea) / (cell * cell)) return [];

  // Each readable cell's own slope.
  const w = ROOF_FACES.window;
  const local = new Map<number, Fit>();
  for (const i of readable) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const s = new Sums();
    for (let dr = -w; dr <= w; dr++)
      for (let dc = -w; dc <= w; dc++) {
        const j = (r + dr) * cols + (c + dc);
        if (!readable.has(j)) continue;
        s.add(dc * cell, dr * cell, t.heights[j]);
      }
    if (s.n < (2 * w + 1) ** 2 * 0.6) continue;
    const f = s.fit();
    if (f && f.rms <= ROOF_FACES.localRms) local.set(i, f);
  }

  // Grown into faces, steadiest cell first.
  const seeds = [...local.entries()].sort((p, q) => p[1].rms - q[1].rms).map(([i]) => i);
  const faceOf = new Map<number, number>();
  const faces: { sums: Sums; a: number; b: number }[] = [];
  for (const seed of seeds) {
    if (faceOf.has(seed)) continue;
    const id = faces.length;
    const sf = local.get(seed)!;
    const face = { sums: new Sums(), a: sf.a, b: sf.b };
    faces.push(face);
    const queue = [seed];
    faceOf.set(seed, id);
    while (queue.length) {
      const i = queue.pop()!;
      face.sums.add(xOf(i % cols), yOf(Math.floor(i / cols)), t.heights[i]);
      if (face.sums.n % 64 === 0) {
        const f = face.sums.fit();
        if (f) [face.a, face.b] = [f.a, f.b];
      }
      for (const j of [i - 1, i + 1, i - cols, i + cols]) {
        if (faceOf.has(j)) continue;
        const f = local.get(j);
        if (!f) continue;
        if (Math.abs(f.a - face.a) > ROOF_FACES.sameSlope || Math.abs(f.b - face.b) > ROOF_FACES.sameSlope) continue;
        faceOf.set(j, id);
        queue.push(j);
      }
    }
  }
  const cellArea = cell * cell;
  const kept = faces
    .map((f, id) => ({ id, fit: f.sums.fit(), n: f.sums.n }))
    .filter((f): f is { id: number; fit: Fit; n: number } => f.fit !== null && f.n * cellArea >= ROOF_FACES.minArea / 2);
  if (!kept.length) return [];

  // Every roof cell to the plane it sits on, among the faces whose cells it neighbours (two cells round), else none.
  const owner = new Map<number, number>();
  for (const f of kept) for (const [i, id] of faceOf) if (id === f.id) owner.set(i, f.id);
  const byId = new Map(kept.map((f) => [f.id, f.fit]));
  for (let pass = 0; pass < 40; pass++) {
    const add: [number, number][] = [];
    for (const i of onRoof) {
      if (owner.has(i)) continue;
      const c = i % cols;
      const r = Math.floor(i / cols);
      const near = new Set<number>();
      for (const j of [i - 1, i + 1, i - cols, i + cols]) {
        const o = owner.get(j);
        if (o !== undefined) near.add(o);
      }
      if (!near.size) continue;
      let best = -1;
      let bestOff: number = ROOF_FACES.onPlane;
      for (const id of near) {
        const f = byId.get(id)!;
        const off = Math.abs(t.heights[i] - (f.a * xOf(c) + f.b * yOf(r) + f.c));
        if (off <= bestOff) [best, bestOff] = [id, off];
      }
      // A cell a little off every neighbouring plane (a gutter's lip, a vent) still goes to the nearest face, so outlines
      // close up; one well off them all (a step down to another roof) is left.
      if (best >= 0) add.push([i, best]);
      else {
        let near2 = -1;
        let off2 = ROOF_FACES.onPlane * 2;
        for (const id of near) {
          const f = byId.get(id)!;
          const off = Math.abs(t.heights[i] - (f.a * xOf(c) + f.b * yOf(r) + f.c));
          if (off <= off2) [near2, off2] = [id, off];
        }
        if (near2 >= 0) add.push([i, near2]);
      }
    }
    if (!add.length) break;
    for (const [i, id] of add) owner.set(i, id);
  }

  // The home's own faces: the one under the address (else the nearest), and every face joined to them along a seam
  // where the heights run on (a ridge, a hip, a valley). A neighbour's roof that Nearmap's outline runs into meets
  // this one at a step, so it isn't joined (9 Nov 2026: 29 Shearer Drive's outline took in the house next door).
  const seam = new Map<string, number>();
  for (const [i, id] of owner) {
    for (const j of [i + 1, i + cols]) {
      const o = owner.get(j);
      if (o === undefined || o === id) continue;
      if (Math.abs(t.heights[i] - t.heights[j]) > ROOF_FACES.seamStep) continue;
      const k = id < o ? `${id},${o}` : `${o},${id}`;
      seam.set(k, (seam.get(k) ?? 0) + 1);
    }
  }
  const linked = new Map<number, number[]>();
  for (const [k, n] of seam) {
    if (n * cell < ROOF_FACES.seamMin) continue;
    const [a, b] = k.split(",").map(Number);
    linked.set(a, [...(linked.get(a) ?? []), b]);
    linked.set(b, [...(linked.get(b) ?? []), a]);
  }
  const homeCol = Math.floor((home.x + t.widthM / 2) / cell);
  const homeRow = Math.floor((home.y + t.heightM / 2) / cell);
  let start = owner.get(homeRow * cols + homeCol);
  if (start === undefined) {
    let gap = Infinity;
    for (const [i, id] of owner) {
      const d = Math.hypot((i % cols) - homeCol, Math.floor(i / cols) - homeRow);
      if (d < gap) [gap, start] = [d, id];
    }
  }
  const home_ = new Set<number>(start === undefined ? [] : [start]);
  for (const queue = [...home_]; queue.length;)
    for (const n of linked.get(queue.pop()!) ?? [])
      if (!home_.has(n)) {
        home_.add(n);
        queue.push(n);
      }
  // A roof of the same home a storey below (a lower flat roof, a garage) meets it at a step too: kept when its middle
  // is within `nearHome` of the address (2 Hanwell Court's lower roof; the house next door at Shearer Drive is 13 m off).
  const middle = new Map<number, { x: number; y: number; n: number }>();
  for (const [i, id] of owner) {
    const m = middle.get(id) ?? { x: 0, y: 0, n: 0 };
    m.x += xOf(i % cols);
    m.y += yOf(Math.floor(i / cols));
    m.n += 1;
    middle.set(id, m);
  }
  for (const [id, m] of middle) if (Math.hypot(m.x / m.n - home.x, m.y / m.n - home.y) <= ROOF_FACES.nearHome) home_.add(id);

  // Joined faces sloping alike are one face (existing panels, or a vent, had cut it up): merged, largest first.
  const root = new Map<number, number>();
  const find = (id: number): number => {
    let r = id;
    while (root.has(r) && root.get(r) !== r) r = root.get(r)!;
    return r;
  };
  for (const id of home_) root.set(id, id);
  for (const [k, n] of seam) {
    if (n * cell < ROOF_FACES.seamMin) continue;
    const [a, b] = k.split(",").map(Number);
    if (!home_.has(a) || !home_.has(b)) continue;
    const fa = byId.get(a)!;
    const fb = byId.get(b)!;
    if (Math.abs(fa.a - fb.a) > ROOF_FACES.mergeSlope || Math.abs(fa.b - fb.b) > ROOF_FACES.mergeSlope) continue;
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) root.set(rb, ra);
  }
  const groups = new Map<number, Set<number>>();
  for (const [i, id] of owner) {
    if (!home_.has(id)) continue;
    const g = find(id);
    const set = groups.get(g) ?? new Set<number>();
    set.add(i);
    groups.set(g, set);
  }

  // Each face's plane, from the steady cells it holds; a steep narrow band (the wall where one roof steps down to
  // another, read through the heights) is no face.
  const planes = new Map<number, Fit>();
  for (const [g, cells] of groups) {
    const s = new Sums();
    for (const i of cells) if (local.has(i)) s.add(xOf(i % cols), yOf(Math.floor(i / cols)), t.heights[i]);
    const fit = s.fit() ?? byId.get(g)!;
    const areaM2 = cells.size * cellArea;
    const pitch = deg(Math.atan(Math.hypot(fit.a, fit.b)));
    if (areaM2 < ROOF_FACES.minArea || pitch >= ROOF_FACES.wall || (pitch > ROOF_FACES.steep && areaM2 < ROOF_FACES.steepMinArea)) continue;
    planes.set(g, fit);
  }
  // Then every part of the roof to the plane it sits on, among the faces close by: two faces meet where their planes
  // cross, which is the hip or the ridge, so the edges come out straight (growing by slope left them ragged and
  // overlapping; 9 Nov 2026, 29 Shearer Drive).
  const reach = ROOF_FACES.reassign;
  const final = new Map<number, Set<number>>([...planes.keys()].map((g) => [g, new Set<number>()]));
  const groupOf = new Map<number, number>();
  for (const [g, cells] of groups) if (planes.has(g)) for (const i of cells) groupOf.set(i, g);
  for (const i of onRoof) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const near = new Set<number>();
    for (let dr = -reach; dr <= reach; dr++)
      for (let dc = -reach; dc <= reach; dc++) {
        const g = groupOf.get((r + dr) * cols + (c + dc));
        if (g !== undefined) near.add(g);
      }
    let best = -1;
    let bestOff = Infinity;
    for (const g of near) {
      const f = planes.get(g)!;
      const off = Math.abs(t.heights[i] - (f.a * xOf(c) + f.b * yOf(r) + f.c));
      if (off < bestOff) [best, bestOff] = [g, off];
    }
    if (best >= 0 && bestOff <= ROOF_FACES.onPlane * 2) final.get(best)!.add(i);
  }

  // Tidied: each cell takes the face most of the cells round it have (two passes over a 5 × 5), so the noise of tiles
  // and of panels on the roof doesn't fray the edges; a cell no face is near stays off.
  const label = new Map<number, number>();
  for (const [g, set] of final) for (const i of set) label.set(i, g);
  for (let pass = 0; pass < ROOF_FACES.tidyPasses; pass++) {
    const next = new Map<number, number>();
    for (const i of onRoof) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const votes = new Map<number, number>();
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const g = label.get((r + dr) * cols + (c + dc));
          if (g !== undefined) votes.set(g, (votes.get(g) ?? 0) + 1);
        }
      let best = -1;
      let most = 0;
      for (const [g, n] of votes) if (n > most) [best, most] = [g, n];
      if (best >= 0 && most >= 9) next.set(i, best);
    }
    label.clear();
    for (const [i, g] of next) label.set(i, g);
  }
  for (const set of final.values()) set.clear();
  for (const [i, g] of label) final.get(g)!.add(i);

  // A small face set inside another is part of it (10 Nov 2026, Martin: at 29 Shearer Drive the existing panels on the
  // west face, lying a few degrees flatter than the tiles, were read as a face of their own inside it).
  for (const [, set] of [...final].sort((p, q) => p[1].size - q[1].size)) {
    if (!set.size || set.size * cellArea >= ROOF_FACES.enclosedMax) continue;
    const round = new Map<number, number>();
    let edge = 0;
    for (const i of set)
      for (const j of [i - 1, i + 1, i - cols, i + cols]) {
        if (set.has(j)) continue;
        edge++;
        const h = label.get(j);
        if (h !== undefined) round.set(h, (round.get(h) ?? 0) + 1);
      }
    let into = -1;
    let most = 0;
    for (const [h, n] of round) if (n > most) [into, most] = [h, n];
    if (into < 0 || most / edge < ROOF_FACES.enclosedShare) continue;
    for (const i of set) {
      label.set(i, into);
      final.get(into)!.add(i);
    }
    set.clear();
  }

  // Which faces meet (their cells touch), for straightening the seams between them.
  const ownerOf = new Map<number, number>();
  for (const [g, set] of final) for (const i of set) ownerOf.set(i, g);
  const meets = new Map<number, Set<number>>();
  for (const [i, g] of ownerOf)
    for (const j of [i + 1, i + cols]) {
      const h = ownerOf.get(j);
      if (h === undefined || h === g) continue;
      meets.set(g, (meets.get(g) ?? new Set()).add(h));
      meets.set(h, (meets.get(h) ?? new Set()).add(g));
    }

  const out: FoundFace[] = [];
  for (const [g, all] of final) {
    // The largest piece only: a stray cell or two on the plane elsewhere isn't this face.
    const cells = largestPiece(all, cols);
    const areaM2 = cells.size * cellArea;
    if (areaM2 < ROOF_FACES.minArea) continue;
    const ring = ringOf(cells, cols).map(([c, r]) => ({ x: -t.widthM / 2 + c * cell, y: -t.heightM / 2 + r * cell }));
    if (ring.length < 3) continue;
    let points = simplifyRing(ring, ROOF_FACES.simplify);
    for (let tol = ROOF_FACES.simplify * 1.5; points.length > FACE_MAX_POINTS; tol *= 1.5) points = simplifyRing(ring, tol);
    // Straight edges (9 Nov 2026, Martin: the faces' edges wandered, and the rows laid from them came out staggered):
    // each corner onto the line where this face's plane meets a neighbour's (the true hip, ridge or valley), or onto the
    // roof's outline, whichever is near; where two of them are near, onto the point they cross.
    const plane = planes.get(g)!;
    const seams = [...(meets.get(g) ?? [])]
      .map((h) => planes.get(h))
      .filter((p): p is Fit => Boolean(p))
      .map((p) => ({ A: plane.a - p.a, B: plane.b - p.b, C: plane.c - p.c }))
      .filter((l) => Math.hypot(l.A, l.B) > 0.05);
    points = simplifyRing(
      points.map((v) => straighten(v, seams, outline)),
      0.05,
    );
    if (points.length < 3) continue;
    out.push({
      points: points.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })),
      aspect: aspectOf(plane),
      areaM2: Math.round(areaM2 * 10) / 10,
    });
  }
  return out.sort((a, b) => b.areaM2 - a.areaM2).slice(0, most);
}

/** A corner moved onto the nearest of a face's seams (lines A·x + B·y + C = 0) and the outline's edges, when near. */
function straighten(v: Point, seams: { A: number; B: number; C: number }[], outline: Point[]): Point {
  type Line = { p: Point; d: Point };
  const lines: { line: Line; gap: number; foot: Point }[] = [];
  for (const s of seams) {
    const n = Math.hypot(s.A, s.B);
    const gap = (s.A * v.x + s.B * v.y + s.C) / n;
    const foot = { x: v.x - (gap * s.A) / n, y: v.y - (gap * s.B) / n };
    lines.push({ line: { p: foot, d: { x: -s.B / n, y: s.A / n } }, gap: Math.abs(gap), foot });
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.3) continue;
    const k = Math.max(0, Math.min(1, ((v.x - a.x) * dx + (v.y - a.y) * dy) / (len * len)));
    const foot = { x: a.x + k * dx, y: a.y + k * dy };
    lines.push({ line: { p: a, d: { x: dx / len, y: dy / len } }, gap: Math.hypot(v.x - foot.x, v.y - foot.y), foot });
  }
  const near = lines.filter((l) => l.gap <= ROOF_FACES.snap).sort((x, y) => x.gap - y.gap);
  if (!near.length) return v;
  // Two lines near and not alike in direction: the corner where they cross, when that is near too.
  for (let j = 1; j < near.length; j++) {
    const [l1, l2] = [near[0].line, near[j].line];
    const det = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
    if (Math.abs(det) < 0.25) continue;
    const s = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / det;
    const x = { x: l1.p.x + s * l1.d.x, y: l1.p.y + s * l1.d.y };
    if (Math.hypot(x.x - v.x, x.y - v.y) <= ROOF_FACES.snap * 1.5) return x;
  }
  return near[0].foot;
}

/** What the designer says when it has put the faces down from the heights. */
export function facesFoundNote(count: number, captured: string | null): string {
  return `${count} roof face${count === 1 ? "" : "s"} read from Nearmap's heights${captured ? ` (${captured})` : ""}, each with its own slope and direction. Check them against the picture: change or remove any that's wrong.`;
}
