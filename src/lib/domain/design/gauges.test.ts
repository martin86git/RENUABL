import { describe, expect, it } from "vitest";
import { dayShare, installPanel, newDealPanels, paceOf, paperworkPanel, tallyOrder } from "./gauges";

describe("the sun keeping time, and the tallies", () => {
  it("puts the sun at the day's share of the month, and reads ahead or behind it", () => {
    expect(dayShare(24, 31)).toBeCloseTo(0.774, 3);
    expect(paceOf(0.7, dayShare(24, 31))).toBe("behind");
    expect(paceOf(0.8, dayShare(24, 31))).toBe("ahead");
    expect(paceOf(1.2, 0.5)).toBe("reached");
  });

  it("tallies things done first, and lights installs and paperwork by what is done", () => {
    expect(tallyOrder(["todo", "done", "part", "done"])).toEqual(["done", "done", "part", "todo"]);
    expect([installPanel(true, true), installPanel(true, false), installPanel(false, false)]).toEqual(["done", "part", "todo"]);
    expect([paperworkPanel(3), paperworkPanel(1), paperworkPanel(0)]).toEqual(["done", "part", "todo"]);
  });

  it("shows this month's new deals as sold, proposed or still being worked", () => {
    const at = "2026-10-05T00:00:00Z";
    const jobs = [
      { stage: "won", createdAt: at },
      { stage: "proposal", createdAt: at },
      { stage: "lead", createdAt: at },
      { stage: "lost", createdAt: at },
      { stage: "won", createdAt: "2026-09-05T00:00:00Z" },
    ];
    expect(newDealPanels(jobs, "2026-10-24", ["won"])).toEqual(["done", "part", "todo"]);
  });
});
