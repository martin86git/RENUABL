import { describe, expect, it } from "vitest";
import { groundHeight, obliqueMetresPerPixel, onObliqueView, OBLIQUE } from "./oblique";

const lat = -37.9;
const mpp = obliqueMetresPerPixel(lat);

describe("the design on the side views", () => {
  it("puts the picture's middle on the ground in the middle of every view", () => {
    for (const side of ["North", "East", "South", "West"] as const)
      expect(onObliqueView({ x: 0, y: 0, up: 0 }, side, lat)).toEqual({ x: 400, y: 300 });
  });

  it("turns the ground so the camera's way is up", () => {
    // Ten metres north of the middle: up the view looking north, down looking south, left looking east, right looking west.
    const north = { x: 0, y: -10, up: 0 };
    expect(onObliqueView(north, "North", lat).y).toBeLessThan(300);
    expect(onObliqueView(north, "South", lat).y).toBeGreaterThan(300);
    expect(onObliqueView(north, "East", lat).x).toBeLessThan(400);
    expect(onObliqueView(north, "West", lat).x).toBeGreaterThan(400);
  });

  it("shows a higher point further along the camera's way, squashed as the view is", () => {
    const ground = onObliqueView({ x: 0, y: 0, up: 0 }, "North", lat);
    const roof = onObliqueView({ x: 0, y: 0, up: 6 }, "North", lat);
    expect(ground.x).toBe(roof.x);
    expect(ground.y - roof.y).toBeCloseTo(((6 * OBLIQUE.lean) / mpp) * OBLIQUE.squash, 6);
  });

  it("finds the ground under roofs and trees", () => {
    const heights = [...Array(80).fill(42), ...Array(20).fill(49.5)];
    expect(groundHeight(heights)).toBe(42);
    expect(groundHeight([1, 2])).toBeNull();
  });
});
