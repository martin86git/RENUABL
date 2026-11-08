/**
 * Nearmap in the designer (3 Nov 2026, Martin): the words for a capture and what it offers. Pure, tested in
 * `nearmap.test.ts`.
 */

import { inside, metresPerPixel, ROOF_IMAGE, type Point } from "./roof-design";

/** A capture's date in words: "2 Sep 2026". */
export const capturedWords = (iso: string | null) =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "date not given";

export interface NearmapOffers {
  /** The roof's heights (DSM, DTM or other elevation data). */
  heights: boolean;
  /** A true ortho: every point drawn straight down, buildings included. */
  trueOrtho: boolean;
  mesh: boolean;
  /** Pictures from the side. */
  obliques: boolean;
}

/**
 * What a capture offers that designing by itself would use, read from the names Nearmap's Coverage API gives its
 * resources with this key: a guide to what the subscription reaches at the roof, not a promise of what each delivers.
 */
export function offersOf(resources: readonly string[]): NearmapOffers {
  const has = (re: RegExp) => resources.some((r) => re.test(r));
  return {
    heights: has(/dsm|dem\b|dtm|elevation/i),
    trueOrtho: has(/true\s*ortho/i),
    mesh: has(/mesh|\b3d\b/i),
    obliques: has(/:(north|south|east|west)\b|oblique|panorama/i),
  };
}

/** How far back the designer offers Nearmap's captures of a roof (Martin, 3 Nov 2026: the last two years). */
export const NEARMAP_YEARS = 2;

/** The captures from the last `years` up to `today` (YYYY-MM-DD, the market's day), newest first. */
export function recentCaptures<T extends { captured: string }>(captures: readonly T[], today: string, years = NEARMAP_YEARS): T[] {
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y - years, m - 1, d)).toISOString().slice(0, 10);
  return captures.filter((c) => c.captured >= from && c.captured <= today).sort((a, b) => b.captured.localeCompare(a.captured));
}

/**
 * Nearmap's roof outline as a traced face (5 Nov 2026, Martin): when Google's roof data is older than the roof (a
 * rebuild) and a Nearmap picture is in use, the outline Nearmap's AI features draw round the roof in that same capture
 * is put down as a face, in the designer's own frame. Only the outline: the plan reaches no heights, so its pitch and
 * which way it looks aren't known (a flat roof is laid on as it is; a pitched one is split into its slopes by hand).
 */

/** A ring of Nearmap's polygon: [lng, lat] pairs, the last repeating the first. */
export type LngLatRing = readonly (readonly [number, number])[];

/** How far a roof's outline may be from the address and still be the home's (a front yard), in metres. */
export const OUTLINE_REACH_M = 10;
/** Corners closer than this to the line through their neighbours are dropped, in metres. */
export const OUTLINE_TOLERANCE_M = 0.15;
/** The most corners an outline keeps, so a face stays easy to drag into shape. */
export const OUTLINE_MAX_POINTS = 40;

const WORLD = 256 * 2 ** ROOF_IMAGE.zoom;
const mercator = (lat: number, lng: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * WORLD, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD };
};

/** A ring in metres from the middle of the designer's picture (x east, y south), as a traced face's points are kept. */
export function ringToPoints(ring: LngLatRing, centre: { lat: number; lng: number }): Point[] {
  const c = mercator(centre.lat, centre.lng);
  const k = metresPerPixel(centre.lat);
  const pts = ring.map(([lng, lat]) => {
    const p = mercator(lat, lng);
    return { x: Math.round((p.x - c.x) * k * 100) / 100, y: Math.round((p.y - c.y) * k * 100) / 100 };
  });
  const last = pts[pts.length - 1];
  return pts.length > 1 && last.x === pts[0].x && last.y === pts[0].y ? pts.slice(0, -1) : pts;
}

const lineGap = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len ? Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len : Math.hypot(p.x - a.x, p.y - a.y);
};

