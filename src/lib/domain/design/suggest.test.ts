import { describe, expect, it } from "vitest";
import type { RoofModel } from "../roof-layout";
import { PANEL, facePanels, looseCorners, panelFacing, type Face, type LoosePanel } from "./roof-design";
import { bestBlock, fillFace, fillFaces } from "./rows";
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

/** Whether a point is on one of a model's spots (the same test the layout uses, with its 3 cm grace). */
function onRoof(model: RoofModel, p: { x: number; y: number }) {
  return model.slots.some((s) => {
    const f = model.faces[s.segment];
    const t = (f.azimuth * Math.PI) / 180;
    const down = { x: Math.sin(t), y: -Math.cos(t) };
    const side = { x: Math.cos(t), y: Math.sin(t) };
    const portrait = s.orientation === "PORTRAIT";
    const halfDown = ((portrait ? google.heightM : google.widthM) * Math.cos((f.pitch * Math.PI) / 180)) / 2;
    const halfSide = (portrait ? google.widthM : google.heightM) / 2;
    const d = { x: p.x - (s.lng - centre.lng) * mLng, y: p.y + (s.lat - centre.lat) * mLat };
    return Math.abs(d.x * down.x + d.y * down.y) <= halfDown + 0.03 && Math.abs(d.x * side.x + d.y * side.y) <= halfSide + 0.03;
  });
}
const allOnRoof = (model: RoofModel, panels: LoosePanel[]) => panels.every((p) => looseCorners(p, PANEL).every((c) => onRoof(model, c)));
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

describe("laying panels in the fewest straight rows", () => {
  it("puts 24 panels in two rows of 12 when the face has room for rows of 14", () => {
    const fits = () => true;
    const block = bestBlock(fits, 3, 14, 24);
    expect(block.rows).toBe(2);
    const byRow = [0, 1, 2].map((r) => block.cells.filter((c) => c.row === r).length).filter(Boolean);
    expect(byRow).toEqual([12, 12]);
    // Both rows start and end in line, in the middle of the run.
    const cols = (r: number) => block.cells.filter((c) => c.row === r).map((c) => c.col);
    expect(cols(block.cells[0].row)).toEqual(cols(block.cells[0].row + 1));
    expect(Math.min(...block.cells.map((c) => c.col))).toBe(1);
  });

  it("uses one row when one row holds them all, and centres a short last row", () => {
    expect(bestBlock(() => true, 4, 20, 9).rows).toBe(1);
    const block = bestBlock(() => true, 4, 6, 10);
    expect(block.rows).toBe(2);
    const last = block.cells.filter((c) => c.row === 1).map((c) => c.col);
    expect(last).toEqual([0, 1, 2, 3, 4]);
    const odd = bestBlock(() => true, 4, 6, 11);
    expect(odd.cells.filter((c) => c.row === 1).map((c) => c.col)).toEqual([0, 1, 2, 3, 4]);
  });

  it("steps around places that don't fit, and takes the biggest block when none holds them all", () => {
    // A vent in the middle of the second row.
    const fits = (r: number, c: number) => !(r === 1 && c === 5);
    const block = bestBlock(fits, 2, 12, 12);
    expect(block.cells.every((c) => fits(c.row, c.col))).toBe(true);
    expect(block.cells).toHaveLength(12);
    const small = bestBlock(() => true, 2, 3, 10);
    expect(small.cells).toHaveLength(6);
    expect(bestBlock(() => false, 3, 3, 4).cells).toEqual([]);
  });

  it("prefers the sunnier places among blocks as long", () => {
    const block = bestBlock(
      () => true,
      3,
      4,
      4,
      (r) => (r === 2 ? 10 : 1),
    );
    expect(block.cells.every((c) => c.row === 2)).toBe(true);
  });
});

