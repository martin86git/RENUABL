import { describe, expect, it } from "vitest";
import { shiftInMetres, shiftTerrain, ALIGN } from "./heights-shift";
import { heightAt, type Terrain } from "./shade";

const grid = (): Terrain => {
  const cols = 40;
  const rows = 40;
  const heights = new Float32Array(cols * rows);
  // A box 2 m up between x and y of -1 and 1.
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -5 + (c + 0.5) * 0.25;
      const y = -5 + (r + 0.5) * 0.25;
      heights[r * cols + c] = Math.abs(x) < 1 && Math.abs(y) < 1 ? 2 : 0;
    }
  return { cols, rows, cell: 0.25, widthM: 10, heightM: 10, heights };
};

describe("Nearmap's heights moved onto the picture in use", () => {
  it("moves a height at p to p plus the shift", () => {
    const moved = shiftTerrain(grid(), { x: 1.5, y: -0.5 });
    expect(heightAt(moved, 1.5, -0.5)).toBe(2);
    expect(heightAt(moved, 2.3, -0.5)).toBe(2);
    expect(heightAt(moved, -0.8, 0)).toBe(0);
  });
  it("fills what comes in from past the edge with the edge's height, never a hole", () => {
    const moved = shiftTerrain(grid(), { x: 3, y: 3 });
    expect([...moved.heights].every(Number.isFinite)).toBe(true);
  });
  it("leaves the heights alone for no shift", () => {
    const t = grid();
    expect(shiftTerrain(t, { x: 0.05, y: -0.1 })).toBe(t);
  });
  it("reads the pictures' shift in metres", () => {
    expect(shiftInMetres(2, -1, 0.06)).toEqual({ x: 2 * 0.06 * ALIGN.shrink, y: -1 * 0.06 * ALIGN.shrink });
  });
});
