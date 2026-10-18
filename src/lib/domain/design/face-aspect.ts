/**
 * Which way a traced roof face slopes, and how steeply: read from Google's
 * heights for the place, so the panels on it face down the slope without
 * anyone choosing a direction. Pure, tested.
 *
 * A roof face is close to a flat plane, so a plane fitted through the heights
 * inside its outline (kept a little in from the edges, where gutters, ridges
 * and the ground beside them sit) tilts the way the face does: the way down
 * it is the direction the panels look, and its steepness is the pitch.
 * Heights that stand well off the plane (a tree over the roof, a chimney, an
 * aerial) are set aside and the plane fitted again. A face whose heights
 * still don't lie on one plane (a hip traced as one face, a roof rebuilt since
 * Google measured it) gives no answer, and the second opinion is Google's own
 * roof model: the face of it with the most panel spots inside the outline.
 *
 * Either way it is a starting point to check against the picture, never a
 * measurement: Google's heights can be older than the roof.
 */
import type { RoofModel } from "../roof-layout";
import { FACINGS, angleOfLongestEdge, clearOf, type Face, type Facing, type Point } from "./roof-design";
import type { Terrain } from "./shade";
import { TILT } from "./tilt";

export const ASPECT = {
  /** Heights this close to the outline are left out, metres. */
  edge: 0.4,
  /** Fewer heights than this inside the outline aren't enough to go on. */
  minCells: 16,
  /** The most the heights may stray from the plane, on average, metres. */
  maxRms: 0.12,
  /** At least this share of the heights must lie on the plane. */
  minKept: 0.6,
  /** A height further than this off the first plane is set aside before fitting again, metres (or twice the spread, if more). */
  outlier: 0.25,
  /** Below this many degrees a roof is taken to be flat: it has no direction to speak of. */
  flatBelow: 3,
  /** Google's roof model and the heights disagreeing by more than this many degrees is worth a look. */
  disagree: 30,
} as const;

export interface FaceAspect {
  /** The way down the slope: degrees clockwise from north. */
  azimuth: number;
  /** Degrees up from flat. */
  pitch: number;
  /** Under `ASPECT.flatBelow`: the direction means nothing. */
  flat: boolean;
  from: "heights" | "roof model";
}

const turn360 = (degrees: number) => ((degrees % 360) + 360) % 360;
const deg = (r: number) => (r * 180) / Math.PI;

interface Sample {
  x: number;
  y: number;
  z: number;
}

/** The plane z = a·x + b·y + c through the samples by least squares, and how far each is off it. */
function fitPlane(samples: Sample[]): { a: number; b: number; c: number; off: number[]; rms: number } | null {
  const n = samples.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const s of samples) {
    mx += s.x;
    my += s.y;
    mz += s.z;
  }
  mx /= n;
  my /= n;
  mz /= n;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  let xz = 0;
  let yz = 0;
  for (const s of samples) {
    const dx = s.x - mx;
    const dy = s.y - my;
    const dz = s.z - mz;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
    xz += dx * dz;
    yz += dy * dz;
  }
  const det = xx * yy - xy * xy;
  // The samples all on one line: no plane through them.
  if (Math.abs(det) < 1e-9) return null;
  const a = (xz * yy - yz * xy) / det;
  const b = (yz * xx - xz * xy) / det;
  const c = mz - a * mx - b * my;
  const off = samples.map((s) => s.z - (a * s.x + b * s.y + c));
  const rms = Math.sqrt(off.reduce((t, r) => t + r * r, 0) / n);
  return { a, b, c, off, rms };
}

/** The heights inside an outline, kept `ASPECT.edge` in from its edges. Points are metres from the picture's middle, x east, y south. */
function heightsInside(points: Point[], t: Terrain): Sample[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) + t.widthM / 2) / t.cell));
  const c1 = Math.min(t.cols - 1, Math.ceil((Math.max(...xs) + t.widthM / 2) / t.cell));
  const r0 = Math.max(0, Math.floor((Math.min(...ys) + t.heightM / 2) / t.cell));
  const r1 = Math.min(t.rows - 1, Math.ceil((Math.max(...ys) + t.heightM / 2) / t.cell));
  const out: Sample[] = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const p = { x: -t.widthM / 2 + (c + 0.5) * t.cell, y: -t.heightM / 2 + (r + 0.5) * t.cell };
      if (!clearOf(p, points, ASPECT.edge)) continue;
      const z = t.heights[r * t.cols + c];
      if (Number.isFinite(z)) out.push({ ...p, z });
    }
  return out;
}

