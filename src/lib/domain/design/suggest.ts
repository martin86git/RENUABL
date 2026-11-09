/**
 * "Suggest a layout": a first set of panels for a roof from Google's roof
 * model, laid the way an installer would. Pure, tested.
 *
 * Google's model says where on the roof a panel can go (every spot it found,
 * each on a roof face with that face's direction and pitch). Those spots are
 * used only as the area each face offers: the panels are laid afresh by the
 * installer's rules in `pack.ts` (rows from the gutter up in a pyramid,
 * portrait and landscape mixed to fit the most, clear of every edge for wind, one face
 * per array, the fewest arrays). Google's own spots are often landscape and
 * laid at odd angles on flat roofs; copying them gave blocks stacked at angles
 * and panels hanging off the roof. Faces flatter than `FLAT_FACE` are taken
 * together as one flat roof, with rows along its longer side.
 *
 * Google's model can be older than the roof (2 Hanwell Court, Glen Waverley:
 * the 2018 house), so the designer checks it lines up with today's photo
 * before using it. Whatever comes out is a starting point to check against
 * the picture: it knows nothing of vents, skylights or setbacks it isn't shown.
 */
import type { RoofModel } from "../roof-layout";
import { metresPerPixel, type LoosePanel, type PanelSize } from "./roof-design";
import { FACE_EDGE, hull } from "./drawing";
import { avoiding, packAreas, type Area } from "./pack";

/** The most panels a suggestion lays out. */
export const MAX_SUGGESTED = 60;
/** Faces flatter than this many degrees are taken together as one flat roof. */
export const FLAT_FACE = 5;

const cm = (n: number) => Math.round(n * 100) / 100;
const rad = (d: number) => (d * Math.PI) / 180;
const turn360 = (d: number) => ((d % 360) + 360) % 360;

interface Pt {
  x: number;
  y: number;
}

/** One of Google's spots on the ground (metres east and south of the picture's middle), as the area it covers. */
interface Footprint {
  centre: Pt;
  /** Down its face's slope, and across it, as unit vectors on the ground. */
  down: Pt;
  side: Pt;
  /** Half its length down the slope (seen from above) and across. */
  halfDown: number;
  halfSide: number;
  kwh: number;
}

/** A group of spots panels are laid on together: one sloped face, or every flat one. */
interface Group {
  /** The way the panels look, clockwise from north. */
  facing: number;
  pitch: number;
  spots: Footprint[];
}

const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
/** On the ground, east and south: the way down a slope that looks towards `bearing`. */
const downOf = (bearing: number): Pt => ({ x: Math.sin(rad(bearing)), y: -Math.cos(rad(bearing)) });
const sideOf = (bearing: number): Pt => ({ x: Math.cos(rad(bearing)), y: Math.sin(rad(bearing)) });

/** Whether a point is on one of the spots (a couple of centimetres' grace for rounding). */
const covered = (p: Pt, spots: Footprint[], reach = 0.03) =>
  spots.some((s) => {
    const d = { x: p.x - s.centre.x, y: p.y - s.centre.y };
    return Math.abs(dot(d, s.down)) <= s.halfDown + reach && Math.abs(dot(d, s.side)) <= s.halfSide + reach;
  });

/**
 * `covered` for one set of spots, answered from a grid of `CELL` metre squares so each point looks only at the spots
 * near it: the packer asks millions of times, and a big roof has hundreds of spots (2 Nov 2026: a commercial roof
 * of 400 froze the designer). Same answer as `covered`.
 */
const CELL = 2;
function coverer(spots: Footprint[], reach: number): (p: Pt) => boolean {
  const cells = new Map<number, Footprint[]>();
  const cell = (i: number, j: number) => (i + 50_000) * 100_000 + (j + 50_000);
  for (const s of spots) {
    // The farthest a covered point can be from the spot's centre.
    const r = Math.hypot(s.halfDown + reach, s.halfSide + reach);
    for (let i = Math.floor((s.centre.x - r) / CELL); i <= Math.floor((s.centre.x + r) / CELL); i++)
      for (let j = Math.floor((s.centre.y - r) / CELL); j <= Math.floor((s.centre.y + r) / CELL); j++) {
        const key = cell(i, j);
        const list = cells.get(key);
        if (list) list.push(s);
        else cells.set(key, [s]);
      }
  }
  return (p) => {
    const near = cells.get(cell(Math.floor(p.x / CELL), Math.floor(p.y / CELL)));
    return near ? covered(p, near, reach) : false;
  };
}

