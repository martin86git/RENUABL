/**
 * A design drawn on Nearmap's angled photos of the house (26 Nov 2026, Martin: "can i maintain the dock and toolbars to
 * be able to build an array using the side view?"; "i couldnt just lay panels flat on this"). Panels are laid on the
 * plan, where they are true rectangles on the roof; here each corner is put where it lands in the angled photo, from
 * where it is on the ground and how high it stands (the heights the shade is worked out from), so a panel lies along its
 * face in the photo, whatever the face's pitch. Pure, tested.
 *
 * The photo (`nearmapOblique` on the server) is Nearmap's Panorama tiles at zoom 21 round the point, turned so the
 * camera's way is up, its height squashed to 3/4. Its tiles lay the ground as the vertical photo does, and a point
 * standing up is moved along the camera's way by its height (photos taken at 45°): checked on 26 Nov 2026 against the
 * roofs round 28 Shearer Drive, Rowville, looking south and west. VERIFY on more roofs.
 */

import { heightAt, type Terrain } from "./shade";
import { metresPerPixel, type Point } from "./roof-design";

/** The angled photo as the server makes it, in pixels. */
export const OBLIQUE_PICTURE = { width: 800, height: 600 } as const;

/** Nearmap's four angled views and the way each camera looks, degrees from north. */
export const OBLIQUE_HEADINGS = { North: 0, East: 90, South: 180, West: 270 } as const;
export type ObliqueSide = keyof typeof OBLIQUE_HEADINGS;

/** How far a point standing up moves along the camera's way, for each metre of its height (45° photos). */
export const LIFT_PER_METRE = 1;

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Where a point lands in the angled photo looking this way: x east and y south in metres from the middle of the
 * design's picture, z metres above the ground. Pixels on the 800 × 600 photo.
 */
export function obliquePoint(p: Point & { z: number }, side: ObliqueSide, lat: number): Point {
  const heading = OBLIQUE_HEADINGS[side];
  const m = metresPerPixel(lat) / 2; // the photo is at zoom 21, the design's picture at 20
  const lift = (Math.max(0, p.z) * LIFT_PER_METRE) / m;
  // North up, pixels east and south of the middle, the raised point moved along the camera's way.
  const px = p.x / m + lift * Math.sin(rad(heading));
  const py = p.y / m - lift * Math.cos(rad(heading));
  // Turned clockwise by (360 − heading), as the server turns the photo, then the height squashed to 3/4.
  const t = rad((360 - heading) % 360);
  const x = px * Math.cos(t) - py * Math.sin(t);
  const y = px * Math.sin(t) + py * Math.cos(t);
  const half = OBLIQUE_PICTURE.width / 2;
  return { x: half + x, y: (half + y) * (OBLIQUE_PICTURE.height / OBLIQUE_PICTURE.width) };
}

/** The ground's height on the grid: a low share of every height on it (the yard and street), so roofs stand above it. */
export function groundOf(t: Terrain): number {
  const all = Array.from(t.heights).sort((a, b) => a - b);
  return all.length ? all[Math.floor(all.length * 0.1)]! : 0;
}

export interface ObliquePanel {
  corners: readonly Point[];
  /** The way it faces, degrees from north. */
  facing: number;
  /** Degrees up from flat. */
  tilt: number;
}

export interface DrawnPanel {
  points: Point[];
  /** Whether the camera sees its face: a panel facing away is behind the roof in this photo. */
  seen: boolean;
}

/** How far a corner is read in from the panel's edge (a corner read on the edge can land off the roof, on the ground). */
const READ_IN = 0.25;

/**
 * Every panel as it lands in the photo looking this way. Each corner's height is read a little inside the panel and
 * carried out to the corner along the line from its middle, so a corner at the gutter doesn't drop to the ground.
 */
export function panelsInPhoto(panels: readonly ObliquePanel[], t: Terrain, side: ObliqueSide, lat: number): DrawnPanel[] {
  const ground = groundOf(t);
  const towards = (OBLIQUE_HEADINGS[side] + 180) % 360; // the way a face looks to be seen square by this camera
  return panels.map((panel) => {
    const n = panel.corners.length || 1;
    const mid = {
      x: panel.corners.reduce((s, c) => s + c.x, 0) / n,
      y: panel.corners.reduce((s, c) => s + c.y, 0) / n,
    };
    const zm = heightAt(t, mid.x, mid.y) - ground;
    const points = panel.corners.map((c) => {
      const inner = { x: mid.x + (c.x - mid.x) * (1 - READ_IN), y: mid.y + (c.y - mid.y) * (1 - READ_IN) };
      const zi = heightAt(t, inner.x, inner.y) - ground;
      const z = zm + (zi - zm) / (1 - READ_IN);
      return obliquePoint({ ...c, z }, side, lat);
    });
    const off = Math.abs(((panel.facing - towards + 540) % 360) - 180);
    return { points, seen: panel.tilt < 5 || off < 100 };
  });
}

/**
 * The side that shows the design best: the camera looking at the most panels square on (a panel facing north is seen
 * best looking south). With no panels, looking south, which shows the north faces most arrays go on.
 */
export function bestSide(panels: readonly Pick<ObliquePanel, "facing" | "tilt">[]): ObliqueSide {
  let best: ObliqueSide = "South";
  let top = -Infinity;
  for (const side of ["South", "North", "East", "West"] as const) {
    const towards = (OBLIQUE_HEADINGS[side] + 180) % 360;
    const score = panels.reduce((s, p) => s + (p.tilt < 5 ? 0.5 : Math.cos(rad(p.facing - towards))), 0);
    if (score > top + 1e-9) {
      top = score;
      best = side;
    }
  }
  return best;
}
