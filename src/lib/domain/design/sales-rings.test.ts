import { describe, expect, it } from "vitest";
import type { DashJob } from "./deal";
import { NO_TARGETS, cleanTargets, monthPace, monthRings, monthlyHistory, pipelineByStage } from "./sales-rings";

const won = (wonAt: string, value: number, kw: number): DashJob => ({
  stage: "won",
  value,
  kw,
  wonAt,
  createdAt: wonAt,
  installedAt: null,
  installDate: null,
});
const today = "2026-10-24";
const jobs: DashJob[] = [
  won("2026-07-10T02:00:00Z", 10000, 6),
  won("2026-08-10T02:00:00Z", 12000, 8),
  won("2026-08-20T02:00:00Z", 8000, 5),
  won("2026-09-05T02:00:00Z", 11000, 7),
  won("2026-10-03T02:00:00Z", 15000, 9.5),
  { ...won("2026-10-04T02:00:00Z", 9000, 5), stage: "lost", wonAt: null },
  { stage: "proposal", value: 14000, kw: 7, wonAt: null, createdAt: "2026-10-01T00:00:00Z", installedAt: null, installDate: null },
  { stage: "lead", value: null, kw: null, wonAt: null, createdAt: "2026-10-02T00:00:00Z", installedAt: null, installDate: null },
];

describe("the month's sales as rings", () => {
  it("adds up the last six months by the month each deal was won, this month last", () => {
    const h = monthlyHistory(jobs, today);
    expect(h.map((m) => m.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(h.map((m) => m.sales)).toEqual([0, 0, 10000, 20000, 11000, 15000]);
    expect(h[3]).toMatchObject({ deals: 2, kw: 13 });
  });

  it("closes each ring at the business's target, else its own average of the three months before", () => {
    const h = monthlyHistory(jobs, today);
    const [sales, deals, kw] = monthRings(h, NO_TARGETS);
    // Jul–Sep average $13,667 → a goal of $14,000; the month's $15,000 laps it.
    expect(sales).toMatchObject({ value: 15000, goal: 14000, basis: "average" });
    expect(sales.share).toBeCloseTo(15000 / 14000);
    expect(deals).toMatchObject({ value: 1, goal: 2, basis: "average" });
    // 6, 13 and 7 kW average 8.67 → 9.
    expect(kw.goal).toBe(9);
    const set = monthRings(h, { sales: 30000, deals: null, kw: 20 });
    expect(set[0]).toMatchObject({ goal: 30000, basis: "target", share: 0.5 });
    expect(set[1].basis).toBe("average");
  });

  it("has nothing to aim at for a business with no target and no months behind it", () => {
    const [sales] = monthRings(monthlyHistory([won("2026-10-03T02:00:00Z", 5000, 3)], today), NO_TARGETS);
    expect(sales).toMatchObject({ goal: null, basis: "none", share: 0 });
  });

  it("says where the month is heading, and splits the open pipeline by stage", () => {
    expect(monthPace(15000, today)).toEqual({ day: 24, days: 31, projected: 19375 });
    expect(pipelineByStage(jobs)).toEqual([
      { stage: "lead", deals: 1, value: 0 },
      { stage: "designed", deals: 0, value: 0 },
      { stage: "proposal", deals: 1, value: 14000 },
    ]);
  });

  it("keeps only sensible targets", () => {
    expect(cleanTargets({ sales: "$40,000", deals: 6, kw: "-3" })).toEqual({ sales: 40000, deals: 6, kw: null });
  });
});
