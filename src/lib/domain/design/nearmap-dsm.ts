/**
 * Nearmap's heights (its DSM, a surface model of roofs, trees and ground) set on the roof designer's own picture, as
 * the grid the slope reading and the shade analysis use (`Terrain` in shade.ts). Pure, tested.
 *
 * How Nearmap's DSM tiles carry heights (read from the tiles themselves, 9 Nov 2026; VERIFY with Nearmap's docs):
 * - each tile is a PNG of 257 × 257: 256 cells plus a row and column shared with the next tile over;
 * - a cell's height is its red, green and blue as one 24-bit number, in 1/256ths of a metre (`DSM_UNITS`): at
 *   29 Shearer Drive, Rowville that put the roof 4 to 8 m over the ground beside it, faces at about 20° to 24°, and
 *   matched the ground model (DetailDtm) to within centimetres on open ground;
 * - each tile is measured from a base of its own in whole metres, so two tiles side by side can differ by exactly 1 m
 *   or 2 m along the edge they share. The tiles are put back in step by that shared edge (`alignTiles`);
 * - a cell of 0 has no reading.
 *
 * Heights are only ever used relative to one another (a face's slope, what stands between a panel and the sun), so the
 * base the stitched grid ends up on doesn't matter.
 */
import { ROOF_IMAGE, metresPerPixel } from "./roof-design";
import { TERRAIN_CELL, type Terrain } from "./shade";

/** A height of 1 in a tile is this much of a metre. */
export const DSM_UNITS = 256;
/** Cells a tile spans: its 257 samples run from one edge to the other, the last shared with the next tile. */
export const DSM_SPAN = 256;

/** One of Nearmap's DSM tiles, decoded: its place at its zoom and its samples, row by row, in tile units (NaN: none). */
export interface DsmTile {
  x: number;
  y: number;
  /** Samples a row (257). */
  size: number;
  values: Float64Array;
}

/** A tile's samples from its pixels (red, green, blue, and any more channels after them). */
export function tileValues(pixels: ArrayLike<number>, channels: number, size: number): Float64Array {
  const out = new Float64Array(size * size);
  for (let i = 0; i < out.length; i++) {
    const v = pixels[i * channels] * 65_536 + pixels[i * channels + 1] * 256 + pixels[i * channels + 2];
    out[i] = v > 0 ? v : NaN;
  }
  return out;
}

const keyOf = (x: number, y: number) => `${x},${y}`;

function median(list: number[]): number {
  const s = list.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}

/**
 * What to add to each tile (by "x,y") so neighbours agree on the edge they share: a whole number of metres, worked out
 * from the first tile outwards. A tile with no neighbour it can be matched by keeps nothing added.
 */
export function alignTiles(tiles: readonly DsmTile[]): Map<string, number> {
  const byKey = new Map(tiles.map((t) => [keyOf(t.x, t.y), t]));
  const added = new Map<string, number>();
  if (!tiles.length) return added;
  const queue = [tiles[0]];
  added.set(keyOf(tiles[0].x, tiles[0].y), 0);
  while (queue.length) {
    const a = queue.shift()!;
    const base = added.get(keyOf(a.x, a.y))!;
    const last = a.size - 1;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = keyOf(a.x + dx, a.y + dy);
      const b = byKey.get(k);
      if (!b || added.has(k)) continue;
      // The samples the two tiles share: a's right column is b's left, a's bottom row is b's top (and the other ways).
      const diffs: number[] = [];
      for (let i = 0; i < Math.min(a.size, b.size); i++) {
        const [ai, bi] =
          dx === 1
            ? [i * a.size + last, i * b.size]
            : dx === -1
              ? [i * a.size, i * b.size + (b.size - 1)]
              : dy === 1
                ? [last * a.size + i, i]
                : [i, (b.size - 1) * b.size + i];
        diffs.push(a.values[ai] - b.values[bi]);
      }
      const d = median(diffs);
      if (!Number.isFinite(d)) continue;
      added.set(k, base + Math.round(d / DSM_UNITS) * DSM_UNITS);
      queue.push(b);
    }
  }
  return added;
}

/** A point's place in the world's pixels at a zoom (Web Mercator, 256 a tile). */
export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = DSM_SPAN * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world };
}

/** The tiles at a zoom that cover the designer's picture round a point. */
export function tilesFor(lat: number, lng: number, zoom: number): { x: number; y: number }[] {
  const f = 2 ** (zoom - ROOF_IMAGE.zoom);
  const c = worldPixel(lat, lng, zoom);
  const halfW = (ROOF_IMAGE.width / 2) * f;
  const halfH = (ROOF_IMAGE.height / 2) * f;
  const out: { x: number; y: number }[] = [];
  for (let y = Math.floor((c.y - halfH) / DSM_SPAN); y <= Math.floor((c.y + halfH) / DSM_SPAN); y++)
    for (let x = Math.floor((c.x - halfW) / DSM_SPAN); x <= Math.floor((c.x + halfW) / DSM_SPAN); x++) out.push({ x, y });
  return out;
}

