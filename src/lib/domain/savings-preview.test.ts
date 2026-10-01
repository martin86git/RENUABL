import { describe, expect, it } from "vitest";
import { recommendSystem } from "./recommendation";
import { SAVINGS_PREVIEW, roundDownSavings, savingsPreview } from "./savings-preview";
import type { BillSummary } from "./bill";
import type { EnergyProfile, HomeAnalysis } from "./types";

const profile: EnergyProfile = { ev: false, evPlanned: false, wantsBattery: false, backup: false };
const analysis: HomeAnalysis = { storeys: "single", roof: "Colorbond", orientation: "North", maxPanels: 36 };

const bill: BillSummary = {
  retailer: "Test Energy",
  periodDays: 90,
  dailyUsageKwh: 20,
  annualUsageKwh: 7300,
  annualSource: "history",
  eveningShare: 0.6,
  usageRate: 0.3,
  feedInRate: 0.04,
  hasSolar: false,
  exportedDailyKwh: null,
};

describe("savings preview", () => {
  it("shows solar only and solar with a battery, rounded down to $50", () => {
    const rec = recommendSystem(profile, analysis, bill);
    const preview = savingsPreview(rec)!;
    expect(preview.bars.map((b) => b.label)).toEqual(["Solar only", "Solar and a battery"]);
    for (const b of preview.bars) expect(b.amount % 50).toBe(0);
    expect(preview.high).toBeGreaterThan(preview.low);
    expect(preview.low).toBeGreaterThan(0);
  });

  it("never overstates", () => {
    expect(roundDownSavings(1299)).toBe(1250);
    expect(roundDownSavings(-20)).toBe(0);
  });

  it("shows nothing without usage", () => {
    const rec = recommendSystem(profile, analysis, { ...bill, dailyUsageKwh: 0, annualUsageKwh: 0 });
    expect(savingsPreview(rec)).toBeNull();
  });

  it("says it's an estimate, never exact or guaranteed", () => {
    const text = Object.values(SAVINGS_PREVIEW).join(" ");
    expect(text).toMatch(/estimate/i);
    expect(text).not.toMatch(/exact|precise|guarantee/i);
  });
});
