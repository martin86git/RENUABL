/**
 * The design drawn on Nearmap's angled photos (12 Nov 2026, Martin: "can we make the panel design appear on the
 * sides?"). Pure, tested. Where a point on the roof shows on one of the side views `nearmapOblique` makes.
 *
 * How the side views are made (server/nearmap.ts): the oblique tiles at zoom 21 round the point, laid north-up as the
 * vertical ones are (the same tile numbers cover the same ground), an 800 px square, then turned so the camera's way is
 * up, then squashed to 3/4 height. The tiles are set on the ground, so a point on the ground lands where it is; a
 * point higher up is seen further along the camera's way, by more than its height (`OBLIQUE.lean` ground metres for each
 * metre up: 1.4 fitted by eye on 29 Shearer Drive's north and east views, as for a camera about 35° up; VERIFY on more roofs).
 */
import { ROOF_IMAGE, type Point } from "./roof-design";

export const OBLIQUE = {
  /** The side view's square before it is squashed, px. */
  side: 800,
  /** It is squashed to this share of its height. */
  squash: 3 / 4,
  /** Ground metres a point is seen along the camera's way for each metre it stands above the ground. */
  lean: 1.4,
  /** The zoom the oblique tiles are read at. */
  zoom: ROOF_IMAGE.zoom + 1,
} as const;

/** The way each side view's camera looks, degrees clockwise from north. */
export const OBLIQUE_HEADINGS = { North: 0, East: 90, South: 180, West: 270 } as const;
export type ObliqueSide = keyof typeof OBLIQUE_HEADINGS;

/** Metres a pixel of the side view covers on the ground before it is squashed. */
export function obliqueMetresPerPixel(lat: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** OBLIQUE.zoom;
}

/**
 * Where a point shows on a side view, in its pixels (800 × 600): `x` metres east and `y` metres south of the
 * picture's middle (the designer's own frame), `up` metres above the ground.
 */
export function onObliqueView(p: { x: number; y: number; up: number }, side: ObliqueSide, lat: number): Point {
  const r = (OBLIQUE_HEADINGS[side] * Math.PI) / 180;
  // Turned so the camera's way is up (the composite is turned back by the heading).
  const across = p.x * Math.cos(r) + p.y * Math.sin(r);
  const down = -p.x * Math.sin(r) + p.y * Math.cos(r) - p.up * OBLIQUE.lean;
  const mpp = obliqueMetresPerPixel(lat);
  return {
    x: OBLIQUE.side / 2 + across / mpp,
    y: (OBLIQUE.side / 2 + down / mpp) * OBLIQUE.squash,
  };
}

/** The ground's height round the home: a low share of every height in reach, so roofs and trees don't lift it. */
export function groundHeight(heights: ArrayLike<number>): number | null {
  const all = Array.from(heights).filter((h) => Number.isFinite(h) && h > 0);
  if (all.length < 20) return null;
  all.sort((a, b) => a - b);
  return all[Math.floor(all.length * 0.05)];
}
