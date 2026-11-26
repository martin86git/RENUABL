import { describe, expect, it } from "vitest";
import { panelCounter } from "./sol-guide";

describe("the panel counter in the dock", () => {
  it("says the panels and their kW with no target", () => {
    expect(panelCounter(21, 0, 475, null)).toEqual({ panels: 21, kw: "9.98", line: null, state: "none" });
  });

  it("counts a row being dragged out", () => {
    expect(panelCounter(10, 4, 475, null).panels).toBe(14);
  });

  it("says how many are still to go to the target", () => {
    // 13 kW of 475 W panels is 28 panels.
    expect(panelCounter(21, 0, 475, { kw: 13, kwh: 0 })).toMatchObject({ line: "7 to go to 13 kW", state: "short" });
  });

  it("says when the target is reached, and how far past it", () => {
    expect(panelCounter(28, 0, 475, { kw: 13, kwh: 0 }).state).toBe("on");
    expect(panelCounter(30, 0, 475, { kw: 13, kwh: 0 })).toMatchObject({ line: "2 over the 13 kW target", state: "over" });
  });
});
