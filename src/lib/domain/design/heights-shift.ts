/**
 * Nearmap's heights moved onto the picture in use (12 Nov 2026, Martin: "the roof tracings are so inaccurate that they
 * are a bug"). Pure, tested.
 *
 * The detailed heights come from one flight (at Rowville, 27 Jan 2026) and the picture on the designer is often a later
 * one; two flights don't land on the ground in quite the same place, so the heights sat a metre or two off the roof in
 * the picture and every face read from them was drawn across the roof's real hips and ridges. The flight's own picture
 * is matched against the picture in use (`bestShift` in image-align.ts, on the server) and the heights moved by that.
 */
import type { Terrain } from "./shade";

/** How the heights are moved onto the picture in use: metres east and south. */
export interface HeightsShift {
  x: number;
  y: number;
}

/** Compared at a quarter of the 1280 px picture (about 24 cm a pixel at zoom 21). */
export const ALIGN = {
  /** The pictures shrunk by this before they are compared. */
  shrink: 4,
  /** Searched up to this many shrunk pixels each way (about 4 m). */
  maxShift: 16,
  /** Compared over the middle of the picture, this many metres across (the home and its neighbours). */
  across: 40,
  /** A shift smaller than this isn't worth moving the heights for, metres. */
  least: 0.15,
} as const;

/** The shift found between the pictures (shrunk pixels: a point in the heights' picture plus this is in the picture in use), as metres. */
export function shiftInMetres(dx: number, dy: number, metresPerPixel: number): HeightsShift {
  const m = metresPerPixel * ALIGN.shrink;
  return { x: Math.round(dx * m * 100) / 100, y: Math.round(dy * m * 100) / 100 };
}

/**
 * The heights moved by `by` metres (a height at p is now at p + by), to the nearest cell. Cells moved in from past the
 * edge take the height at the edge (the grid reaches well past the home, so nothing that matters is there).
 */
export function shiftTerrain(t: Terrain, by: HeightsShift): Terrain {
  const dc = Math.round(by.x / t.cell);
  const dr = Math.round(by.y / t.cell);
  if (!dc && !dr) return t;
  const heights = new Float32Array(t.cols * t.rows);
  const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  for (let r = 0; r < t.rows; r++) {
    const from = clamp(r - dr, t.rows);
    for (let c = 0; c < t.cols; c++) heights[r * t.cols + c] = t.heights[from * t.cols + clamp(c - dc, t.cols)];
  }
  return { ...t, heights };
}
