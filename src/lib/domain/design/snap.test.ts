import { describe, expect, it } from "vitest";
import { PANEL, type LoosePanel } from "./roof-design";
import { SNAP_REACH, snapShift } from "./snap";

// Laid flat (tilt 0) so sizes from above are the panel's own: 1.134 wide, 1.762 long, 2 cm apart.
const at = (x: number, y: number, id: string, extra: Partial<LoosePanel> = {}): LoosePanel => ({ id, x, y, angle: 0, tilt: 0, ...extra });
const row = (y: number, n: number, prefix: string, extra: Partial<LoosePanel> = {}) =>
  Array.from({ length: n }, (_, i) => at((i - (n - 1) / 2) * (PANEL.short + PANEL.gap), y, `${prefix}${i}`, extra));
const flush = PANEL.long + PANEL.gap;

describe("panels clicking into place", () => {
  const below = row(0, 4, "b");

  it("brings a row laid a little off flush against the row below, lined up with it", () => {
    // Above the row (smaller y), 15 cm too far and 10 cm to one side.
    const moving = row(-flush - 0.15, 4, "m").map((p) => ({ ...p, x: p.x + 0.1 }));
    const shift = snapShift(moving, below, PANEL)!;
    expect(shift.y).toBeCloseTo(0.15, 2);
    expect(shift.x).toBeCloseTo(-0.1, 2);
  });

  it("closes a gap or an overlap alike", () => {
    expect(snapShift(row(-flush + 0.2, 4, "m"), below, PANEL)!.y).toBeCloseTo(-0.2, 2);
    expect(snapShift(row(-flush - 0.2, 4, "m"), below, PANEL)!.y).toBeCloseTo(0.2, 2);
  });

  it("brings a panel side by side, its edge to the next one's", () => {
    // The row's last panel is at 1.5 steps; the next place is 2.5 steps out. This one is 20 cm past it.
    const moving = [at(2.5 * (PANEL.short + PANEL.gap) + 0.2, 0.05, "m")];
    const shift = snapShift(moving, below, PANEL)!;
    expect(shift.x).toBeCloseTo(-0.2, 2);
    expect(shift.y).toBeCloseTo(-0.05, 2);
  });

  it("lines a landscape row up flush above a portrait one", () => {
    const sideways = { angle: 270, across: true };
    const moving = row(-(PANEL.long / 2 + PANEL.short / 2 + PANEL.gap) - 0.1, 2, "m", sideways).map((p, i) => ({
      ...p,
      x: (i - 0.5) * (PANEL.long + PANEL.gap),
    }));
    const shift = snapShift(moving, below, PANEL)!;
    expect(shift.y).toBeCloseTo(0.1, 2);
  });

  it("leaves panels alone that are too far off, turned another way, or would land on another", () => {
    expect(snapShift(row(-flush - SNAP_REACH - 0.1, 4, "m"), below, PANEL)).toBeNull();
    expect(snapShift(row(-flush - 0.1, 4, "m", { angle: 20 }), below, PANEL)).toBeNull();
    expect(snapShift([at(0.05, 0.05, "m")], below, PANEL)).toBeNull();
  });
});
