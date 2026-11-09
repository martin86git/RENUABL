import { describe, expect, it } from "vitest";
import {
  EDGE_CLEARANCE,
  MOUNT_STANDOFF,
  clearanceFor,
  laidAs,
  packArea,
  packAreas,
  packFaces,
  regionsOf,
  avoiding,
  inRows,
  rowCounts,
  reorient,
  tracedArea,
  type Area,
} from "./pack";
import { PANEL, facePanels, inside, looseCorners, panelFacing, type Face, type LoosePanel, type Point } from "./roof-design";

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
let made = 0;
const id = () => `p${made++}`;

/** A face from an outline, looking north at 22°: its gutter is the north edge (the lowest y). */
const northFace = (points: Point[], extra: Partial<Area> = {}): Area => ({
  facing: 0,
  pitch: 22,
  covers: (p) => inside(p, points),
  outline: points,
  sun: 1,
  ...extra,
});

/** How far a point is from the nearest edge of an outline. */
function toEdge(p: Point, outline: Point[]) {
  let best = Infinity;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  });
  return best;
}
/** The panels' rows, gutter first (north face: by y, smallest first), as counts. */
const rowsOf = (panels: LoosePanel[]) => {
  const by = new Map<number, number>();
  for (const p of panels) by.set(Math.round(p.y * 10), (by.get(Math.round(p.y * 10)) ?? 0) + 1);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
};

describe("the edge clearance, for wind", () => {
  it("is twice the gap under the panel, or 200 mm, whichever is greater", () => {
    expect(clearanceFor(0.05)).toBe(EDGE_CLEARANCE);
    expect(clearanceFor(MOUNT_STANDOFF)).toBe(0.2);
    expect(clearanceFor(0.15)).toBeCloseTo(0.3, 9);
  });

  it("keeps every panel, as drawn, that far inside the face", () => {
    const outline = rect(-8, -3, 8, 3);
    const panels = packArea(northFace(outline), 30, PANEL, id);
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) for (const c of looseCorners(p, PANEL)) expect(toEdge(c, outline)).toBeGreaterThanOrEqual(0.2 - 1e-6);
    // A taller mount keeps them further in.
    const raised = packArea(northFace(outline, { standoff: 0.2 }), 30, PANEL, id);
    for (const p of raised) for (const c of looseCorners(p, PANEL)) expect(toEdge(c, outline)).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });
});

describe("rows from the gutter up, in a pyramid", () => {
  it("starts with the longest row along the gutter and never lengthens going up", () => {
    // A hip face: 14 m along the gutter (north edge), narrowing to 6 m at the ridge.
    const hip: Point[] = [
      { x: -7, y: -3 },
      { x: 7, y: -3 },
      { x: 3, y: 3 },
      { x: -3, y: 3 },
    ];
    const panels = packArea(northFace(hip), 40, PANEL, id);
    // Each row's length in metres, as drawn, gutter first (north face: the smallest y first). Portrait and landscape
    // rows may mix, so it is the length that never grows going up, not the count.
    const byRow = new Map<number, LoosePanel[]>();
    for (const p of panels) byRow.set(Math.round(p.y * 10), [...(byRow.get(Math.round(p.y * 10)) ?? []), p]);
    const lengths = [...byRow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => {
        const xs = row.flatMap((p) => looseCorners(p, PANEL).map((c) => c.x));
        return Math.max(...xs) - Math.min(...xs);
      });
    expect(lengths.length).toBeGreaterThan(1);
    lengths.forEach((l, i) => i > 0 && expect(l).toBeLessThanOrEqual(lengths[i - 1] + 0.01));
    expect(lengths[0]).toBe(Math.max(...lengths));
  });

  it("centres each row over the one below", () => {
    const panels = packArea(northFace(rect(-8, -3, 8, 3)), 11, PANEL, id);
    const rows = new Map<number, number[]>();
    for (const p of panels) rows.set(Math.round(p.y * 10), [...(rows.get(Math.round(p.y * 10)) ?? []), p.x]);
    const middles = [...rows.values()].map((xs) => (Math.min(...xs) + Math.max(...xs)) / 2);
    for (const m of middles) expect(m).toBeCloseTo(middles[0], 1);
  });

  it("never leaves a lone panel on a row: one moves down instead", () => {
    // Room for five a row: six is four and two, not five and one.
    const outline = rect(-3.3, -3, 3.3, 3);
    const rows = rowsOf(packArea(northFace(outline), 6, PANEL, id));
    expect(rows.every((n) => n >= 2)).toBe(true);
    expect(rows.reduce((t, n) => t + n, 0)).toBe(6);
  });

  it("lays portrait, and on their side only where portrait won't fit two", () => {
    expect(packArea(northFace(rect(-8, -3, 8, 3)), 20, PANEL, id).every((p) => !p.across)).toBe(true);
    // Too shallow for a portrait panel with the clearance, deep enough for one on its side.
    const shallow = packArea(northFace(rect(-8, -0.9, 8, 0.9)), 6, PANEL, id);
    expect(shallow.length).toBeGreaterThanOrEqual(2);
    expect(shallow.every((p) => p.across && panelFacing(p) === 0)).toBe(true);
  });
});

