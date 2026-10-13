import { describe, expect, it } from "vitest";
import type { RoofModel } from "../roof-layout";
import { faceShade, facesFromModel, hull } from "./drawing";

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
