import { describe, expect, it } from "vitest";
import { pivotDrag, type PivotState } from "./array-pivot";
import { settleToEdges } from "./edge-gravity";
import type { LoosePanel } from "./roof-design";

const anchor = { x: 0, y: 0, angle: 0 };
const steps = { x: 1.15, y: 1.8 };
const at = (d: number, deg: number) => ({ x: d * Math.cos((deg * Math.PI) / 180), y: d * Math.sin((deg * Math.PI) / 180) });

describe("an array pivoting as it is dragged out", () => {
  it("leaves a panel that has barely been dragged as it was put down", () => {
    expect(pivotDrag(anchor, { x: 0.3, y: 0.2 }, steps, null)).toEqual({ angle: 0, state: null });
  });

  it("runs the row towards the pointer", () => {
    const out = pivotDrag(anchor, at(5, 17), steps, null);
    expect(out.angle).toBeCloseTo(17);
    expect(out.state?.n).toBe(4);
  });

  it("faces the same way whichever end the row is dragged from", () => {
    expect(pivotDrag(anchor, at(5, 197), steps, null).angle).toBeCloseTo(17);
    expect(pivotDrag(anchor, at(5, -20), steps, null).angle).toBeCloseTo(340);
  });

  it("keeps turning as the row grows", () => {
    let state: PivotState | null = null;
    let angle = 0;
    for (const [d, deg] of [
      [2, 10],
      [4, 14],
      [6, 17],
      [8, 19],
    ]) {
      ({ angle, state } = pivotDrag(anchor, at(d, deg), steps, state));
    }
    expect(angle).toBeCloseTo(19);
  });

  it("holds its direction and leaves the pointer free to add rows once pulled sideways", () => {
    const first = pivotDrag(anchor, at(6, 10), steps, null);
    // Two rows down from the end of a row held at 10 degrees.
    const end = at(6, 10);
    const down = { x: end.x - 2 * Math.sin((10 * Math.PI) / 180), y: end.y + 2 * Math.cos((10 * Math.PI) / 180) };
    const out = pivotDrag(anchor, down, steps, first.state);
    expect(out.angle).toBeCloseTo(10);
    expect(out.state).toEqual(first.state);
  });

  it("clicks square to a panel or roof line it comes within a few degrees of", () => {
    expect(pivotDrag(anchor, at(5, 15), steps, null, [12]).angle).toBeCloseTo(12);
    // A line square to the row counts too.
    expect(pivotDrag(anchor, at(5, 15), steps, null, [103]).angle).toBeCloseTo(13);
    expect(pivotDrag(anchor, at(5, 15), steps, null, [30]).angle).toBeCloseTo(15);
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
