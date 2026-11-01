import { describe, expect, it } from "vitest";
import { applySettle, settleToEdges, type RoofEdge } from "./edge-gravity";
import { looseCorners, PANEL, type LoosePanel } from "./roof-design";

// A face 10 m wide (x) and 6 m deep (y), its gutter along y = 3.
const face = [
  { x: -5, y: -3 },
  { x: 5, y: -3 },
  { x: 5, y: 3 },
  { x: -5, y: 3 },
];
const edges: RoofEdge[] = face.map((a, i) => ({ a, b: face[(i + 1) % 4], setback: 0.3, face }));

const row = (x: number, y: number, angle: number, n = 3): LoosePanel[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: x + i * (PANEL.short + PANEL.gap), y, angle }));

describe("panels settle against the roof's edges", () => {
  it("turns a group a few degrees off square, and pulls it in to the setback", () => {
    const group = row(-1, 1.6, 4);
    const s = settleToEdges(group, edges)!;
    expect(s).not.toBeNull();
    expect(s.turn).toBeCloseTo(-4, 6);
    const moved = applySettle(group, s);
    expect(moved.every((p) => Math.abs(p.angle % 90) < 1e-6 || Math.abs((p.angle % 90) - 90) < 1e-6)).toBe(true);
    const lowest = Math.max(...moved.flatMap((p) => looseCorners(p).map((c) => c.y)));
    expect(lowest).toBeCloseTo(3 - 0.3, 1);
  });

  it("centres a group that is nearly in the middle between the face's ends", () => {
    const group = row(-1.3, 1.6, 0);
    const moved = applySettle(group, settleToEdges(group, edges)!);
    const xs = moved.flatMap((p) => looseCorners(p).map((c) => c.x));
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 2);
  });

  it("leaves alone a group far from every edge, or well off square", () => {
    expect(settleToEdges(row(-1, -0.5, 0, 1), edges)).toBeNull();
    expect(settleToEdges(row(-1, 1.6, 25), edges)).toBeNull();
  });

  it("does nothing without edges to settle against", () => {
    expect(settleToEdges(row(0, 0, 0), [])).toBeNull();
  });
});