/** At least this share of the picture must have a height for the grid to be worth using. */
const ENOUGH = 0.6;

/**
 * The heights over the designer's picture round a point, from DSM tiles at a zoom (`tilesFor`), as the shade analysis's
 * grid: tiles put in step, each cell read between the four samples round it. Null when too little of the picture has a
 * height (Nearmap hasn't measured there, or the tiles didn't come).
 */
export function terrainFromTiles(lat: number, lng: number, zoom: number, tiles: readonly DsmTile[]): Terrain | null {
  if (!tiles.length) return null;
  const added = alignTiles(tiles);
  const byKey = new Map(tiles.map((t) => [keyOf(t.x, t.y), t]));
  const f = 2 ** (zoom - ROOF_IMAGE.zoom);
  const c = worldPixel(lat, lng, zoom);
  const mpp = metresPerPixel(lat);
  const widthM = ROOF_IMAGE.width * mpp;
  const heightM = ROOF_IMAGE.height * mpp;
  const cols = Math.ceil(widthM / TERRAIN_CELL);
  const rows = Math.ceil(heightM / TERRAIN_CELL);
  // One sample: the tile it is in (or the one before, for a tile's last row or column), and that tile's base.
  const sample = (wx: number, wy: number): number => {
    const tx = Math.floor(wx / DSM_SPAN);
    const ty = Math.floor(wy / DSM_SPAN);
    const t = byKey.get(keyOf(tx, ty));
    const add = added.get(keyOf(tx, ty));
    if (!t || add === undefined) return NaN;
    const i = wx - tx * DSM_SPAN;
    const j = wy - ty * DSM_SPAN;
    return t.values[j * t.size + i] + add;
  };
  const heights = new Float32Array(cols * rows);
  let found = 0;
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++) {
      // The cell's middle, in the designer's pixels, then in the world's at the tiles' zoom.
      const px = ((col + 0.5) * TERRAIN_CELL) / mpp;
      const py = ((r + 0.5) * TERRAIN_CELL) / mpp;
      const wx = c.x + (px - ROOF_IMAGE.width / 2) * f;
      const wy = c.y + (py - ROOF_IMAGE.height / 2) * f;
      const x0 = Math.floor(wx);
      const y0 = Math.floor(wy);
      const fx = wx - x0;
      const fy = wy - y0;
      const s = [sample(x0, y0), sample(x0 + 1, y0), sample(x0, y0 + 1), sample(x0 + 1, y0 + 1)];
      const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      let sum = 0;
      let weight = 0;
      for (let k = 0; k < 4; k++)
        if (Number.isFinite(s[k])) {
          sum += s[k] * w[k];
          weight += w[k];
        }
      const i = r * cols + col;
      if (weight > 0) {
        heights[i] = sum / weight / DSM_UNITS;
        found++;
      } else heights[i] = NaN;
    }
  if (found < heights.length * ENOUGH) return null;
  // Where there is no reading, the nearest one before it along the row (or above it) stands in.
  for (let i = 0; i < heights.length; i++)
    if (!Number.isFinite(heights[i])) {
      const left = i % cols > 0 ? heights[i - 1] : NaN;
      const up = i >= cols ? heights[i - cols] : NaN;
      heights[i] = Number.isFinite(left) ? left : Number.isFinite(up) ? up : NaN;
    }
  // Any still without (the top-left corner's run): the lowest height found.
  let low = Infinity;
  for (const h of heights) if (Number.isFinite(h) && h < low) low = h;
  for (let i = 0; i < heights.length; i++) if (!Number.isFinite(heights[i])) heights[i] = low;
  return { cols, rows, cell: TERRAIN_CELL, widthM, heightM, heights };
}

/** Which of a capture's height layers to use: Nearmap's detailed one at zoom 20, else its standard one at zoom 18. */
export const DSM_LAYERS = [
  { type: "DetailDsm", zoom: 20 },
  { type: "Dsm", zoom: 18 },
] as const;
export type DsmLayer = (typeof DSM_LAYERS)[number];

/**
 * The capture and layer to take heights from: the newest with the detailed layer, else the newest with the standard
 * one. Captures newest first, each with Coverage's resource names ("tiles:DetailDsm").
 */
export function dsmSource<T extends { captured: string; resources: readonly string[] }>(
  surveys: readonly T[],
): { survey: T; layer: DsmLayer } | null {
  for (const layer of DSM_LAYERS) {
    const survey = surveys.find((s) => s.resources.includes(`tiles:${layer.type}`));
    if (survey) return { survey, layer };
  }
  return null;
}
