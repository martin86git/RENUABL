import { describe, expect, it } from "vitest";
import { DESIGN_SAVED, designSavedLine, isDesignSavedLine } from "./design-record";
import type { DesignSet, RoofDesign } from "./roof-design";

const panels = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: i * 3, y: 0, angle: 0 }));
const design = (extra: Partial<RoofDesign> = {}): RoofDesign =>
  ({ lat: -37.8, lng: 145, faces: [], loose: panels(14), ...extra }) as RoofDesign;

describe("the line a saved design writes on its deal's timeline", () => {
  it("names the primary design's size, battery and charger", () => {
    const set: DesignSet = {
      designs: [
        design(),
        design({
          battery: { sku: "b", name: "Battery", kwh: 8, qty: 2, x: 0, y: 0 },
          charger: { sku: "c", name: "Charger", kw: 7, x: 0, y: 0 },
        } as Partial<RoofDesign>),
      ],
      primary: 1,
      comments: [],
    };
    const line = designSavedLine(set);
    expect(line).toMatch(/^Roof design saved · [\d.]+ kW, 14 panels, 16 kWh battery, EV charger · 2 designs$/);
    expect(isDesignSavedLine(line)).toBe(true);
  });
  it("says only that it was saved when nothing is drawn", () => {
    expect(designSavedLine({ designs: [design({ loose: [] })], primary: 0, comments: [] })).toBe(DESIGN_SAVED);
    expect(isDesignSavedLine("Moved to Designed")).toBe(false);
  });
});
