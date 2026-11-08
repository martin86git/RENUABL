import { describe, expect, it } from "vitest";
import { dailyFromBill, quickSize, sumOf, sumWords } from "./quick-size";

describe("the quick sizing calculator", () => {
  it("reads a day's use from a bill, less the supply charge", () => {
    // $600 a quarter: $6.57 a day, less $1.10 supply, at 30c is about 18.2 kWh a day.
    expect(dailyFromBill(600, "quarter", 30, 1.1)).toBeCloseTo(18.24, 1);
    expect(dailyFromBill(0, "quarter", 30, 1.1)).toBeNull();
    // A bill that is all supply charge leaves no use.
    expect(dailyFromBill(90, "quarter", 30, 1.1)).toBeNull();
  });

  it("sizes solar to the year's use, never under 5 kW", () => {
    const small = quickSize({ kwhPerDay: 8 })!;
    expect(small.solar.kw).toBeGreaterThanOrEqual(5);
    const big = quickSize({ kwhPerDay: 30 })!;
    // 30 / 3.8 is 7.9 kW: 17 panels of 475 W, 8.1 kW, on an 8 kW inverter (133% allowed).
    expect(big.solar.panels).toBe(17);
    expect(big.solar.kw).toBeCloseTo(8.1, 1);
    expect(big.solar.inverterKw).toBe(8);
    expect(big.yearKwh).toBe(10950);
  });

  it("sizes the battery for the evening and the solar to fill it in winter", () => {
    const s = quickSize({ kwhPerDay: 20 })!;
    expect(s.withBattery.eveningKwh).toBe(12);
    // 12 kWh of evening at 90% usable: a 14 kWh battery.
    expect(s.withBattery.batteryKwh).toBe(14);
    // A winter day's spare is 3.8 × 0.5 × 0.6 = 1.14 kWh a kW, so 12 / 1.14 is 10.5 kW.
    expect(s.withBattery.kw).toBeGreaterThanOrEqual(10.5);
    expect(s.withBattery.kw).toBeGreaterThanOrEqual(s.solar.kw);
  });

  it("works from a bill when no day's use is given, and caps a huge one", () => {
    expect(quickSize({ bill: 600, period: "quarter" })?.fromBill).toBe(true);
    expect(quickSize({ kwhPerDay: 15 })?.fromBill).toBe(false);
    expect(quickSize({})).toBeNull();
    expect(quickSize({ kwhPerDay: 200 })?.capped).toBe(true);
  });
});

describe("sums in the calculator", () => {
  it("does arithmetic in the usual order, with brackets and percentages", () => {
    expect(sumOf("450*4/365")).toBeCloseTo(4.9315, 4);
    expect(sumOf("(1200 - 300) * 0.9")).toBe(810);
    expect(sumOf("2+3*4")).toBe(14);
    expect(sumOf("-5 + 2")).toBe(-3);
    expect(sumOf("10% * 500")).toBe(50);
    expect(sumOf("1,200 x 2")).toBe(2400);
  });

  it("refuses anything that isn't a whole sum", () => {
    expect(sumOf("")).toBeNull();
    expect(sumOf("2+")).toBeNull();
    expect(sumOf("4/0")).toBeNull();
    expect(sumOf("alert(1)")).toBeNull();
    expect(sumOf("(2+3")).toBeNull();
  });

  it("writes an answer to read", () => {
    expect(sumWords(1234567.891234)).toBe("1,234,567.8912");
  });
});