/** An outline with its near-straight corners dropped (Douglas–Peucker on the closed ring), at most `max` corners. */
export function simplifyOutline(points: readonly Point[], tolerance = OUTLINE_TOLERANCE_M, max = OUTLINE_MAX_POINTS): Point[] {
  if (points.length <= 3) return [...points];
  const run = (from: number, to: number, keep: boolean[], tol: number) => {
    let worst = -1;
    let at = -1;
    for (let i = from + 1; i < to; i++) {
      const d = lineGap(points[i], points[from], points[to % points.length]);
      if (d > worst) [worst, at] = [d, i];
    }
    if (at >= 0 && worst > tol) {
      keep[at] = true;
      run(from, at, keep, tol);
      run(at, to, keep, tol);
    }
  };
  // Split the ring at its first corner and the corner farthest from it, then simplify each half.
  const far = points.reduce(
    (best, p, i) =>
      Math.hypot(p.x - points[0].x, p.y - points[0].y) > Math.hypot(points[best].x - points[0].x, points[best].y - points[0].y) ? i : best,
    0,
  );
  let tol = tolerance;
  for (;;) {
    const keep = points.map((_, i) => i === 0 || i === far);
    run(0, far, keep, tol);
    run(far, points.length, keep, tol);
    const out = points.filter((_, i) => keep[i]);
    if (out.length <= max || tol > 5) return out;
    tol *= 1.5;
  }
}

/** How many corners a saved face kept before 8 Nov 2026: Nearmap's outlines were cut to it and closed across the roof. */
export const OLD_FACE_CORNERS = 16;

/**
 * A face saved from Nearmap's outline before faces kept every corner (8 Nov 2026, 2 Hanwell Court): its points are the
 * outline's first `OLD_FACE_CORNERS` exactly, so the outline's whole set of corners is given back. Any other face,
 * one traced by hand or changed since, is left as it is (null).
 */
export function mendCutOutline(points: readonly Point[], outline: readonly Point[] | null): Point[] | null {
  if (!outline || outline.length <= OLD_FACE_CORNERS || points.length !== OLD_FACE_CORNERS) return null;
  const same = points.every((p, i) => Math.abs(p.x - outline[i].x) < 0.01 && Math.abs(p.y - outline[i].y) < 0.01);
  return same ? outline.map((p) => ({ ...p })) : null;
}

/** The area inside an outline, in square metres. */
export function outlineArea(points: readonly Point[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

const edgeGap = (p: Point, polygon: readonly Point[]) => {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
};

/**
 * The home's roof among the outlines Nearmap found round the address: the one the address point is on, else the
 * nearest within `OUTLINE_REACH_M` (a front yard); never a neighbour's further off. Each outline is its outer ring
 * (Nearmap's polygons may carry holes for courtyards, which are left to be traced). Null when none is near.
 */
export function homeOutline(rings: readonly LngLatRing[], centre: { lat: number; lng: number }): Point[] | null {
  const origin = { x: 0, y: 0 };
  let best: { points: Point[]; gap: number } | null = null;
  for (const ring of rings) {
    const points = ringToPoints(ring, centre);
    if (points.length < 3) continue;
    const gap = inside(origin, points) ? 0 : edgeGap(origin, points);
    if (gap <= OUTLINE_REACH_M && (!best || gap < best.gap)) best = { points, gap };
  }
  return best ? simplifyOutline(best.points) : null;
}

/** What the designer says when it has put Nearmap's roof outline down as a face (`laid`: panels laid on it, if any). */
export function outlineNote(flat: boolean, captured: string | null, laid?: number): string {
  const when = captured ? ` (${capturedWords(captured)})` : "";
  if (!flat)
    return (
      `Nearmap's roof outline${when} is on the picture as one face. It's the whole roof, and Nearmap gives no pitch or direction, ` +
      "so drag its corners to one slope or trace each slope, then ask again. If the roof is flat, set it flat and ask again."
    );
  return (
    `${laid ? `${laid} panels laid on` : "Put down"} Nearmap's roof outline${when} as one flat face. ` +
    "Check its edges against the photo: it is the roof's outer edge, so anything on it (a skylight, a plant) still needs keeping clear."
  );
}