describe("suggesting a layout from Google's roof model", () => {
  it("lays 24 panels in two long, straight portrait rows, all on the roof", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 15, "PORTRAIT") };
    const panels = suggestPanels(model, centre, 24, PANEL, id);
    expect(panels).toHaveLength(24);
    expect(panels.every((p) => p.angle === 0 && !p.across && p.tilt === 20)).toBe(true);
    expect(rowsOf(panels, 0).sort()).toEqual([12, 12]);
    expect(allOnRoof(model, panels)).toBe(true);
    expect(overlapping(panels)).toBe(false);
  });

  it("lays portrait rows even where Google's spots are landscape, looking the way the face does", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 270, pitch: 25 }], slots: face(270, 25, 5, 5, "LANDSCAPE") };
    const panels = suggestPanels(model, centre, 8, PANEL, id);
    expect(panels).toHaveLength(8);
    expect(panels.every((p) => !p.across && panelFacing(p) === 270 && p.tilt === 25)).toBe(true);
    expect(allOnRoof(model, panels)).toBe(true);
    expect(overlapping(panels)).toBe(false);
  });

  it("takes a flat roof Google split into faces at odd angles as one roof, with rows along its longer side", () => {
    // One flat roof, 16 m east to west, that Google saw as two faces pointing opposite ways.
    const model: RoofModel = {
      panel: google,
      faces: [
        { azimuth: 0, pitch: 2 },
        { azimuth: 180, pitch: 1 },
      ],
      slots: [...face(0, 0, 3, 8, "PORTRAIT", 0), ...face(0, 0, 3, 8, "PORTRAIT", 1, 8 * google.widthM)],
    };
    const panels = suggestPanels(model, centre, 24, PANEL, id);
    expect(panels).toHaveLength(24);
    // One way for every panel: across the roof, towards the north.
    expect(new Set(panels.map((p) => p.angle))).toEqual(new Set([0]));
    expect(rowsOf(panels, 0).sort()).toEqual([12, 12]);
    expect(overlapping(panels)).toBe(false);
  });

  it("moves the panels with the model when it is lined up with today's photo", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 6, "PORTRAIT") };
    const plain = suggestPanels(model, centre, 6, PANEL, id);
    const moved = suggestPanels(model, centre, 6, PANEL, id, { x: 1.5, y: -0.5 });
    expect(moved.map((p) => [p.x, p.y])).toEqual(
      plain.map((p) => [Math.round((p.x + 1.5) * 100) / 100, Math.round((p.y - 0.5) * 100) / 100]),
    );
  });

  it("fills the sunniest face first and never leaves a lone panel or two on another", () => {
    const model: RoofModel = {
      panel: google,
      faces: [
        { azimuth: 0, pitch: 20 },
        { azimuth: 90, pitch: 20 },
      ],
      slots: [
        ...face(0, 20, 2, 5, "PORTRAIT", 0).map((s) => ({ ...s, kwh: 600 })),
        ...face(90, 20, 3, 6, "PORTRAIT", 1, 20).map((s) => ({ ...s, kwh: 450 })),
      ],
    };
    const panels = suggestPanels(model, centre, 12, PANEL, id);
    expect(panels).toHaveLength(12);
    const north = panels.filter((p) => p.angle === 0).length;
    const east = panels.filter((p) => p.angle === 90).length;
    expect(north).toBeGreaterThanOrEqual(4);
    expect(east === 0 || east >= 4).toBe(true);
  });

  it("never lays more than asked for, than the roof has room for, or than the limit", () => {
    const model: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 3, 4, "PORTRAIT") };
    expect(suggestPanels(model, centre, 5, PANEL, id)).toHaveLength(5);
    expect(suggestPanels(model, centre, 40, PANEL, id).length).toBeLessThanOrEqual(12);
    expect(suggestPanels(model, centre, 0, PANEL, id)).toEqual([]);
    const big: RoofModel = { panel: google, faces: [{ azimuth: 0, pitch: 20 }], slots: face(0, 20, 10, 10, "PORTRAIT") };
    expect(suggestPanels(big, centre, 500, PANEL, id).length).toBeLessThanOrEqual(MAX_SUGGESTED);
    expect(suggestPanels({ panel: google, faces: [], slots: [] }, centre, 10, PANEL, id)).toEqual([]);
  });
});

describe("filling traced faces in rows", () => {
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  // A flat roof 16 m by 4 m, traced: room for two rows of 13 portrait panels.
  const flat: Face = { id: "f", points: rect(-8, -2, 8, 2), angle: 0, landscape: false, setback: 0.2, facing: "N", tilt: 2, off: [] };

  it("puts 24 panels on a traced roof in two rows of 12", () => {
    const { face: filled, placed } = fillFace(flat, PANEL, 24);
    expect(placed).toBe(24);
    const panels = facePanels(filled, PANEL);
    expect(panels).toHaveLength(24);
    const rowOf = (p: (typeof panels)[number]) => Math.round(Math.min(...p.corners.map((c) => c.y)) * 10);
    const rows = new Map<number, number>();
    for (const p of panels) rows.set(rowOf(p), (rows.get(rowOf(p)) ?? 0) + 1);
    expect([...rows.values()]).toEqual([12, 12]);
  });

  it("keeps places switched off by hand off", () => {
    const { face: filled } = fillFace({ ...flat, off: [0, 1] }, PANEL, 24);
    expect(filled.off).toEqual(expect.arrayContaining([0, 1]));
  });

  it("fills the sunnier face first and stops at the count", () => {
    const south: Face = { ...flat, id: "s", points: rect(-8, 4, 8, 8), facing: "S", tilt: 25 };
    const north: Face = { ...flat, id: "n", facing: "N", tilt: 25 };
    const { faces, placed } = fillFaces([south, north], PANEL, 10);
    expect(placed).toBe(10);
    expect(
      facePanels(
        faces.find((f) => f.id === "n")!,
        PANEL,
      ),
    ).toHaveLength(10);
    expect(
      facePanels(
        faces.find((f) => f.id === "s")!,
        PANEL,
      ),
    ).toHaveLength(0);
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
