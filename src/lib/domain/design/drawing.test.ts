import { describe, expect, it } from "vitest";
import type { RoofModel } from "../roof-layout";
import { faceShade, facesFromModel, groundAt, groundLevel, groundOf, hull, tidyGround, type Ground } from "./drawing";

describe("the outline round points", () => {
  it("keeps the corners and drops what is inside or along an edge", () => {
    const square = hull([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ]);
    expect(square).toHaveLength(4);
    expect(square).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ]),
    );
  });
});

describe("Google's roof model as faces to draw", () => {
  const centre = { lat: -37.88, lng: 145.16 };
  const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
  const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
  /** A spot so many metres east and south of the middle. */
  const at = (east: number, south: number, segment: number) => ({
    lat: centre.lat - south / mLat,
    lng: centre.lng + east / mLng,
    orientation: "PORTRAIT" as const,
    segment,
    kwh: 500,
  });
  const model: RoofModel = {
    panel: { heightM: 1.8, widthM: 1.0, watts: 400 },
    faces: [
      { azimuth: 0, pitch: 0 },
      { azimuth: 90, pitch: 20 },
      { azimuth: 180, pitch: 20 },
    ],
    // Face 0 (flat, facing north): a row of three, a metre apart. Face 1: one spot. Face 2: none.
    slots: [at(-1, 0, 0), at(0, 0, 0), at(1, 0, 0), at(6, 0, 1)],
  };
  const faces = facesFromModel(model, centre);

  it("draws a face for each one with panel spots, and none for one without", () => {
    expect(faces).toHaveLength(2);
    expect(faces.map((f) => f.azimuth)).toEqual([0, 90]);
  });

  it("makes each the outline round its spots, a little past them", () => {
    const xs = faces[0].points.map((p) => p.x);
    const ys = faces[0].points.map((p) => p.y);
    // Three portrait panels side by side: 3 m across plus the edge either side, 1.8 m deep plus the edge.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3 + 0.7, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1.8 + 0.7, 1);
    expect(faces[0].points).toHaveLength(4);
  });

  it("shortens a pitched face down its slope, as it is seen from above", () => {
    // Facing east at 20°: its depth runs east-west, 1.8 m × cos 20°.
    const xs = faces[1].points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1.8 * Math.cos((20 * Math.PI) / 180) + 0.7, 1);
  });
});

describe("the grey a face is drawn in", () => {
  it("differs for faces that look different ways, and is a colour", () => {
    expect(faceShade(315, 20)).not.toBe(faceShade(135, 20));
    expect(faceShade(0, 0)).toBe(faceShade(180, 0));
    expect(faceShade(90, 22)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("the ground read from the photo", () => {
  it("tells lawn, trees, paving and the built from their colours", () => {
    expect(groundOf(110, 140, 90)).toBe("lawn");
    expect(groundOf(50, 70, 45)).toBe("tree");
    expect(groundOf(25, 28, 30)).toBe("tree");
    expect(groundOf(170, 168, 165)).toBe("paved");
    expect(groundOf(150, 95, 80)).toBe("built");
  });

  it("is tidied into plain shapes: a stray cell takes its neighbours' kind", () => {
    const w = 7;
    const cells = new Array<Ground>(w * w).fill("lawn");
    cells[3 * w + 3] = "paved";
    expect(tidyGround(cells, w, w).every((c) => c === "lawn")).toBe(true);
    // A real block of paving survives.
    const half = cells.map((_, i) => (i % w < 4 ? "paved" : "lawn")) as Ground[];
    const tidied = tidyGround(half, w, w);
    expect(tidied[3 * w]).toBe("paved");
    expect(tidied[3 * w + 6]).toBe("lawn");
  });
});

describe("the ground from heights, the building outline and colour", () => {
  it("lets height tell what colour can't", () => {
    // The same grey: a roof inside the outline, a drive on the ground.
    expect(groundAt(160, 158, 155, 4, true)).toBe("built");
    expect(groundAt(160, 158, 155, 0.1, false)).toBe("paved");
    // The same green: a canopy standing tall, a lawn lying flat.
    expect(groundAt(70, 100, 60, 6, false)).toBe("tree");
    expect(groundAt(70, 100, 60, 0.2, false)).toBe("lawn");
    // Tall, pale and colourless outside the outline: a carport or shed. Tall and dark: a tree in shade.
    expect(groundAt(190, 188, 186, 3, false)).toBe("built");
    expect(groundAt(40, 42, 44, 5, false)).toBe("tree");
    expect(groundAt(150, 110, 80, 0.1, false)).toBe("earth");
  });

  it("finds the ground under a house on a slope", () => {
    // 40 × 40 at 1 m: ground rising 1 m in 10 to the east, with a house 8 m square and 5 m tall in the middle, and a gap of no data.
    const w = 40;
    const heights = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) heights[y * w + x] = x / 10 + (x >= 16 && x < 24 && y >= 16 && y < 24 ? 5 : 0);
    heights[5] = -9999;
    const { level, cols } = groundLevel(heights, w, w, 2, 6);
    const at = (x: number, y: number) => level[Math.floor(y / 2) * cols + Math.floor(x / 2)];
    // Under the house the level is the slope's, not the roof's.
    expect(at(20, 20)).toBeGreaterThan(1.2);
    expect(at(20, 20)).toBeLessThan(2.6);
    expect(heights[20 * w + 20] - at(20, 20)).toBeGreaterThan(4);
    // Open ground stands close to its own level.
    expect(Math.abs(heights[30 * w + 34] - at(34, 30))).toBeLessThan(1.5);
    expect(Number.isFinite(at(5, 0))).toBe(true);
  });
});
