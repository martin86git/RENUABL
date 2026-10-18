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
import { PANEL, faceFacing, inside, panelPlaces, type Face, type LoosePanel, type PanelSize, type Point } from "./roof-design";
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
}

/**
 * Up to `n` panels on one face: rows from the gutter up, each no longer than the one below and centred over it,
 * portrait unless only landscape fits there, every panel at least the clearance inside the face.
 */
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

  /** Whether a panel centred at (u, v), `across` wide and `along` down the slope, is wholly on the face with the clearance round it. */
  const fits = (u: number, v: number, across: number, along: number) => {
    const hu = across / 2 + edge;
    const hv = along / 2 + edge;
    for (const a of [-1, -0.5, 0, 0.5, 1])
      for (const b of [-1, -0.5, 0, 0.5, 1]) if (!area.covers(at(u + a * hu, v + b * hv))) return false;
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

  // First the rows the face holds, from the gutter up, each as long as it can be and no longer than the one below.
  type Row = { landscape: boolean; along: number; across: number; v: number; run: { a: number; b: number }; room: number };
  const rows: Row[] = [];
  let lowerEdge = v1;
  let below: { room: number; lo: number; hi: number } | null = null;
  while (lowerEdge > v0 && rows.length < 40) {
    const tryWay = (landscape: boolean) => {
      // Down the slope, as seen from above: shorter by the cosine of the pitch, as the designer draws it (`planSize`).
      const along = (landscape ? size.short : size.long) * Math.cos((tilt * Math.PI) / 180);
      const across = landscape ? size.long : size.short;
      const v = lowerEdge - along / 2;
      const found = runs(v, across, along);
      const overlap = (r: { a: number; b: number }) => (below ? Math.min(r.b, below.hi) - Math.max(r.a, below.lo) : 0);
      const run = found.reduce<(typeof found)[number] | null>((best, r) => {
        if (!best) return r;
        if (below) return overlap(r) > overlap(best) ? r : best;
        return r.count > best.count ? r : best;
      }, null);
      return { landscape, along, across, v, run, room: run ? Math.min(run.count, below?.room ?? Infinity) : 0 };
    };
    const upright = tryWay(false);
    const onSide = tryWay(true);
    // Portrait unless it fits fewer than two here and landscape fits more.
    const row = upright.room >= MIN_ROW || upright.room >= onSide.room ? upright : onSide;
    if (!row.run || row.room < MIN_ROW) {
      // Nothing yet: the gutter edge may be ragged, so look a little further up. Once rows have begun, the pyramid ends.
      if (below) break;
      lowerEdge -= STEP;
      continue;
    }
    rows.push({ landscape: row.landscape, along: row.along, across: row.across, v: row.v, run: row.run, room: row.room });
    below = { room: row.room, lo: row.run.a - row.across / 2, hi: row.run.b + row.across / 2 };
    lowerEdge = row.v - row.along / 2 - size.gap;
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
  const usable = areas.filter((a) => a.pitch <= STEEPEST).sort((a, b) => b.sun - a.sun);
  if (!usable.length) return [];
  const top = usable[0].sun;
  const sunny = usable.filter((a) => a.sun >= top * SUNNY_ENOUGH);
  let tried = 0;
  const room = new Map(sunny.map((a) => [a, packArea(a, most, size, () => `t${tried++}`).length]));

  const whole = sunny.find((a) => (room.get(a) ?? 0) >= want && a.sun >= top * 0.95);
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

/** A traced face as an area: on it means inside its outline and off any place switched off; its own distance from the edges, never under the wind rule. */
export function tracedArea(face: Face, size: PanelSize = PANEL): Area {
  const tilt = face.tilt ?? TILT.roof;
  // A place someone switched off (over a vent or a skylight, say) stays clear: panels are laid round it.
  const off = new Set(face.off);
  const blocked = panelPlaces(face, size)
    .filter((place) => off.has(place.index))
    .map((place) => place.corners);
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
export function packFaces(faces: Face[], size: PanelSize, n: number, newId: () => string): { faces: Face[]; loose: LoosePanel[] } {
  const loose = packAreas(
    faces.map((f) => tracedArea(f, size)),
    n,
    size,
    newId,
  );
  return { faces: faces.map((f) => ({ ...f, off: panelPlaces(f, size).map((p) => p.index) })), loose };
}
