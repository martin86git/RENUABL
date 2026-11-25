import { describe, expect, it } from "vitest";
import { pivotDrag, TOUCH_PIVOT, type PivotState } from "./array-pivot";
import { settleToEdges } from "./edge-gravity";
import type { LoosePanel } from "./roof-design";

const anchor = { x: 0, y: 0, angle: 0 };
const step = 1.15;
const at = (d: number, deg: number) => ({ x: d * Math.cos((deg * Math.PI) / 180), y: d * Math.sin((deg * Math.PI) / 180) });

describe("a row dragged out from the first panel", () => {
  it("leaves a panel that has barely been dragged as it was put down", () => {
    expect(pivotDrag(anchor, { x: 0.3, y: 0.2 }, step, null)).toEqual({ angle: 0, state: null });
  });

  it("adds panels without turning when pulled sideways, the way the panel faces", () => {
    expect(pivotDrag(anchor, at(2, 12), step, null)).toEqual({ angle: 0, state: { mode: "row" } });
    expect(pivotDrag(anchor, at(2, 192), step, null)).toEqual({ angle: 0, state: { mode: "row" } });
    expect(pivotDrag({ ...anchor, angle: 30 }, at(2, 40), step, null).state).toEqual({ mode: "row" });
  });

  it("starts to pivot as soon as the pointer leaves the row's line, however the drag began", () => {
    const begun = pivotDrag(anchor, at(1, 5), step, null);
    expect(begun.state).toEqual({ mode: "row" });
    const swung = pivotDrag(anchor, at(6, 20), step, begun.state);
    expect(swung.state?.mode).toBe("pivot");
    expect(swung.angle).toBeCloseTo(20);
    // And goes on pivoting when it comes back near the line (it clicks back square within a few degrees).
    expect(pivotDrag(anchor, at(6, 8), step, swung.state).angle).toBeCloseTo(8);
  });

  it("turns the way the panel faces with the pointer, all the way round", () => {
    let state: PivotState | null = null;
    let angle = 0;
    for (let deg = 20; deg <= 180; deg += 10) ({ angle, state } = pivotDrag(anchor, at(4, deg), step, state));
    // Swung half way round from north it faces south.
    expect(angle).toBeCloseTo(180);
    for (let deg = 190; deg <= 270; deg += 10) ({ angle, state } = pivotDrag(anchor, at(4, deg), step, state));
    expect(angle).toBeCloseTo(270);
  });

  it("pivots towards the pointer when pulled any other way", () => {
    const out = pivotDrag(anchor, at(2, 35), step, null);
    expect(out.state?.mode).toBe("pivot");
    expect(out.angle).toBeCloseTo(35);
  });

  it("keeps turning with the pointer while it pivots", () => {
    let state: PivotState | null = null;
    let angle = 0;
    for (const [d, deg] of [
      [1, 40],
      [3, 33],
      [6, 27],
    ]) {
      ({ angle, state } = pivotDrag(anchor, at(d, deg), step, state));
    }
    expect(angle).toBeCloseTo(27);
  });

  it("faces the same way whichever end the row is pulled from", () => {
    expect(pivotDrag(anchor, at(5, 215), step, null).angle).toBeCloseTo(35);
    expect(pivotDrag(anchor, at(5, -40), step, null).angle).toBeCloseTo(320);
  });

  it("clicks square to a panel or roof line it comes within a few degrees of, pivoting", () => {
    expect(pivotDrag(anchor, at(5, 35), step, null, [32]).angle).toBeCloseTo(32);
    // A line square to the row counts too.
    expect(pivotDrag(anchor, at(5, 35), step, null, [123]).angle).toBeCloseTo(33);
    expect(pivotDrag(anchor, at(5, 35), step, null, [50]).angle).toBeCloseTo(35);
    // And the way it was put down, when the pointer swings back to it.
    expect(pivotDrag(anchor, at(5, 3), step, { mode: "pivot", angle: 6 }).angle).toBeCloseTo(0);
  });
});

describe("panels settling against a side traced a little off its face's rows", () => {
  const panel: LoosePanel = { id: "a", x: 5, y: 1.4, angle: 2, tilt: 0 };
  // The side runs 3 degrees off east-west; the face's rows run true.
  const b = { x: 10, y: 10 * Math.tan((3 * Math.PI) / 180) };
  const face = [{ x: 0, y: 0 }, b, { x: 10, y: 8 }, { x: 0, y: 8 }];

  it("squares them to the rows, not to the side as drawn", () => {
    const settle = settleToEdges([panel], [{ a: face[0], b, setback: 0.2, face, rows: 0 }]);
    expect(settle?.turn).toBeCloseTo(-2);
  });

  it("squares them to the side when it has no rows to go by", () => {
    const settle = settleToEdges([panel], [{ a: face[0], b, setback: 0.2 }]);
    expect(settle?.turn).toBeCloseTo(1);
  });
});

describe("a row dragged out with a finger", () => {
  it("lets the finger wander further along the row before it pivots", () => {
    expect(pivotDrag(anchor, at(2, 18), step, null, [], TOUCH_PIVOT).state).toEqual({ mode: "row" });
    expect(pivotDrag(anchor, at(2, 18), step, null).state?.mode).toBe("pivot");
  });

  it("holds a pivot still for a small wobble and near the first panel", () => {
    const swung = pivotDrag(anchor, at(6, 40), step, null, [], TOUCH_PIVOT);
    expect(swung.angle).toBeCloseTo(40);
    expect(pivotDrag(anchor, at(6, 42), step, swung.state, [], TOUCH_PIVOT).angle).toBeCloseTo(40);
    expect(pivotDrag(anchor, at(1.5, 70), step, swung.state, [], TOUCH_PIVOT).angle).toBeCloseTo(40);
    expect(pivotDrag(anchor, at(6, 50), step, swung.state, [], TOUCH_PIVOT).angle).toBeCloseTo(50);
  });
});
