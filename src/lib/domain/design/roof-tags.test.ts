import { describe, expect, it } from "vitest";
import { cleanDesign, freed, roofAfterRemoving, roofOf, type Face } from "./roof-design";

const face: Face = {
  id: "f1",
  points: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ],
  angle: 0,
  landscape: false,
  setback: 0.3,
  facing: "N",
  tilt: 15,
  off: [],
  roof: 2,
};

describe("which roof a panel or face is on", () => {
  it("is kept with the design, and only as a whole number of a roof there can be", () => {
    const clean = cleanDesign({
      lat: -37.9,
      lng: 145.2,
      faces: [face],
      loose: [
        { id: "p1", x: 1, y: 1, angle: 0, tilt: 15, roof: 1 },
        { id: "p2", x: 2, y: 1, angle: 0, tilt: 15, roof: 9 },
        { id: "p3", x: 3, y: 1, angle: 0, tilt: 15, roof: "x" },
      ],
    });
    if (!clean) throw new Error("no design");
    expect(clean.faces[0].roof).toBe(2);
    expect(clean.loose?.map(roofOf)).toEqual([1, 0, 0]);
  });
  it("goes with a panel freed from its face", () => {
    expect(freed(face, { index: 0, corners: [face.points[0], face.points[1], face.points[2], face.points[3]] }, "p9").roof).toBe(2);
  });
  it("moves down when a roof before it is taken away, and back to the home's own when its own is", () => {
    expect(roofOf(roofAfterRemoving({ roof: 3 }, 1))).toBe(2);
    expect(roofOf(roofAfterRemoving({ roof: 1 }, 1))).toBe(0);
    expect(roofAfterRemoving({ roof: 1 }, 2)).toEqual({ roof: 1 });
    expect(roofAfterRemoving({}, 1)).toEqual({});
  });
});