/** The direction of the longer side of a scatter of points, as a bearing (0 to 180). */
function longAxis(points: Pt[]): number {
  const n = points.length;
  const mx = points.reduce((t, p) => t + p.x, 0) / n;
  const my = points.reduce((t, p) => t + p.y, 0) / n;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const p of points) {
    xx += (p.x - mx) ** 2;
    xy += (p.x - mx) * (p.y - my);
    yy += (p.y - my) ** 2;
  }
  // The main axis of the spread, as an angle from east (y is south, so clockwise), then as a bearing.
  const fromEast = 0.5 * Math.atan2(2 * xy, xx - yy);
  return turn360(90 + (fromEast * 180) / Math.PI) % 180;
}

/**
 * Below this pitch, Google's measure of which way a face looks can't be trusted (a nearly flat roof barely slopes
 * any way), so its rows are set square with the house instead.
 */
export const LOW_PITCH = 12;

/**
 * The way the house is set out: the direction its roof lines run, as an angle from 0 to 90, from its pitched faces'
 * directions (a hip roof's faces look four ways at right angles), the faces with more spots counting more.
 */
export function houseGrid(faces: { facing: number; weight: number }[]): number | null {
  let x = 0;
  let y = 0;
  for (const f of faces) {
    // Four times the angle, so directions a quarter turn apart count as the same line.
    x += f.weight * Math.cos(rad(f.facing * 4));
    y += f.weight * Math.sin(rad(f.facing * 4));
  }
  if (Math.hypot(x, y) < 1e-9) return null;
  return turn360((Math.atan2(y, x) * 180) / Math.PI / 4) % 90;
}

/** The direction square with the house (`grid`, plus a quarter turn or more) nearest a given one. */
export function squareTo(grid: number, facing: number): number {
  return turn360(grid + Math.round((facing - grid) / 90) * 90);
}

/**
 * Rows square with the roof lines (Martin, 3 Bill Place: panels are never laid askew to the roof). A pitched face's
 * rows follow Google's measure of it, which its spots are laid along; a nearly flat one's (under `LOW_PITCH`) are
 * turned square with the house, set out from the pitched faces.
 */
function squared(groups: Group[]): Group[] {
  const pitched = groups.filter((g) => g.pitch >= LOW_PITCH);
  const grid = houseGrid(pitched.map((g) => ({ facing: g.facing, weight: g.spots.length })));
  if (grid === null) return groups;
  return groups.map((g) => (g.pitch < LOW_PITCH ? { ...g, facing: squareTo(grid, g.facing) } : g));
}

/** Google's spots, grouped: each sloped face on its own, the flat ones together. */
function groupsOf(model: RoofModel, centre: { lat: number; lng: number }, offset: Pt): Group[] {
  const mLat = 111_132.954 - 559.822 * Math.cos(2 * rad(centre.lat));
  const mLng = 111_412.84 * Math.cos(rad(centre.lat));
  const bySegment = new Map<number, Footprint[]>();
  for (const s of model.slots) {
    const face = model.faces[s.segment];
    if (!face) continue;
    const portrait = s.orientation === "PORTRAIT";
    const along = portrait ? model.panel.heightM : model.panel.widthM;
    const across = portrait ? model.panel.widthM : model.panel.heightM;
    const spot: Footprint = {
      centre: { x: (s.lng - centre.lng) * mLng + offset.x, y: -(s.lat - centre.lat) * mLat + offset.y },
      down: downOf(face.azimuth),
      side: sideOf(face.azimuth),
      halfDown: (along * Math.cos(rad(face.pitch))) / 2,
      halfSide: across / 2,
      kwh: s.kwh,
    };
    bySegment.set(s.segment, [...(bySegment.get(s.segment) ?? []), spot]);
  }
  const groups: Group[] = [];
  const flat: Footprint[] = [];
  const flatPitches: number[] = [];
  for (const [segment, spots] of bySegment) {
    const face = model.faces[segment];
    if (face.pitch < FLAT_FACE) {
      flat.push(...spots);
      flatPitches.push(face.pitch);
    } else groups.push({ facing: turn360(face.azimuth), pitch: face.pitch, spots });
  }
  if (flat.length) {
    // Rows along the flat roof's longer side, the panels looking whichever way across it is nearer north.
    const axis = longAxis(flat.map((s) => s.centre));
    const facing = [turn360(axis - 90), turn360(axis + 90)].reduce((a, b) => (Math.min(b, 360 - b) < Math.min(a, 360 - a) ? b : a));
    groups.push({ facing, pitch: Math.max(...flatPitches), spots: flat });
  }
  return squared(groups);
}

