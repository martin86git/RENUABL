import { describe, expect, it } from "vitest";
import type { RoofModel } from "../roof-layout";
import { ASPECT, aspectFromHeights, aspectFromModel, bearingGap, faceFromAspect, facingOf, readAspect } from "./face-aspect";
import { faceFacing, type Face, type Point } from "./roof-design";
import type { Terrain } from "./shade";

const W = 40;
const H = 25;
const CELL = 0.25;

/** A grid of heights over the picture, each from `z(x, y)` at the cell's middle (x east, y south, metres from the middle). */
function terrain(z: (x: number, y: number) => number): Terrain {
  const cols = W / CELL;
  const rows = H / CELL;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) heights[r * cols + c] = z(-W / 2 + (c + 0.5) * CELL, -H / 2 + (r + 0.5) * CELL);
  return { cols, rows, cell: CELL, widthM: W, heightM: H, heights };
}

const square: Point[] = [
  { x: -5, y: -4 },
  { x: 5, y: -4 },
  { x: 5, y: 4 },
  { x: -5, y: 4 },
];
const inSquare = (x: number, y: number) => x > -5 && x < 5 && y > -4 && y < 4;

/** A roof face over `square` sloping down towards `azimuth` (clockwise from north) at `pitch`, on flat ground. */
function slope(azimuth: number, pitch: number, extra: (x: number, y: number) => number = () => 0) {
  const t = (azimuth * Math.PI) / 180;
  const k = Math.tan((pitch * Math.PI) / 180);
  // The way down, in metres east and south.
  const down = { x: Math.sin(t), y: -Math.cos(t) };
  return terrain((x, y) => (inSquare(x, y) ? 6 - k * (x * down.x + y * down.y) + extra(x, y) : 0));
}

describe("reading a roof face's slope from the heights", () => {
  it.each([
    [0, 22],
    [90, 15],
    [180, 30],
    [270, 25],
    [45, 20],
    [337, 18],
  ])("finds a face sloping down to %i° at %i°", (azimuth, pitch) => {
    const found = aspectFromHeights(square, slope(azimuth, pitch));
    expect(found).not.toBeNull();
    expect(bearingGap(found!.azimuth, azimuth)).toBeLessThanOrEqual(1);
    expect(found!.pitch).toBeCloseTo(pitch, 0);
    expect(found!.flat).toBe(false);
    expect(found!.from).toBe("heights");
  });

  it("calls a nearly level roof flat", () => {
    const found = aspectFromHeights(square, slope(10, 1.5));
    expect(found?.flat).toBe(true);
  });

  it("reads through a few centimetres of noise", () => {
    let seed = 7;
    const noise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.06;
    };
    const found = aspectFromHeights(square, slope(0, 22, noise));
    expect(bearingGap(found!.azimuth, 0)).toBeLessThanOrEqual(2);
    expect(found!.pitch).toBeCloseTo(22, 0);
  });

  it("sets aside a tree over part of the roof and still finds the slope", () => {
    const tree = (x: number, y: number) => (Math.hypot(x - 2, y - 1) < 1.2 ? 3 : 0);
    const found = aspectFromHeights(square, slope(0, 22, tree));
    expect(found).not.toBeNull();
    expect(bearingGap(found!.azimuth, 0)).toBeLessThanOrEqual(1);
    expect(found!.pitch).toBeCloseTo(22, 0);
  });

  it("gives no answer for a hip traced as one face: two slopes don't make one plane", () => {
    const k = Math.tan((25 * Math.PI) / 180);
    // A ridge down the middle running north-south: one side falls east, the other west.
    const hip = terrain((x, y) => (inSquare(x, y) ? 6 - k * Math.abs(x) : 0));
    expect(aspectFromHeights(square, hip)).toBeNull();
  });

  it("gives no answer when the outline holds too few heights", () => {
    const tiny: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(aspectFromHeights(tiny, slope(0, 22))).toBeNull();
    expect(aspectFromHeights(square.slice(0, 2), slope(0, 22))).toBeNull();
  });

  it("keeps the gutter and ridge out of the fit", () => {
    // The ground right beside the outline would drag a plane down if it were counted; the edge margin leaves it out.
    const found = aspectFromHeights(square, slope(180, 20));
    expect(found!.pitch).toBeCloseTo(20, 0);
    expect(ASPECT.edge).toBeGreaterThan(CELL);
  });
});

