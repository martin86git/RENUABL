import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RoofModel } from "../roof-layout";
import { FACE_EDGE } from "./drawing";
import { EDGE_CLEARANCE } from "./pack";
import { PANEL, looseCorners, panelFacing, type LoosePanel } from "./roof-design";
import { MAX_SUGGESTED, imageryWhen, mismatchNote, modelOffset, suggestPanels } from "./suggest";

const centre = { lat: -37.89, lng: 145.18 };
const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
const google = { heightM: 1.879, widthM: 1.045, watts: 400 };

/** A roof face of Google's spots: `rows` down the slope by `cols` across it, the way Google spaces them (seen from above). */
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

/**
 * Whether a point is within a face of the model with the edge clearance kept: on one of its spots reaching
 * `FACE_EDGE` past them, less the clearance.
 */
function within(model: RoofModel, p: { x: number; y: number }, offset = { x: 0, y: 0 }) {
  const reach = FACE_EDGE - EDGE_CLEARANCE + 0.005;
  return model.slots.some((s) => {
    const f = model.faces[s.segment];
    const t = (f.azimuth * Math.PI) / 180;
    const down = { x: Math.sin(t), y: -Math.cos(t) };
    const side = { x: Math.cos(t), y: Math.sin(t) };
    const portrait = s.orientation === "PORTRAIT";
    const halfDown = ((portrait ? google.heightM : google.widthM) * Math.cos((f.pitch * Math.PI) / 180)) / 2;
    const halfSide = (portrait ? google.widthM : google.heightM) / 2;
    const d = { x: p.x - (s.lng - centre.lng) * mLng - offset.x, y: p.y + (s.lat - centre.lat) * mLat - offset.y };
    return Math.abs(d.x * down.x + d.y * down.y) <= halfDown + reach && Math.abs(d.x * side.x + d.y * side.y) <= halfSide + reach;
  });
}
const allWithin = (model: RoofModel, panels: LoosePanel[], offset = { x: 0, y: 0 }) =>
  panels.every((p) => looseCorners(p, PANEL).every((c) => within(model, c, offset)));
const overlapping = (panels: LoosePanel[]) =>
  panels.some((a, i) => panels.some((b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) < PANEL.short - 0.01));
/** The panels' rows: how many panels at each distance down the slope. */
const rowsOf = (panels: LoosePanel[], facing: number) => {
  const t = (facing * Math.PI) / 180;
  const counts = new Map<number, number>();
  for (const p of panels) {
    const v = Math.round((p.x * Math.sin(t) - p.y * Math.cos(t)) * 10) / 10;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.values()];
};

let made = 0;
const id = () => `p${made++}`;

describe("suggesting a layout from Google's roof model", () => {
  it("lays straight portrait rows, never a lone panel in a row, every panel clear of the face's edge", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 15, "PORTRAIT") };
    const panels = suggestPanels(model, centre, 24, PANEL, id);
    expect(panels).toHaveLength(24);
    expect(panels.every((p) => p.angle === 0 && !p.across && p.tilt === 20)).toBe(true);
    const rows = rowsOf(panels, 0);
    expect(rows.length).toBe(2);
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(2);
    expect(allWithin(model, panels)).toBe(true);
    expect(overlapping(panels)).toBe(false);
  });

  it("lays portrait even where Google's spots are landscape, looking the way the face does", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 270, pitch: 25 }], slots: face(270, 25, 5, 5, "LANDSCAPE") };
    const panels = suggestPanels(model, centre, 6, PANEL, id);
    expect(panels).toHaveLength(6);
    expect(panels.every((p) => !p.across && panelFacing(p) === 270 && p.tilt === 25)).toBe(true);
    expect(allWithin(model, panels)).toBe(true);
  });

  it("takes a flat roof Google split into faces pointing different ways as one roof", () => {
    const model: RoofModel = {
      panel: google,
      faces: [
        { azimuth: 0, pitch: 2 },
        { azimuth: 180, pitch: 1 },
      ],
      slots: [...face(0, 0, 3, 8, "PORTRAIT", 0), ...face(0, 0, 3, 8, "PORTRAIT", 1, 8 * google.widthM)],
    };
    const panels = suggestPanels(model, centre, 20, PANEL, id);
    expect(panels).toHaveLength(20);
    expect(new Set(panels.map((p) => p.angle))).toEqual(new Set([0]));
    expect(overlapping(panels)).toBe(false);
  });

  it("moves the panels with the model when it is lined up with today's photo", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 8, "PORTRAIT") };
    const plain = suggestPanels(model, centre, 6, PANEL, id);
    const moved = suggestPanels(model, centre, 6, PANEL, id, { x: 1.5, y: -0.5 });
    expect(moved.map((p) => [p.x, p.y])).toEqual(
      plain.map((p) => [Math.round((p.x + 1.5) * 100) / 100, Math.round((p.y - 0.5) * 100) / 100]),
    );
  });

  it("never lays more than asked for, than the roof has room for, or than the limit", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 6, "PORTRAIT") };
    expect(suggestPanels(model, centre, 5, PANEL, id)).toHaveLength(5);
    expect(suggestPanels(model, centre, 40, PANEL, id).length).toBeLessThan(18);
    expect(suggestPanels(model, centre, 0, PANEL, id)).toEqual([]);
    const big: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 10, 10, "PORTRAIT") };
    expect(suggestPanels(big, centre, 500, PANEL, id).length).toBeLessThanOrEqual(MAX_SUGGESTED);
    expect(suggestPanels({ panel: google, faces: [], slots: [] }, centre, 10, PANEL, id)).toEqual([]);
  });
});