/**
 * A face's slope from the heights inside its outline, or null when they don't lie on one plane (or there are
 * too few of them, or the outline is off the grid).
 */
export function aspectFromHeights(points: Point[], terrain: Terrain): FaceAspect | null {
  if (points.length < 3) return null;
  const all = heightsInside(points, terrain);
  if (all.length < ASPECT.minCells) return null;
  const first = fitPlane(all);
  if (!first) return null;
  const limit = Math.max(ASPECT.outlier, 2 * first.rms);
  const kept = all.filter((_, i) => Math.abs(first.off[i]) <= limit);
  if (kept.length < ASPECT.minCells || kept.length < all.length * ASPECT.minKept) return null;
  const plane = fitPlane(kept);
  if (!plane || plane.rms > ASPECT.maxRms) return null;
  // Uphill is (a, b) in metres east and south; the way down, as a bearing, is east -a and north +b.
  const pitch = deg(Math.atan(Math.hypot(plane.a, plane.b)));
  return {
    azimuth: Math.round(turn360(deg(Math.atan2(-plane.a, plane.b)))),
    pitch: Math.round(pitch * 10) / 10,
    flat: pitch < ASPECT.flatBelow,
    from: "heights",
  };
}

/**
 * A face's slope from Google's roof model: the model's face with the most panel spots inside the outline (at
 * least two). `centre` is the middle of the picture the outline is drawn on.
 */
export function aspectFromModel(points: Point[], model: RoofModel, centre: { lat: number; lng: number }): FaceAspect | null {
  if (points.length < 3) return null;
  const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
  const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
  const count = new Map<number, number>();
  for (const s of model.slots) {
    const p = { x: (s.lng - centre.lng) * mLng, y: -(s.lat - centre.lat) * mLat };
    if (clearOf(p, points, 0)) count.set(s.segment, (count.get(s.segment) ?? 0) + 1);
  }
  const [segment, spots] = [...count.entries()].reduce((a, b) => (b[1] > a[1] ? b : a), [-1, 0]);
  const face = model.faces[segment];
  if (spots < 2 || !face) return null;
  return { azimuth: Math.round(turn360(face.azimuth)), pitch: face.pitch, flat: face.pitch < ASPECT.flatBelow, from: "roof model" };
}

/** The difference between two bearings, 0 to 180. */
export const bearingGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

export interface AspectReading {
  aspect: FaceAspect;
  /** The heights and Google's roof model both answered, and point more than `ASPECT.disagree` apart. */
  disagrees: boolean;
}

/** A face's slope: from the heights where they answer, else from Google's roof model. Null when neither does. */
export function readAspect(input: {
  points: Point[];
  terrain?: Terrain | null;
  model?: RoofModel | null;
  centre: { lat: number; lng: number };
}): AspectReading | null {
  const heights = input.terrain ? aspectFromHeights(input.points, input.terrain) : null;
  const model = input.model ? aspectFromModel(input.points, input.model, input.centre) : null;
  const aspect = heights ?? model;
  if (!aspect) return null;
  const disagrees = Boolean(
    heights && model && !heights.flat && !model.flat && bearingGap(heights.azimuth, model.azimuth) > ASPECT.disagree,
  );
  return { aspect, disagrees };
}

/** The compass point nearest a bearing. */
export function facingOf(bearing: number): Facing {
  return FACINGS[Math.round(turn360(bearing) / 45) % 8];
}

/**
 * How a face's panels sit once its slope is known: rows along the gutter (square to the way down), looking
 * down the slope, at the roof's pitch. A flat face keeps rows along its longest edge, looking north.
 */
export function faceFromAspect(face: Pick<Face, "points">, aspect: FaceAspect): Pick<Face, "angle" | "facing" | "tilt"> {
  const tilt = Math.max(0, Math.min(TILT.max, Math.round(aspect.pitch)));
  if (aspect.flat) return { angle: angleOfLongestEdge(face), facing: "N", tilt };
  // A row's angle is the bearing its panels look, with either side of the row the same: kept between -90 and 90.
  const angle = ((((aspect.azimuth + 90) % 180) + 180) % 180) - 90;
  return { angle: Math.round(angle), facing: facingOf(aspect.azimuth), tilt };
}
