import { describe, expect, it } from "vitest";
import type { RoofModel } from "../roof-layout";
import { PANEL, looseCorners, panelFacing } from "./roof-design";
import { MAX_SUGGESTED, suggestPanels } from "./suggest";

const centre = { lat: -37.89, lng: 145.18 };
const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
const google = { heightM: 1.879, widthM: 1.045, watts: 400 };

/** A roof face of Google's spots: `rows` down the slope by `cols` across it, the way Google spaces them. */
function face(azimuth: number, pitch: number, rows: number, cols: number, orientation: "PORTRAIT" | "LANDSCAPE", segment = 0, east = 0) {
  const t = (azimuth * Math.PI) / 180;
  const down = (orientation === "PORTRAIT" ? google.heightM : google.widthM) * Math.cos((pitch * Math.PI) / 180);
  const side = orientation === "PORTRAIT" ? google.widthM : google.heightM;
  const slots = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const e = east + Math.sin(t) * r * down + Math.cos(t) * c * side;
      const n = Math.cos(t) * r * down - Math.sin(t) * c * side;
      slots.push({ lat: centre.lat + n / mLat, lng: centre.lng + e / mLng, orientation, segment, kwh: 600 - r - c });
    }
  return slots;
}

let made = 0;
const id = () => `p${made++}`;
const apart = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("suggesting a layout from the roof's shape", () => {
  it("lays the chosen spots out as a tidy block at our panel's size, so none overlap", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 22 }], slots: face(0, 22, 2, 4, "PORTRAIT") };
    const panels = suggestPanels(model, centre, 8, PANEL, id);
    expect(panels).toHaveLength(8);
    // Portrait on a north face: the long edge runs down the slope, the panel looks north, at the roof's pitch.
    expect(panels.every((p) => p.angle === 0 && !p.across && p.tilt === 22)).toBe(true);
    expect(panels.every((p) => panelFacing(p) === 0)).toBe(true);
    // Neighbours are a whole panel and the gap apart, not Google's foreshortened spacing.
    const nearest = panels.map((p) => Math.min(...panels.filter((q) => q !== p).map((q) => apart(p, q))));
    expect(Math.min(...nearest)).toBeCloseTo(PANEL.short + PANEL.gap, 2);
    const rowGap = Math.max(...panels.map((p) => p.y)) - Math.min(...panels.map((p) => p.y));
    expect(rowGap).toBeCloseTo(PANEL.long + PANEL.gap, 2);
    // And the block stays where the roof face is: its middle is the middle of Google's spots.
    const mid = { x: panels.reduce((n, p) => n + p.x, 0) / 8, y: panels.reduce((n, p) => n + p.y, 0) / 8 };
    expect(mid.x).toBeCloseTo(1.5 * google.widthM, 1);
    expect(Math.abs(mid.y)).toBeLessThan(1.2);
  });

  it("turns panels to the way each face looks, and lays one on its side across its long edge", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 270, pitch: 30 }], slots: face(270, 30, 2, 3, "LANDSCAPE") };
    const panels = suggestPanels(model, centre, 6, PANEL, id);
    expect(panels).toHaveLength(6);
    expect(panels.every((p) => p.across === true && panelFacing(p) === 270 && p.tilt === 30)).toBe(true);
    // No two panels' outlines share a middle, and each outline is our panel's size.
    const corners = looseCorners(panels[0], PANEL);
    expect(apart(corners[0], corners[1])).toBeCloseTo(PANEL.short, 2);
    expect(new Set(panels.map((p) => `${p.x},${p.y}`)).size).toBe(6);
  });

  it("never lays more than asked for, than the roof has room for, or than the limit", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 4, "PORTRAIT") };
    expect(suggestPanels(model, centre, 5, PANEL, id)).toHaveLength(5);
    expect(suggestPanels(model, centre, 40, PANEL, id)).toHaveLength(12);
    expect(suggestPanels(model, centre, 0, PANEL, id)).toEqual([]);
    const big: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 10, 10, "PORTRAIT") };
    expect(suggestPanels(big, centre, 500, PANEL, id).length).toBeLessThanOrEqual(MAX_SUGGESTED);
    expect(suggestPanels({ panel: google, faces: [], slots: [] }, centre, 10, PANEL, id)).toEqual([]);
  });
});
