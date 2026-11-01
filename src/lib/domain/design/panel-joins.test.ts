import { describe, expect, it } from "vitest";
import {
  PANEL,
  facingLike,
  flushGhostAt,
  flushSpots,
  fromPanelFrame,
  looseCorners,
  panelFacing,
  panelsOverlap,
  squareTurn,
  toPanelFrame,
  type LoosePanel,
} from "./roof-design";

const flat = { tilt: 0 };

describe("panels joining each other", () => {
  it("tells panels the same way round from a quarter turn apart", () => {
    expect(squareTurn({ angle: 10 }, { angle: 190 })).toBe(0);
    expect(squareTurn({ angle: 10 }, { angle: 101 })).toBe(90);
    expect(squareTurn({ angle: 10 }, { angle: 40 })).toBeNull();
  });
  it("turns a panel to face like its neighbour without moving its long edge", () => {
    // Turned on its side with the 90° button: upright arrow at 90. Clicked onto a portrait array facing 0.
    const was = { angle: 90 };
    const now = facingLike(was, 0)!;
    expect(panelFacing(now)).toBe(0);
    expect(now.across).toBe(true);
    expect(squareTurn(now, was)).toBe(0);
    expect(facingLike({ angle: 180 }, 0)).toEqual({ angle: 0, across: false });
    expect(facingLike({ angle: 45 }, 0)).toBeNull();
  });
  it("puts a landscape panel flush beside a portrait one, with no overlap", () => {
    const from: LoosePanel = { id: "a", x: 0, y: 0, angle: 0, ...flat };
    const spots = flushSpots(from, { across: true, ...flat });
    expect(spots.length).toBeGreaterThan(0);
    for (const spot of spots) {
      const at = fromPanelFrame(from, spot);
      const mover: LoosePanel = { id: "b", x: at.x, y: at.y, angle: 270, across: true, ...flat };
      expect(panelsOverlap(from, mover)).toBe(false);
    }
    // Beside its long side: the gap apart, centred.
    const beside = spots.find((p) => p.y === 0 && p.x > 0)!;
    expect(beside.x).toBeCloseTo(PANEL.short / 2 + PANEL.long / 2 + PANEL.gap, 6);
  });
  it("offers the corners only when both lie the same way", () => {
    const from = { across: false, ...flat };
    const corner = (p: { x: number; y: number }) => Math.abs(p.x) > 1 && Math.abs(p.y) > 1;
    expect(flushSpots(from, { across: false, ...flat }).filter(corner)).toHaveLength(4);
    expect(flushSpots(from, { across: true, ...flat }).filter(corner)).toHaveLength(0);
  });
  it("reads points into and out of a panel's frame", () => {
    const panel = { x: 2, y: 3, angle: 30 };
    const p = fromPanelFrame(panel, { x: 1, y: -0.5 });
    const back = toPanelFrame(panel, p);
    expect(back.x).toBeCloseTo(1, 9);
    expect(back.y).toBeCloseTo(-0.5, 9);
  });
  it("finds overlapping panels, but not ones a gap apart", () => {
    const a: LoosePanel = { id: "a", x: 0, y: 0, angle: 0, ...flat };
    expect(panelsOverlap(a, { ...a, id: "b", x: 0.5 })).toBe(true);
    expect(panelsOverlap(a, { ...a, id: "b", x: PANEL.short + PANEL.gap })).toBe(false);
    expect(looseCorners(a)).toHaveLength(4);
  });
});

describe("a new panel clicking against one laid the other way", () => {
  const portrait: LoosePanel = { id: "a", x: 0, y: 0, angle: 0, tilt: 0 };
  it("puts a landscape outline flush beside a portrait panel, facing its way, with the shared edge", () => {
    const near = { x: 1.5, y: 0 };
    const out = flushGhostAt(near, [portrait], true)!;
    expect(out).not.toBeNull();
    expect(out.ghost.across).toBe(true);
    expect(panelFacing(out.ghost)).toBe(panelFacing(portrait));
    expect(out.ghost.x).toBeCloseTo(PANEL.short / 2 + PANEL.long / 2 + PANEL.gap, 2);
    expect(panelsOverlap(out.ghost, portrait)).toBe(false);
    expect(out.join[0].x).toBeCloseTo(PANEL.short / 2 + PANEL.gap / 2, 6);
  });
  it("leaves panels laid the same way, and the pointer far off, alone", () => {
    expect(flushGhostAt({ x: 1.2, y: 0 }, [portrait], false)).toBeNull();
    expect(flushGhostAt({ x: 6, y: 0 }, [portrait], true)).toBeNull();
  });
  it("never puts one on top of another panel", () => {
    const blocker: LoosePanel = { id: "b", x: PANEL.short / 2 + PANEL.long / 2 + PANEL.gap, y: 0, angle: 270, across: true, tilt: 0 };
    const out = flushGhostAt({ x: 1.5, y: 0 }, [portrait, blocker], true);
    expect(out === null || !panelsOverlap(out.ghost, blocker)).toBe(true);
  });
});
