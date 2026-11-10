import { describe, expect, it } from "vitest";
import { bearingGap } from "./face-aspect";
import { faceAt, facesFromHeights } from "./roof-faces";
import { inside, type Point } from "./roof-design";
import type { Terrain } from "./shade";

const CELL = 0.25;

/** A grid of heights over 24 × 18 m from a function of the point (metres east and south of the middle). */
function terrainOf(h: (x: number, y: number) => number): Terrain {
  const widthM = 24;
  const heightM = 18;
  const cols = widthM / CELL;
  const rows = heightM / CELL;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) heights[r * cols + c] = h(-widthM / 2 + (c + 0.5) * CELL, -heightM / 2 + (r + 0.5) * CELL);
  return { cols, rows, cell: CELL, widthM, heightM, heights };
}

const rise = Math.tan((22 * Math.PI) / 180);
const outline: Point[] = [
  { x: -6, y: -4 },
  { x: 6, y: -4 },
  { x: 6, y: 4 },
  { x: -6, y: 4 },
];
/** A hipped roof 12 m by 8 m at 22°, eaves 3 m up, a little roughness like tiles. */
const hip = (x: number, y: number) =>
  Math.abs(x) <= 6 && Math.abs(y) <= 4 ? 3 + rise * Math.min(4 - Math.abs(y), 6 - Math.abs(x)) + 0.01 * Math.sin(x * 40) : 0;

describe("facesFromHeights", () => {
  it("finds a hipped roof's four faces, each looking its own way at its pitch", () => {
    const found = facesFromHeights(outline, terrainOf(hip));
    expect(found).toHaveLength(4);
    const ways = found.map((f) => f.aspect.azimuth).sort((a, b) => a - b);
    for (const [got, want] of ways.map((w, i) => [w, [0, 90, 180, 270][i]])) expect(bearingGap(got, want)).toBeLessThan(3);
    for (const f of found) expect(f.aspect.pitch).toBeCloseTo(22, 0);
    // The long faces (north and south) are the larger.
    expect(bearingGap(found[0].aspect.azimuth, 0) < 3 || bearingGap(found[0].aspect.azimuth, 180) < 3).toBe(true);
    // Together they cover most of the roof, and each sits inside the outline.
    const total = found.reduce((t, f) => t + f.areaM2, 0);
    expect(total).toBeGreaterThan(12 * 8 * 0.85);
    for (const f of found) {
      const mid = f.points.reduce((m, p) => ({ x: m.x + p.x / f.points.length, y: m.y + p.y / f.points.length }), { x: 0, y: 0 });
      expect(inside(mid, outline)).toBe(true);
    }
  });

  it("the north face is north of the middle and reaches to the gutter", () => {
    const found = facesFromHeights(outline, terrainOf(hip));
    const north = found.find((f) => bearingGap(f.aspect.azimuth, 0) < 3)!;
    const ys = north.points.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(-3.5);
    expect(Math.max(...ys)).toBeLessThan(0.6);
  });

  it("reads a flat roof as one flat face", () => {
    const found = facesFromHeights(
      outline,
      terrainOf((x, y) => (Math.abs(x) <= 6 && Math.abs(y) <= 4 ? 3.2 : 0)),
    );
    expect(found).toHaveLength(1);
    expect(found[0].aspect.flat).toBe(true);
  });

  it("finds nothing outside the heights", () => {
    expect(
      facesFromHeights(
        [
          { x: 100, y: 100 },
          { x: 101, y: 100 },
          { x: 101, y: 101 },
        ],
        terrainOf(hip),
      ),
    ).toEqual([]);
  });
});

describe("faceAt: the face under a tap", () => {
  const t = terrainOf(hip);
  it("finds the north face of a hip from a tap on it, stopped by its hips and the gutter", () => {
    const f = faceAt(t, { x: 0, y: -2.5 })!;
    expect(bearingGap(f.aspect.azimuth, 0)).toBeLessThan(3);
    expect(f.aspect.pitch).toBeCloseTo(22, 0);
    // The north face is a trapezoid of (12 + 4) / 2 × 4 = 32 m².
    expect(f.areaM2).toBeGreaterThan(26);
    expect(f.areaM2).toBeLessThan(38);
    expect(Math.max(...f.points.map((p) => p.y))).toBeLessThan(0.6);
  });
  it("finds the east face from a tap on it", () => {
    const f = faceAt(t, { x: 5, y: 0 })!;
    expect(bearingGap(f.aspect.azimuth, 90)).toBeLessThan(3);
  });
  it("finds nothing on the ground beside the house or past the picture", () => {
    expect(faceAt(t, { x: 0, y: 7 })?.aspect.pitch ?? 0).toBeLessThan(3);
    expect(faceAt(t, { x: 50, y: 0 })).toBeNull();
  });
  it("leaves out places to skip", () => {
    const f = faceAt(t, { x: 0, y: -2.5 }, [
      [
        { x: -6, y: -4 },
        { x: 0, y: -4 },
        { x: 0, y: 0 },
        { x: -6, y: 0 },
      ],
    ])!;
    // About half the north face: the half under the box is left out.
    expect(f.areaM2).toBeLessThan(21);
    expect(Math.min(...f.points.map((p) => p.x))).toBeGreaterThan(-3);
  });
});