describe("Google's model against today's photo", () => {
  it("turns the photo's shift into metres the other way", () => {
    const at = modelOffset({ x: 20, y: -10 }, centre.lat);
    expect(at.x).toBeLessThan(0);
    expect(at.y).toBeGreaterThan(0);
    expect(Math.abs(at.x)).toBeCloseTo(20 * 0.0587, 1);
  });

  it("says when Google photographed the roof, and asks for it to be traced", () => {
    expect(imageryWhen("2018-12")).toBe("December 2018");
    expect(imageryWhen("2018-13")).toBeNull();
    expect(imageryWhen(null)).toBeNull();
    expect(mismatchNote("2018-12")).toMatch(/photographed December 2018.*Trace the roof faces/);
    expect(mismatchNote(null)).not.toMatch(/photographed/);
  });
});

describe("a hip roof cut into many small faces (3 Bill Place)", () => {
  // A real Melbourne hip roof's model, kept as metres from the middle (no address).
  const fixture = JSON.parse(readFileSync("src/lib/domain/__fixtures__/hip-roof-model.json", "utf8")) as {
    faces: { azimuth: number; pitch: number }[];
    panel: RoofModel["panel"];
    slots: { east: number; south: number; orientation: "PORTRAIT" | "LANDSCAPE"; segment: number; kwh: number }[];
    offset: { x: number; y: number };
  };
  const hip: RoofModel = {
    faces: fixture.faces,
    panel: fixture.panel,
    slots: fixture.slots.map((s) => ({
      lat: centre.lat - s.south / mLat,
      lng: centre.lng + s.east / mLng,
      orientation: s.orientation,
      segment: s.segment,
      kwh: s.kwh,
    })),
  };
  const offset = modelOffset(fixture.offset, centre.lat);
  const lay = (want: number) => suggestPanels(hip, centre, want, PANEL, id, offset);
  const arrays = (panels: LoosePanel[]) => {
    const by = new Map<number, number>();
    for (const p of panels) by.set(panelFacing(p), (by.get(panelFacing(p)) ?? 0) + 1);
    return [...by.values()];
  };

  it.each([6, 10, 12, 14, 24])("lays %i panels as at most two arrays, none of fewer than four", (want) => {
    const panels = lay(want);
    expect(panels.length).toBeGreaterThanOrEqual(Math.min(want, 6));
    expect(panels.length).toBeLessThanOrEqual(want);
    expect(arrays(panels).length).toBeLessThanOrEqual(2);
    expect(Math.min(...arrays(panels))).toBeGreaterThanOrEqual(4);
    expect(overlapping(panels)).toBe(false);
  });

  it("lays the best face in portrait rows, every panel clear of the face's edge", () => {
    const panels = lay(10);
    expect(panels).toHaveLength(10);
    expect(panels.every((p) => !p.across)).toBe(true);
    expect(allWithin(hip, panels, offset)).toBe(true);
  });
});
