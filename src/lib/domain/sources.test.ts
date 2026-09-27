import { describe, expect, it } from "vitest";
import type { BillSummary } from "./bill";
import { VERIFIED_RATES } from "./rebates";
import { SOURCES_FOOTNOTE, dataSources } from "./sources";

const bill: BillSummary = {
  retailer: "Test",
  periodDays: 90,
  dailyUsageKwh: 20,
  annualUsageKwh: 7300,
  annualSource: "period",
  eveningShare: 0.4,
  usageRate: 0.3,
  feedInRate: 0.05,
  hasSolar: false,
  exportedDailyKwh: null,
};
const vic = { line: "2 Hanwell Court", suburb: "Glen Waverley", state: "VIC", postcode: "3150", lat: -37.88, lng: 145.16, placeId: "p1" };
const sunshine = { annual: 4.43, monthly: Array(12).fill(4.43), lat: -37.88, lng: 145.16, source: "NASA POWER" as const };

describe("data sources", () => {
  it("names every source used for a Victorian home with a new system", () => {
    const ids = dataSources({ bill, address: vic, sunshine, rates: VERIFIED_RATES, newSolar: true, today: "2026-09-27" }).map((s) => s.id);
    expect(ids).toEqual(["bill", "google", "nasa", "cer", "solar-vic", "supplier"]);
  });

  it("only credits NASA and Google when their data was actually used", () => {
    const ids = dataSources({
      bill: { ...bill, sample: true },
      address: { ...vic, placeId: undefined },
      sunshine: null,
      rates: VERIFIED_RATES,
      newSolar: true,
      today: "2026-09-27",
    }).map((s) => s.id);
    expect(ids).not.toContain("nasa");
    expect(ids).not.toContain("google");
    expect(ids).not.toContain("bill");
    expect(ids).toContain("sunshine-typical");
  });

  it("leaves out Solar Victoria for expansions and outside Victoria", () => {
    const base = { bill, sunshine, rates: VERIFIED_RATES, today: "2026-09-27" };
    expect(dataSources({ ...base, address: vic, newSolar: false }).map((s) => s.id)).not.toContain("solar-vic");
    expect(dataSources({ ...base, address: { ...vic, state: "NSW" }, newSolar: true }).map((s) => s.id)).not.toContain("solar-vic");
  });

  it("says when the rebate rules were checked", () => {
    const cer = (rates = VERIFIED_RATES) =>
      dataSources({ bill, address: vic, sunshine, rates, newSolar: true, today: "2026-09-27" }).find((s) => s.id === "cer")!.detail;
    expect(cer({ ...VERIFIED_RATES, source: "live" })).toContain("checked today");
    expect(cer({ ...VERIFIED_RATES, asOf: "2026-09-20" })).toContain("checked 20 September 2026");
  });

  it("never claims exactness", () => {
    const all = dataSources({ bill, address: vic, sunshine, rates: VERIFIED_RATES, newSolar: true, today: "2026-09-27" });
    const text = [...all.flatMap((s) => [s.name, s.detail]), SOURCES_FOOTNOTE].join(" ").toLowerCase();
    expect(text).not.toMatch(/\bexact|guarantee|precise/);
  });
});
