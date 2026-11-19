import { describe, expect, it } from "vitest";
import { SUN_FROM, SUN_TO, chartColours, dayOf, monthlyUse, paybackRun, readoutWords, yearFacts } from "./proposal-charts";

const kwh = [1000, 950, 930, 700, 520, 420, 450, 560, 700, 880, 980, 990];
const theme = { primary: "#111111", accent: "#c2410c" };

describe("the proposal's charts", () => {
  it("are drawn in the sun, the business's colours, or two of its own", () => {
    expect(chartColours({ ...theme })).toEqual({ from: SUN_FROM, to: SUN_TO });
    expect(chartColours({ ...theme, chartTone: "brand" })).toEqual({ from: "#111111", to: "#c2410c" });
    expect(chartColours({ ...theme, chartTone: "own", chartFrom: "#0000ff", chartTo: "#00ffff" })).toEqual({
      from: "#0000ff",
      to: "#00ffff",
    });
    // Two of its own, one of them not a colour: the sun.
    expect(chartColours({ ...theme, chartTone: "own", chartFrom: "blue", chartTo: "#00ffff" })).toEqual({ from: SUN_FROM, to: SUN_TO });
  });

  it("set the home's use month by month from the bill's daily use, the same every day", () => {
    const use = monthlyUse(20);
    expect(use[0]).toBe(620);
    expect(use[1]).toBe(560);
    expect(use.reduce((a, b) => a + b, 0)).toBe(7300);
  });

  it("read out the year, a month, and a month against the home's use", () => {
    expect(readoutWords({ kwh, month: null, use: null })).toBe("About 25 kWh on an average day.");
    expect(readoutWords({ kwh, month: 0, use: null })).toBe("About 32 kWh a day.");
    const use = monthlyUse(20);
    expect(readoutWords({ kwh, month: 0, use })).toMatch(/^About 380 kWh more than the home uses/);
    expect(readoutWords({ kwh, month: 5, use })).toMatch(/^About 180 kWh less than the home uses/);
  });

  it("find the sunniest and darkest months", () => {
    expect(yearFacts(kwh)).toEqual({ best: 0, worst: 5, dayKwh: 25 });
    expect(dayOf(kwh, 5)).toBe(14);
  });

  it("run the payback across at least ten years, with room past it", () => {
    expect(paybackRun(null)).toBeNull();
    expect(paybackRun(5)).toEqual({ paid: 0.5, span: 10 });
    expect(paybackRun(12.5)).toEqual({ paid: 12.5 / 15, span: 15 });
  });
});
