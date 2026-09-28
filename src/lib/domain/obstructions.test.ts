import { describe, expect, it } from "vitest";
import { blockedSlots, cleanObstructions } from "./obstructions";
import { designView, parseRoofModel, toPixel } from "./roof-layout";

const centre = { lat: -37.88, lng: 145.16 };
const model = parseRoofModel({
  solarPotential: {
    roofSegmentStats: [{ pitchDegrees: 20, azimuthDegrees: 0 }],
    solarPanels: [
      { center: { latitude: -37.88, longitude: 145.16 }, segmentIndex: 0 },
      { center: { latitude: -37.88, longitude: 145.1601 }, segmentIndex: 0 }, // ~9 m east
    ],
  },
})!;

describe("roof obstructions", () => {
  it("keeps known types and tidy boxes only", () => {
    expect(
      cleanObstructions({
        obstructions: [
          { type: "vent", box: [520, 480, 500, 460], note: "whirlybird <b>" },
          { type: "spaceship", box: [1, 1, 50, 50] },
          { type: "skylight", box: [10, 10, 10, 90] },
          { type: "aerial", box: [-5, 0, 1200, 3] },
        ],
      }),
    ).toEqual([
      { type: "vent", box: [500, 460, 520, 480], note: "whirlybird b" },
      { type: "other", box: [1, 1, 50, 50] },
      { type: "aerial", box: [0, 0, 1000, 3] },
    ]);
    expect(cleanObstructions(null)).toEqual([]);
  });

  it("flags panels on or next to an obstruction", () => {
    const view = designView(centre);
    const full = view.size * view.scale;
    // A small vent box right at the first panel's centre.
    const p = toPixel(-37.88, 145.16, view);
    const box: [number, number, number, number] = [
      ((p.x - 5) / full) * 1000,
      ((p.y - 5) / full) * 1000,
      ((p.x + 5) / full) * 1000,
      ((p.y + 5) / full) * 1000,
    ];
    expect(blockedSlots(model, view, [{ type: "vent", box }])).toEqual([0]);
    expect(blockedSlots(model, view, [])).toEqual([]);
  });
});
