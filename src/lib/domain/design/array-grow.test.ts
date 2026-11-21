import { describe, expect, it } from "vitest";
import { arrayFrame, growArray, growCount, growHandles } from "./array-grow";
import { PANEL, planSize, type LoosePanel } from "./roof-design";

const tilt = 0;
const plan = planSize({ tilt }, PANEL);
const stepX = plan.w + PANEL.gap;
const stepY = plan.h + PANEL.gap;
/** A row of `n` panels at an angle, from the origin. */
const row = (n: number, angle = 0): LoosePanel[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    x: i * stepX * Math.cos((angle * Math.PI) / 180),
    y: i * stepX * Math.sin((angle * Math.PI) / 180),
    angle,
    tilt,
  }));

describe("the grid a picked group lies on", () => {
  it("reads a row as one row of so many columns", () => {
    const f = arrayFrame(row(4), PANEL);
    expect(f && [f.iMin, f.iMax, f.jMin, f.jMax]).toEqual([0, 3, 0, 0]);
  });

  it("reads a turned row the same", () => {
    const f = arrayFrame(row(3, 25), PANEL);
    expect(f && [f.iMax, f.jMax]).toEqual([2, 0]);
  });

  it("is none for panels that aren't on one grid", () => {
    expect(arrayFrame([...row(2), { id: "x", x: 0.4, y: 3, angle: 0, tilt }], PANEL)).toBeNull();
    expect(arrayFrame([...row(2), { id: "x", x: 0, y: stepY, angle: 10, tilt }], PANEL)).toBeNull();
    expect(arrayFrame([], PANEL)).toBeNull();
  });
});

describe("growing an array from a side", () => {
  const group = row(4);
  const f = arrayFrame(group, PANEL)!;
  const handle = (side: string) => growHandles(f, 0.3).find((h) => h.side === side)!.at;

  it("puts a handle out from the middle of each side", () => {
    expect(handle("bottom").x).toBeCloseTo(1.5 * stepX);
    expect(handle("bottom").y).toBeCloseTo(plan.h / 2 + 0.3);
    expect(handle("left").x).toBeCloseTo(-plan.w / 2 - 0.3);
  });

  it("counts a row for each step the handle is pulled out", () => {
    const from = handle("bottom");
    expect(growCount(f, "bottom", from, { x: from.x + 2, y: from.y + stepY * 2.1 })).toBe(2);
    expect(growCount(f, "top", from, { x: from.x, y: from.y - stepY })).toBe(1);
  });

  it("never takes the last row or column away", () => {
    const from = handle("right");
    expect(growCount(f, "right", from, { x: from.x - 30, y: from.y })).toBe(-3);
    expect(growCount(f, "bottom", handle("bottom"), { x: 0, y: -30 })).toBe(0);
  });

  it("copies the row on that side", () => {
    const grown = growArray(group, f, "bottom", 2, "s");
    expect(grown).toHaveLength(12);
    expect(grown.filter((p) => Math.abs(p.y - 2 * stepY) < 0.02)).toHaveLength(4);
    expect(new Set(grown.map((p) => p.id)).size).toBe(12);
    // The same drag makes the same panels.
    expect(growArray(group, f, "bottom", 2, "s").map((p) => p.id)).toEqual(grown.map((p) => p.id));
  });

  it("adds columns on an end, and takes them away again", () => {
    expect(growArray(group, f, "left", 1, "s").some((p) => Math.abs(p.x + stepX) < 0.02)).toBe(true);
    expect(growArray(group, f, "right", -2, "s").map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(growArray(group, f, "left", -1, "s").map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("grows a turned array along its own lines", () => {
    const turned = row(3, 30);
    const tf = arrayFrame(turned, PANEL)!;
    const grown = growArray(turned, tf, "bottom", 1, "s");
    const added = grown[3];
    expect(added.x).toBeCloseTo(-stepY * Math.sin(Math.PI / 6), 1);
    expect(added.y).toBeCloseTo(stepY * Math.cos(Math.PI / 6), 1);
    expect(added.angle).toBe(30);
  });
});
