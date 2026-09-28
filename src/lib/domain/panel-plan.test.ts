import { describe, expect, it } from "vitest";
import { PANEL } from "./catalogue";
import {
  cleanPlan,
  metresBetween,
  nextPanel,
  normaliseRotation,
  offset,
  panelCorners,
  planArrays,
  rotationTowards,
  snapPanel,
  type PlacedPanel,
} from "./panel-plan";
import { designView, metresPerPixel, toPixel } from "./roof-layout";

const HOME = { lat: -37.84, lng: 144.99 };
const view = designView(HOME);

describe("panel plan", () => {
  it("draws a portrait panel tall and a landscape one wide, at true size", () => {
    const mpp = metresPerPixel(view);
    const size = (p: PlacedPanel) => {
      const c = panelCorners(p, view);
      const xs = c.map((q) => q.x);
      const ys = c.map((q) => q.y);
      return { w: (Math.max(...xs) - Math.min(...xs)) * mpp, h: (Math.max(...ys) - Math.min(...ys)) * mpp };
    };
    const portrait = size({ ...HOME, rotation: 0 });
    expect(portrait.w).toBeCloseTo(PANEL.widthM, 1);
    expect(portrait.h).toBeCloseTo(PANEL.heightM, 1);
    const landscape = size({ ...HOME, rotation: 90 });
    expect(landscape.w).toBeCloseTo(PANEL.heightM, 1);
  });

  it("adds the next panel beside the last, in line", () => {
    const first: PlacedPanel = { ...HOME, rotation: 30 };
    const second = nextPanel([first], HOME);
    const d = metresBetween(first, second);
    expect(Math.hypot(d.east, d.north)).toBeCloseTo(PANEL.widthM + 0.02, 2);
    expect(second.rotation).toBe(30);
    const third = nextPanel([first, second], HOME);
    const d3 = metresBetween(first, third);
    expect(Math.hypot(d3.east, d3.north)).toBeCloseTo(2 * (PANEL.widthM + 0.02), 2);
  });

  it("snaps a dragged panel neatly beside a neighbour", () => {
    const a: PlacedPanel = { ...HOME, rotation: 0 };
    const rough = { ...offset(HOME, PANEL.widthM + 0.2, 0.15), rotation: 2 };
    const snapped = snapPanel(rough, [a]);
    const d = metresBetween(a, snapped);
    expect(d.east).toBeCloseTo(PANEL.widthM + 0.02, 2);
    expect(d.north).toBeCloseTo(0, 2);
    expect(snapped.rotation).toBe(0);
    // Too far away, or at a different angle: left where it was.
    const far = { ...offset(HOME, 3, 1), rotation: 0 };
    expect(snapPanel(far, [a])).toEqual(far);
    const turned = { ...rough, rotation: 25 };
    expect(snapPanel(turned, [a])).toEqual(turned);
  });

  it("counts arrays as groups of touching panels", () => {
    const row = [0, 1, 2].map((k) => ({ ...offset(HOME, k * (PANEL.widthM + 0.02), 0), rotation: 0 }));
    const apart = { ...offset(HOME, 0, 8), rotation: 0 };
    expect(planArrays(row)).toBe(1);
    expect(planArrays([...row, apart])).toBe(2);
    expect(planArrays([])).toBe(0);
  });

  it("points the rotate handle's way", () => {
    const p: PlacedPanel = { ...HOME, rotation: 0 };
    const c = toPixel(p.lat, p.lng, view);
    expect(rotationTowards(p, c.x, c.y - 50, view)).toBe(0);
    expect(rotationTowards(p, c.x + 50, c.y, view)).toBe(90);
    expect(rotationTowards(p, c.x - 50, c.y, view)).toBe(270);
    expect(normaliseRotation(-30)).toBe(330);
  });

  it("checks plans from the portal", () => {
    expect(cleanPlan([{ ...HOME, rotation: 370 }], HOME)).toEqual([{ ...HOME, rotation: 10 }]);
    expect(cleanPlan([{ ...offset(HOME, 500, 0), rotation: 0 }], HOME)).toBeNull();
    expect(cleanPlan([{ lat: "x", lng: 1, rotation: 0 }], HOME)).toBeNull();
    expect(cleanPlan("nope", HOME)).toBeNull();
    expect(cleanPlan([], HOME)).toEqual([]);
  });
});
