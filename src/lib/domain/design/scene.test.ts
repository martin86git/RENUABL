import { describe, expect, it } from "vitest";
import {
  buildingsFrom,
  cleanScene,
  eaveFor,
  faceUnder,
  fitRectangle,
  insideOutline,
  pieces,
  roofHeightAt,
  treesFrom,
  type Grid,
} from "./scene";

const CELL = 0.25;
/** A grid 40 m × 30 m, filled by `fill(x, y)` at each cell's middle (the designer's metres). */
function grid(fill: (x: number, y: number) => number): Grid<Float32Array> {
  const cols = 40 / CELL;
  const rows = 30 / CELL;
  const values = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) values[r * cols + c] = fill((c + 0.5) * CELL - 20, (r + 0.5) * CELL - 15);
  return { cols, rows, cell: CELL, values };
}

describe("pieces of a grid", () => {
  it("are the cells that touch, side by side", () => {
    // Two blocks apart, and a single cell touching only at a corner.
    const cols = 6;
    const on = new Set([0, 1, 6, 7, 4, 5, 14]);
    const found = pieces((i) => on.has(i), cols, 3).map((p) => p.sort((a, b) => a - b));
    expect(found).toHaveLength(3);
    expect(found).toContainEqual([0, 1, 6, 7]);
  });
});

describe("the rectangle that fits", () => {
  it("finds a turned rectangle's size and turn", () => {
    const t = (30 * Math.PI) / 180;
    const corners = [
      [-5, -2],
      [5, -2],
      [5, 2],
      [-5, 2],
    ].map(([u, v]) => ({ x: 3 + u * Math.cos(t) - v * Math.sin(t), y: 1 + u * Math.sin(t) + v * Math.cos(t) }));
    const r = fitRectangle(corners);
    expect(r.long).toBeCloseTo(10, 1);
    expect(r.wide).toBeCloseTo(4, 1);
    expect(r.angle).toBeCloseTo(30, 0);
    expect([r.cx, r.cy].map((n) => Math.round(n * 10) / 10)).toEqual([3, 1]);
  });
});

describe("buildings from the outline and heights", () => {
  // A house 12 m × 8 m, walls about 3 m and a ridge at 6 m, and a 1 m × 1 m hot-water unit in the outline.
  const house = (x: number, y: number) => Math.abs(x - 8) < 6 && Math.abs(y) < 4;
  const unit = (x: number, y: number) => Math.abs(x + 15) < 0.5 && Math.abs(y + 10) < 0.5;
  const mask = grid((x, y) => (house(x, y) || unit(x, y) ? 1 : 0));
  const height = grid((x, y) => (house(x, y) ? 3 + 3 * (1 - Math.abs(y) / 4) : unit(x, y) ? 2 : 0));

  it("makes a building of each piece big enough to be one, with its walls and its ridge", () => {
    const found = buildingsFrom(mask, height);
    expect(found).toHaveLength(1);
    const [b] = found;
    expect(b.long).toBeCloseTo(12, 0);
    expect(b.wide).toBeCloseTo(8, 0);
    expect(b.cx).toBeCloseTo(8, 0);
    expect(b.eave).toBeGreaterThan(2.5);
    expect(b.eave).toBeLessThan(4.5);
    expect(b.ridge).toBeGreaterThan(5.5);
  });

  it("leaves out the home itself when told which it is", () => {
    expect(buildingsFrom(mask, height, (p) => Math.hypot(p.x - 8, p.y) < 1)).toHaveLength(0);
  });
});

describe("trees from what stands tall", () => {
  // Two round trees 4 m apart at the crown, 8 m and 6 m tall, standing in one wide canopy; and a 1.5 m hedge.
  const crown = (x: number, y: number, cx: number, r: number, h: number) => Math.max(0, h * (1 - Math.hypot(x - cx, y) / r));
  const mask = grid(() => 0);
  const height = grid((x, y) => Math.max(crown(x, y, -4, 4, 8), crown(x, y, 3, 3.5, 6), Math.abs(y - 10) < 0.5 ? 1.5 : 0));

  it("finds each crown in a wide canopy, with its height and a crown about its size", () => {
    const trees = treesFrom(mask, height);
    expect(trees).toHaveLength(2);
    const [tall, short] = trees;
    expect(tall.x).toBeCloseTo(-4, 0);
    expect(tall.height).toBeCloseTo(8, 0);
    expect(short.x).toBeCloseTo(3, 0);
    expect(tall.radius).toBeGreaterThan(1.5);
    expect(tall.radius).toBeLessThan(5);
  });

  it("never finds a tree inside the building outline", () => {
    expect(
      treesFrom(
        grid(() => 1),
        height,
      ),
    ).toHaveLength(0);
  });
});

describe("the home's own roof", () => {
  // A face 8 m wide and 5 m deep, facing north (its low edge on the north side), pitched 20°.
  const face = {
    points: [
      { x: -4, y: -3 },
      { x: 4, y: -3 },
      { x: 4, y: 2 },
      { x: -4, y: 2 },
    ],
    facing: 0,
    tilt: 20,
  };

  it("sits on the walls at its lowest edge and rises at its pitch", () => {
    expect(roofHeightAt(face, 2.8, { x: 0, y: -3 })).toBeCloseTo(2.8);
    expect(roofHeightAt(face, 2.8, { x: 0, y: 2 })).toBeCloseTo(2.8 + 5 * Math.tan((20 * Math.PI) / 180));
    expect(eaveFor("double")).toBeGreaterThan(eaveFor("single"));
  });

  it("knows which face a point is on, else the nearest", () => {
    const other = { ...face, points: face.points.map((p) => ({ x: p.x + 20, y: p.y })) };
    expect(insideOutline({ x: 0, y: 0 }, face.points)).toBe(true);
    expect(faceUnder([other, face], { x: 1, y: 1 })).toBe(face);
    expect(faceUnder([other, face], { x: 30, y: 0 })).toBe(other);
    expect(faceUnder([], { x: 0, y: 0 })).toBeNull();
  });
});

describe("a scene read back", () => {
  it("keeps only well-formed buildings and trees", () => {
    const s = cleanScene({
      buildings: [{ cx: 1, cy: 2, long: 10, wide: 6, angle: 30, eave: 3, ridge: 2 }, { cx: "x" }],
      trees: [{ x: 1, y: 1, radius: 2, height: 9 }, { x: 1, y: 1, radius: 2, height: -4 }, null],
    });
    expect(s.buildings).toEqual([{ cx: 1, cy: 2, long: 10, wide: 6, angle: 30, eave: 3, ridge: 3 }]);
    expect(s.trees).toHaveLength(1);
    expect(s.trees[0].height).toBe(9);
    expect(cleanScene(null)).toEqual({ buildings: [], trees: [] });
  });
});
