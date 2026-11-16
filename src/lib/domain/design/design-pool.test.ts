import { describe, expect, it } from "vitest";
import { PLAN_WORDS, TRIAL_SITES, designPool, designPoolWords, designsIncluded } from "./plans";

describe("the free trial sites", () => {
  const plan = { status: "active", seats: 3, startedAt: "2026-11-01" };
  it("gives each account 6 sites in its first month, whatever its users, and none after", () => {
    expect(TRIAL_SITES).toBe(6);
    expect(designsIncluded(plan, "2026-11-15")).toBe(6);
    expect(designsIncluded({ ...plan, seats: 12 }, "2026-11-15")).toBe(6);
    expect(designsIncluded(plan, "2026-12-02")).toBe(0);
    expect(designsIncluded({ ...plan, status: "canceled" }, "2026-11-15")).toBe(0);
    expect(designsIncluded(null, "2026-11-15")).toBe(0);
  });
  it("says it is shared, and never says unlimited", () => {
    expect(designPool(6, 8)).toEqual({ included: 6, used: 8, left: 0 });
    expect(designPoolWords(designPool(6, 2))).toBe("2 of 6 free trial sites used · shared by everyone in the business");
    expect(PLAN_WORDS.trialSites).toBe("6 free sites in your first month");
    for (const w of Object.values(PLAN_WORDS)) expect(w.toLowerCase()).not.toContain("unlimited");
  });
});