/** A group of Google's spots as a face to pack (`pack.ts`): on it means on one of its spots. */
function areaOf(group: Group, others: Group[]): Area {
  // The face: its spots, each reaching `FACE_EDGE` past its edges as a roof's edge does (which bridges the gaps
  // where Google staggered them, without filling in what isn't roof), and never a point on another face's spots,
  // so an array can't reach across onto the next roof. The packer keeps its distance from that edge.
  const outline = hull(
    group.spots.flatMap((s) =>
      [-1, 1].flatMap((a) =>
        [-1, 1].map((b) => ({
          x: s.centre.x + a * (s.halfDown + FACE_EDGE) * s.down.x + b * (s.halfSide + FACE_EDGE) * s.side.x,
          y: s.centre.y + a * (s.halfDown + FACE_EDGE) * s.down.y + b * (s.halfSide + FACE_EDGE) * s.side.y,
        })),
      ),
    ),
  );
  const onThis = coverer(group.spots, FACE_EDGE);
  const onOthers = others.map((o) => coverer(o.spots, 0));
  return {
    facing: group.facing,
    pitch: group.pitch,
    covers: (p) => onThis(p) && !onOthers.some((on) => on(p)),
    outline,
    sun: group.spots.reduce((t, s) => t + s.kwh, 0) / group.spots.length,
  };
}

/**
 * The faces to pack for a model where it sits, made once and kept with the model: Design it for me lays every count
 * from a handful to the whole roof on the same faces, and the packer keeps what it learns about each (`pack.ts`).
 */
const madeAreas = new WeakMap<RoofModel, Map<string, Area[]>>();
function areasFor(model: RoofModel, centre: { lat: number; lng: number }, offset: Pt): Area[] {
  const key = `${centre.lat},${centre.lng},${offset.x},${offset.y}`;
  const byPlace = madeAreas.get(model) ?? new Map<string, Area[]>();
  madeAreas.set(model, byPlace);
  const kept = byPlace.get(key);
  if (kept) return kept;
  const groups = groupsOf(model, centre, offset);
  const areas = groups.map((g) =>
    areaOf(
      g,
      groups.filter((o) => o !== g),
    ),
  );
  byPlace.set(key, areas);
  return areas;
}

export function suggestPanels(
  model: RoofModel,
  /** The middle of the picture: panels are placed in metres from it. */
  centre: { lat: number; lng: number },
  count: number,
  size: PanelSize,
  newId: () => string,
  /** Where Google's model sits on the picture, in metres east and south: from lining it up with today's photo. */
  offset: Pt = { x: 0, y: 0 },
  /** Places to keep clear (existing panels, vents: `roof-check.ts`), outlines in metres. */
  avoid?: readonly Pt[][],
): LoosePanel[] {
  const areas = areasFor(model, centre, offset).map((a) => avoiding(a, avoid));
  return packAreas(areas, Math.min(MAX_SUGGESTED, count), size, newId, MAX_SUGGESTED);
}

/**
 * Where Google's model sits on the designer's photo, in metres east and south, from the shift that lines the
 * satellite photo up with Google Solar's own (`satelliteShift`, in the photo's pixels at 2x): a true point shows
 * on the satellite photo the shift's opposite away.
 */
export function modelOffset(shift: { x: number; y: number }, lat: number): Pt {
  const perPixel = metresPerPixel(lat) / 2;
  return { x: cm(-shift.x * perPixel) || 0, y: cm(-shift.y * perPixel) || 0 };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** When Google photographed a roof, in words ("December 2018"), from its "2018-12"; null when it doesn't say. */
export function imageryWhen(date: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Why panels aren't placed from Google's model when its photo of the roof doesn't match today's. On a Nearmap picture
 * (`nearmap`: when it was captured, in words, or null) it says where the roof faces come from: Google's measurements,
 * since Nearmap gives the photo only.
 */
export function mismatchNote(date: string | null | undefined, nearmap?: string | null): string {
  const when = imageryWhen(date);
  const trace = "Trace the roof faces on the picture and ask again: panels are laid on what you trace.";
  if (nearmap !== undefined) {
    return (
      `The roof faces and pitches come from Google's measurements${when ? ` (${when})` : ""}, not Nearmap, which gives the photo only. ` +
      `That roof doesn't match the roof today, so they can't be laid on this Nearmap photo${nearmap ? ` (${nearmap})` : ""}. ` +
      trace
    );
  }
  return (
    `Google's roof data${when ? ` (photographed ${when})` : ""} doesn't line up with today's photo, so the roof may have changed since. ` +
    trace
  );
}
