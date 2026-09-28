import { describe, expect, it } from "vitest";
import { jobMaterials } from "./materials";
import {
  autoLayout,
  cleanLayout,
  designView,
  framing,
  layoutArrays,
  layoutYearlyKwh,
  metresPerPixel,
  panelOutline,
  parseRoofModel,
  toPixel,
  toggleSlot,
} from "./roof-layout";
import type { Job } from "./types";

const centre = { lat: -37.88, lng: 145.16 };
// Shaped like Google's buildingInsights solarPotential (trimmed): best spots first.
const raw = {
  solarPotential: {
    panelCapacityWatts: 400,
    panelHeightMeters: 1.879,
    panelWidthMeters: 1.045,
    roofSegmentStats: [
      { pitchDegrees: 20, azimuthDegrees: 0 },
      { pitchDegrees: 20, azimuthDegrees: 270 },
    ],
    solarPanels: [
      { center: { latitude: -37.88, longitude: 145.16 }, orientation: "PORTRAIT", segmentIndex: 0, yearlyEnergyDcKwh: 600 },
      { center: { latitude: -37.88, longitude: 145.16002 }, orientation: "PORTRAIT", segmentIndex: 0, yearlyEnergyDcKwh: 590 },
      { center: { latitude: -37.88003, longitude: 145.15995 }, orientation: "LANDSCAPE", segmentIndex: 1, yearlyEnergyDcKwh: 450 },
      { center: { latitude: 0, longitude: 0 }, segmentIndex: 7 },
    ],
  },
};

describe("roof model", () => {
  it("reads Google's panel spots and drops ones on unknown faces", () => {
    const m = parseRoofModel(raw)!;
    expect(m.slots).toHaveLength(3);
    expect(m.slots[2]).toEqual({ lat: -37.88003, lng: 145.15995, orientation: "LANDSCAPE", segment: 1, kwh: 450 });
    expect(m.panel).toEqual({ heightM: 1.879, widthM: 1.045, watts: 400 });
    expect(parseRoofModel({ solarPotential: {} })).toBeNull();
  });

  it("projects like the satellite image: the centre is the middle, ~6 cm a pixel", () => {
    const v = designView(centre);
    expect(toPixel(centre.lat, centre.lng, v)).toEqual({ x: 640, y: 640 });
    expect(metresPerPixel(v)).toBeCloseTo(0.059, 3);
    const east = toPixel(centre.lat, centre.lng + 0.0001, v);
    expect(east.x).toBeGreaterThan(640);
    expect(toPixel(centre.lat + 0.0001, centre.lng, v).y).toBeLessThan(640); // north is up
  });

  it("draws panels to scale, foreshortened down the slope", () => {
    const m = parseRoofModel(raw)!;
    const v = designView(centre);
    const [a, b, c] = panelOutline(m.slots[0], m, v);
    const len = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y) * metresPerPixel(v);
    // North-facing portrait panel: 1.045 m across, 1.879 m × cos 20° ≈ 1.766 m seen from above.
    expect(len(a, b)).toBeCloseTo(1.045, 1);
    expect(len(b, c)).toBeCloseTo(1.766, 1);
    const f = framing(m, v);
    expect(f.w).toBeGreaterThan(0);
    expect(f.x).toBeGreaterThanOrEqual(0);
  });

  it("auto-layout takes the best spots; arrays count the faces used", () => {
    const m = parseRoofModel(raw)!;
    expect(autoLayout(m, 2)).toEqual([0, 1]);
    expect(autoLayout(m, 10)).toEqual([0, 1, 2]);
    expect(layoutArrays(m, [0, 1])).toBe(1);
    expect(layoutArrays(m, [0, 2])).toBe(2);
    // Google's kWh (400 W panels) re-stated for 475 W: (600 + 590) × 475 / 400
    expect(layoutYearlyKwh(m, [0, 1], 475)).toBe(1413);
  });

  it("auto-layout groups panels on as few faces as it can, with no lone panels", () => {
    const spot = (segment: number, kwh: number) => ({ lat: -37.88, lng: 145.16, orientation: "PORTRAIT" as const, segment, kwh });
    const m = {
      panel: { heightM: 1.879, widthM: 1.045, watts: 400 },
      faces: [],
      // Google lists the best spots first, across faces: a tiny sunny face (1), a big north face (0), a west face (2).
      slots: [
        spot(1, 620),
        spot(0, 600),
        spot(0, 598),
        spot(2, 590),
        spot(0, 596),
        spot(0, 595),
        spot(0, 594),
        spot(2, 580),
        spot(0, 590),
        spot(2, 570),
        spot(2, 560),
        spot(0, 585),
      ],
    };
    const faces = (sel: number[]) => new Set(sel.map((i) => m.slots[i].segment));
    // 6 panels: all on the big north face, not one on the tiny face and the rest scattered.
    expect(faces(autoLayout(m, 6))).toEqual(new Set([0]));
    // 10 panels: the north face (7 spots) plus the west face, still no lone panel.
    const ten = autoLayout(m, 10);
    expect(ten).toHaveLength(10);
    expect(faces(ten)).toEqual(new Set([0, 2]));
    expect(autoLayout(m, 99)).toHaveLength(12);
  });

  it("checks saved layouts and toggles spots", () => {
    expect(cleanLayout([2, 0, 0, 9, -1, 1.5, "x"], 3)).toEqual([0, 2]);
    expect(cleanLayout("nope", 3)).toBeNull();
    expect(toggleSlot([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleSlot([0, 1, 2], 1)).toEqual([0, 2]);
  });

  it("a saved layout's arrays feed the materials", () => {
    const job = {
      id: "j",
      reference: "RN-1",
      recordKey: "k",
      system: { panelCount: 12, batteryKwh: 0, evCharger: false },
      site: { storeys: "single", roof: "Flat roof", orientation: "", accessNotes: "", switchboardNotes: "", imagery: [] },
    } as unknown as Job;
    const kliplok = (j: Job) => jobMaterials(j).find((l) => l.sku === "CLNER-I-34")?.qty;
    // 2 per panel + 2 per array: 12 panels, 2 arrays assumed → 28; a saved 4-array layout → 32.
    expect(kliplok(job)).toBe(28);
    expect(kliplok({ ...job, layout: { slots: [], arrays: 4, updatedAt: "" } })).toBe(32);
  });
});
