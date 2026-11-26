import { describe, expect, it } from "vitest";
import { bestSide, groundOf, obliquePoint, panelsInPhoto } from "./oblique";
import { metresPerPixel } from "./roof-design";
import type { Terrain } from "./shade";

const LAT = -37.94;
const px = metresPerPixel(LAT) / 2;

/** A flat yard at 0 m with a block 5 m high from x −5 to 5, y −5 to 5. */
function block(): Terrain {
  const cell = 0.25;
  const size = 40;
  const cols = size / cell;
  const heights = new Float32Array(cols * cols);
  for (let r = 0; r < cols; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * cell - size / 2;
      const y = r * cell - size / 2;
      heights[r * cols + c] = Math.abs(x) < 5 && Math.abs(y) < 5 ? 5 : 0;
    }
  return { cols, rows: cols, cell, widthM: size, heightM: size, heights };
}

describe("a design drawn on the angled photos", () => {
  it("puts the middle of the ground in the middle of the photo, the height squashed to 3/4", () => {
    for (const side of ["North", "East", "South", "West"] as const)
      expect(obliquePoint({ x: 0, y: 0, z: 0 }, side, LAT)).toEqual({ x: 400, y: 300 });
  });
  it("turns the ground so the camera's way is up", () => {
    // Looking north: a point to the north is up; looking east, a point to the east is up.
    expect(obliquePoint({ x: 0, y: -10, z: 0 }, "North", LAT).y).toBeCloseTo(300 - (10 / px) * 0.75);
    expect(obliquePoint({ x: 10, y: 0, z: 0 }, "East", LAT).y).toBeCloseTo(300 - (10 / px) * 0.75);
    // Looking south, the east is on the left.
    expect(obliquePoint({ x: 10, y: 0, z: 0 }, "South", LAT).x).toBeCloseTo(400 - 10 / px);
  });
  it("moves a point standing up along the camera's way by its height", () => {
    const low = obliquePoint({ x: 0, y: 0, z: 0 }, "West", LAT);
    const high = obliquePoint({ x: 0, y: 0, z: 4 }, "West", LAT);
    expect(high.x).toBeCloseTo(low.x);
    expect(low.y - high.y).toBeCloseTo((4 / px) * 0.75);
  });
  it("reads the ground low, so roofs stand above it", () => {
    expect(groundOf(block())).toBe(0);
  });
  it("lifts a panel on the roof by the roof's height, even with a corner on the edge", () => {
    const t = block();
    const corners = [
      { x: -5, y: -1 },
      { x: -3, y: -1 },
      { x: -3, y: 0 },
      { x: -5, y: 0 },
    ];
    const [drawn] = panelsInPhoto([{ corners, facing: 0, tilt: 20 }], t, "South", LAT);
    const flat = corners.map((c) => obliquePoint({ ...c, z: 5 }, "South", LAT));
    drawn!.points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(flat[i]!.x, 0);
      expect(p.y).toBeCloseTo(flat[i]!.y, 0);
    });
    expect(drawn!.seen).toBe(true);
    // Looking north, a north-facing panel on a usual roof is the far slope, still in the photo; on a steep one it is behind.
    expect(panelsInPhoto([{ corners, facing: 0, tilt: 22 }], t, "North", LAT)[0]!.seen).toBe(true);
    expect(panelsInPhoto([{ corners, facing: 0, tilt: 50 }], t, "North", LAT)[0]!.seen).toBe(false);
    expect(panelsInPhoto([{ corners, facing: 0, tilt: 50 }], t, "East", LAT)[0]!.seen).toBe(true);
  });
  it("opens on the side that looks at the panels square on", () => {
    expect(bestSide([{ facing: 0, tilt: 22 }])).toBe("South");
    expect(
      bestSide([
        { facing: 270, tilt: 22 },
        { facing: 280, tilt: 22 },
      ]),
    ).toBe("East");
    expect(bestSide([{ facing: 90, tilt: 22 }])).toBe("West");
    expect(bestSide([])).toBe("South");
  });
});