describe("arrays across a roof's faces", () => {
  const face = (facing: number, sun: number, outline: Point[]): Area => ({
    facing,
    pitch: 22,
    covers: (p) => inside(p, outline),
    outline,
    sun,
  });

  it("uses one face when one nearly as sunny as the best holds them all", () => {
    const north = face(0, 100, rect(-8, -3, 8, 3));
    const east = face(90, 97, rect(20, -8, 26, 8));
    const panels = packAreas([north, east], 10, PANEL, id);
    expect(new Set(panels.map((p) => p.angle)).size).toBe(1);
  });

  it("splits into at most two arrays, none of fewer than four, and leaves weak or steep faces alone", () => {
    const north = face(0, 100, rect(-4, -3, 4, 3));
    const east = face(90, 90, rect(20, -8, 26, 8));
    const south = face(180, 60, rect(-8, 20, 8, 26));
    const wall = { ...face(270, 100, rect(-30, -8, -24, 8)), pitch: 70 };
    const panels = packAreas([north, east, south, wall], 16, PANEL, id);
    const arrays = new Map<number, number>();
    for (const p of panels) arrays.set(panelFacing(p), (arrays.get(panelFacing(p)) ?? 0) + 1);
    expect(arrays.size).toBeLessThanOrEqual(2);
    expect(Math.min(...arrays.values())).toBeGreaterThanOrEqual(4);
    expect(arrays.has(180)).toBe(false);
    expect(arrays.has(270)).toBe(false);
  });
});

describe("traced faces", () => {
  const traced: Face = {
    id: "f",
    points: rect(-8, -2.5, 8, 2.5),
    angle: 0,
    landscape: false,
    setback: 0.3,
    facing: "N",
    tilt: 22,
    off: [],
  };

  it("are laid as panels placed by hand, the face's own grid switched off", () => {
    const { faces, loose } = packFaces([traced], PANEL, 12, id);
    expect(loose).toHaveLength(12);
    expect(facePanels(faces[0], PANEL)).toHaveLength(0);
    for (const p of loose) expect(inside(p, traced.points)).toBe(true);
  });

  it("can be laid again: a grid switched off whole by the first laying isn't taken for obstacles", () => {
    // 8 Nov 2026, 2 Hanwell Court: "fit 10 kW" a second time laid 0 panels, every place read as a vent.
    const once = packFaces([traced], PANEL, 6, id);
    const again = packFaces(once.faces, PANEL, 12, id);
    expect(again.loose).toHaveLength(12);
    // Mostly off (the face reshaped after it was laid) is the same; a few off are obstacles still.
    const places = facePanels({ ...traced, off: [] }, PANEL).length;
    const most = { ...traced, off: Array.from({ length: Math.ceil(places * 0.7) }, (_, i) => i) };
    expect(packFaces([most], PANEL, 12, id).loose).toHaveLength(12);
  });

  it("keep the face's own distance from its edges when it asks for more than the wind rule", () => {
    const wide = packArea(tracedArea({ ...traced, setback: 0.6 }), 30, PANEL, id);
    for (const p of wide) for (const c of looseCorners(p, PANEL)) expect(toEdge(c, traced.points)).toBeGreaterThanOrEqual(0.6 - 1e-6);
  });
});

describe("turning picked panels landscape or back", () => {
  // Two portrait rows on a north face (gutter to the north, the lowest y): 4 along the gutter, 2 above.
  const k = Math.cos((22 * Math.PI) / 180);
  const step = PANEL.short + PANEL.gap;
  const rowStep = PANEL.long * k + PANEL.gap;
  const at = (x: number, y: number, id: string): LoosePanel => ({ id, x, y, angle: 0, tilt: 22 });
  const panels = [
    ...[0, 1, 2, 3].map((i) => at((i - 1.5) * step, 0, `a${i}`)),
    ...[0, 1].map((i) => at((i - 0.5) * step, rowStep, `b${i}`)),
  ];

  it("lays them on their side, keeping each row, its count and its middle, and the gutter row's edge", () => {
    const turned = reorient(panels, PANEL, true);
    expect(turned.map((p) => p.id)).toEqual(panels.map((p) => p.id));
    expect(turned.every((p) => p.across && panelFacing(p) === 0 && p.tilt === 22)).toBe(true);
    const gutterEdge = (list: LoosePanel[]) => Math.min(...list.flatMap((p) => looseCorners(p, PANEL).map((c) => c.y)));
    expect(gutterEdge(turned)).toBeCloseTo(gutterEdge(panels), 1);
    const rows = rowsOf(turned);
    expect(rows).toEqual([4, 2]);
    // Side by side with no overlap: neighbours a whole long edge apart.
    const gutter = turned.filter((p) => p.id.startsWith("a")).map((p) => p.x);
    expect(gutter[1] - gutter[0]).toBeCloseTo(PANEL.long + PANEL.gap, 2);
    expect(gutter.reduce((t, x) => t + x, 0) / 4).toBeCloseTo(0, 2);
  });

  it("turns them back upright the same way", () => {
    const back = reorient(reorient(panels, PANEL, true), PANEL, false);
    expect(back.every((p) => !p.across && panelFacing(p) === 0)).toBe(true);
    back.forEach((p, i) => {
      expect(p.x).toBeCloseTo(panels[i].x, 1);
      expect(p.y).toBeCloseTo(panels[i].y, 1);
    });
  });
});

