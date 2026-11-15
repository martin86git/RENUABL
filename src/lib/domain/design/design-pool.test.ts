import { describe, expect, it } from "vitest";
import { DESIGNS_PER_USER, FIRST_MONTH_DESIGNS, PLAN_WORDS, designPool, designPoolWords, designsIncluded } from "./plans";

describe("the pooled design jobs", () => {
  const settled = { status: "active", seats: 3, startedAt: "2026-08-01" };
  it("gives each paid user's share to one pool for the business", () => {
    expect(designsIncluded(settled, "2026-11-15")).toBe(DESIGNS_PER_USER * 3);
    expect(designsIncluded({ ...settled, status: "past_due" }, "2026-11-15")).toBe(90);
    expect(designsIncluded({ ...settled, status: "canceled" }, "2026-11-15")).toBe(0);
    expect(designsIncluded(null, "2026-11-15")).toBe(0);
  });
  it("holds the first month's larger pool for 31 days, never less than the users bring", () => {
    expect(designsIncluded({ ...settled, startedAt: "2026-11-01" }, "2026-11-15")).toBe(FIRST_MONTH_DESIGNS);
    expect(designsIncluded({ ...settled, startedAt: "2026-10-16" }, "2026-11-15")).toBe(FIRST_MONTH_DESIGNS);
    expect(designsIncluded({ ...settled, startedAt: "2026-10-15" }, "2026-11-15")).toBe(90);
    expect(designsIncluded({ status: "active", seats: 8, startedAt: "2026-11-10" }, "2026-11-15")).toBe(240);
  });
  it("never goes below nothing left, and says it is shared", () => {
    expect(designPool(90, 95)).toEqual({ included: 90, used: 95, left: 0 });
    expect(designPoolWords(designPool(90, 12))).toBe("12 of 90 used this month · shared by everyone in the business");
    expect(PLAN_WORDS.firstMonthDesigns).not.toMatch(/unlimited/i);
  });
});