const centre = { lat: -37.89, lng: 145.18 };
const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
const at = (x: number, y: number) => ({ lat: centre.lat - y / mLat, lng: centre.lng + x / mLng });

function model(): RoofModel {
  const spot = (x: number, y: number, segment: number) => ({ ...at(x, y), orientation: "PORTRAIT" as const, segment, kwh: 500 });
  return {
    panel: { heightM: 1.879, widthM: 1.045, watts: 400 },
    faces: [
      { azimuth: 2, pitch: 21 },
      { azimuth: 92, pitch: 21 },
    ],
    // Face 0 under the square; face 1 well to the east of it.
    slots: [spot(-2, 0, 0), spot(0, 0, 0), spot(2, 0, 0), spot(12, 0, 1), spot(14, 0, 1), spot(1, 1, 1)],
  };
}

describe("Google's roof model as the second opinion", () => {
  it("takes the face with the most spots inside the outline", () => {
    const found = aspectFromModel(square, model(), centre);
    expect(found).toEqual({ azimuth: 2, pitch: 21, flat: false, from: "roof model" });
  });

  it("needs at least two spots inside", () => {
    const off: Point[] = square.map((p) => ({ x: p.x + 100, y: p.y }));
    expect(aspectFromModel(off, model(), centre)).toBeNull();
  });

  it("is used when the heights don't answer, and the heights win when they do", () => {
    const k = Math.tan((25 * Math.PI) / 180);
    const hip = terrain((x, y) => (inSquare(x, y) ? 6 - k * Math.abs(x) : 0));
    expect(readAspect({ points: square, terrain: hip, model: model(), centre })?.aspect.from).toBe("roof model");
    const read = readAspect({ points: square, terrain: slope(0, 22), model: model(), centre });
    expect(read?.aspect.from).toBe("heights");
    expect(read?.disagrees).toBe(false);
    expect(readAspect({ points: square, terrain: null, model: null, centre })).toBeNull();
  });

  it("says when the heights and the model point different ways", () => {
    const read = readAspect({ points: square, terrain: slope(90, 22), model: model(), centre });
    expect(read?.aspect.azimuth).toBe(90);
    expect(read?.disagrees).toBe(true);
  });
});

describe("laying a face's rows from its slope", () => {
  const base = { points: square };

  it.each([0, 30, 90, 135, 180, 225, 270, 300, 359])("panels on a face sloping to %i° look that way", (azimuth) => {
    const sits = faceFromAspect(base, { azimuth, pitch: 22, flat: false, from: "heights" });
    expect(sits.angle).toBeGreaterThanOrEqual(-90);
    expect(sits.angle).toBeLessThan(90);
    expect(sits.tilt).toBe(22);
    expect(bearingGap(faceFacing(sits as Pick<Face, "angle" | "facing">), azimuth)).toBeLessThanOrEqual(0.5);
  });

  it("names the nearest compass point", () => {
    expect(facingOf(0)).toBe("N");
    expect(facingOf(350)).toBe("N");
    expect(facingOf(22)).toBe("N");
    expect(facingOf(23)).toBe("NE");
    expect(facingOf(180)).toBe("S");
    expect(facingOf(-90)).toBe("W");
  });

  it("lays a flat roof's rows along its longest edge, looking north", () => {
    const sits = faceFromAspect(base, { azimuth: 200, pitch: 1, flat: true, from: "heights" });
    expect(sits).toEqual({ angle: 0, facing: "N", tilt: 1 });
  });

  it("keeps the pitch within what the designer takes", () => {
    expect(faceFromAspect(base, { azimuth: 0, pitch: 75, flat: false, from: "heights" }).tilt).toBe(60);
  });
});