describe("a panel laid portrait or on its side, for Add a panel", () => {
  it("keeps the way it looks and only turns it a quarter", () => {
    const upright: LoosePanel = { id: "a", x: 1, y: 2, angle: 30, tilt: 22 };
    const side = laidAs(upright, true);
    expect(side.across).toBe(true);
    expect(panelFacing(side)).toBe(30);
    expect(side.angle).toBe(300);
    const back = laidAs(side, false);
    expect(back.across).toBeUndefined();
    expect(back.angle).toBe(30);
    expect(laidAs(upright, false)).toBe(upright);
  });
});

describe("panels laid in rows", () => {
  it("shares them out evenly, any extra by the gutter, the same panels where they stood", () => {
    expect(rowCounts(14, 2)).toEqual([7, 7]);
    expect(rowCounts(9, 2)).toEqual([5, 4]);
    expect(rowCounts(3, 5)).toEqual([1, 1, 1]);
    const column: LoosePanel[] = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, x: 0, y: i * 2, angle: 0 }));
    const laid = inRows(column, PANEL, 2);
    expect(laid.map((p) => p.id)).toEqual(column.map((p) => p.id));
    const rowsAt = new Set(laid.map((p) => p.y.toFixed(1)));
    expect(rowsAt.size).toBe(2);
    const mid = (ps: LoosePanel[], k: "x" | "y") => ps.reduce((t, p) => t + p[k], 0) / ps.length;
    expect(mid(laid, "x")).toBeCloseTo(mid(column, "x"), 1);
    expect(mid(laid, "y")).toBeCloseTo(mid(column, "y"), 1);
  });
});

describe("a face split by places to keep clear", () => {
  // 12 m wide, 16 m down, its gutter the north edge; existing panels across most of it 5 to 9 m from the gutter, a
  // narrow strip at the east end the only way past them, and a small clear corner beside the gutter.
  const outline = rect(0, 0, 12, 16);
  const existing = [rect(-1, 4, 10, 9), rect(4, -1, 13, 4)];
  const face = avoiding(northFace(outline), existing);

  it("finds each clear part on its own", () => {
    expect(regionsOf(face, PANEL).length).toBeGreaterThanOrEqual(2);
    expect(regionsOf(northFace(outline), PANEL)).toHaveLength(1);
  });

  it("lays panels on the clear roof past the existing ones, not only by the gutter", () => {
    const laid = packAreas([face], 20, PANEL, id);
    expect(laid.length).toBe(20);
    expect(laid.some((p) => p.y > 9)).toBe(true);
    for (const p of laid) for (const q of existing) expect(looseCorners(p, PANEL).some((c) => inside(c, q))).toBe(false);
  });
});

describe("a ragged gutter edge", () => {
  it("doesn't let a short first row cap the rows above it", () => {
    // 10 m along the gutter, 8 m up the slope, with a 3 m tab sticking out past the gutter, room for a short row.
    const plain = northFace(rect(0, 0, 10, 8));
    const tabbed = northFace([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: -2.2 },
      { x: 7, y: -2.2 },
      { x: 7, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ]);
    const full = packArea(plain, 60, PANEL, id).length;
    expect(packArea(tabbed, 60, PANEL, id).length).toBeGreaterThanOrEqual(full);
  });
});

describe("the less sunny faces, when the sunny ones are full", () => {
  it("lays the rest on a south face rather than stopping short", () => {
    const north = northFace(rect(0, 0, 6, 4), { sun: 1 });
    const south: Area = { ...northFace(rect(0, 10, 10, 18)), facing: 180, sun: 0.7 };
    const alone = packAreas([north], 30, PANEL, id).length;
    const both = packAreas([north, south], 30, PANEL, id);
    expect(both.length).toBeGreaterThan(alone);
    // A size the north face holds stays on it.
    expect(packAreas([north, south], alone, PANEL, id).every((p) => p.y < 5)).toBe(true);
  });
});
