import { describe, expect, it } from "vitest";
import { lineOf } from "./array-line";

/** A panel 1.7 wide and 1.1 tall (landscape) with its top left at x, y. */
const panel = (x: number, y: number, w = 1.7, h = 1.1) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe("lineOf", () => {
  // Two columns of ten landscape panels side by side, as in Martin's screenshot of 24 Nov 2026.
  const columns = [
    ...Array.from({ length: 10 }, (_, i) => panel(0, i * 1.12)),
    ...Array.from({ length: 10 }, (_, i) => panel(1.72, i * 1.12 - 0.4)),
  ];

  it("picks the column a panel is in, not the column beside it", () => {
    const line = lineOf(columns, 0, 0.25)!;
    expect(line.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("picks the other column from one of its panels", () => {
    expect(lineOf(columns, 14, 0.25)!.sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("picks a row when the row is the longer line", () => {
    const row = Array.from({ length: 6 }, (_, i) => panel(i * 1.12, 0, 1.1, 1.7));
    const withOneAbove = [...row, panel(0, -1.72, 1.1, 1.7)];
    expect(lineOf(withOneAbove, 0, 0.25)!.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("stops at a gap", () => {
    const broken = [panel(0, 0), panel(0, 1.12), panel(0, 4)];
    expect(lineOf(broken, 0, 0.25)!.sort()).toEqual([0, 1]);
  });

  it("is nothing for a panel on its own", () => {
    expect(lineOf([panel(0, 0), panel(5, 5)], 0, 0.25)).toBeNull();
  });
});
