import { describe, expect, it } from "vitest";
import { BACKUP_MODULE_KWH, dailyFromBill, openingAdvice, quickSize, recommendKw, sizeFromKw, sumOf, sumWords } from "./quick-size";

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

describe("sizeFromKw", () => {
  it("takes the solar's kW to panels and an inverter", () => {
    const s = sizeFromKw({ kw: 6.6, battery: "none", phase: "single" })!;
    expect(s.panels).toBe(14);
    expect(s.hybrid).toBe(false);
    expect(s.batteryKwh).toBeNull();
    expect(s.notes.some((n) => n.includes("single phase"))).toBe(true);
  });
  it("sizes the battery to what a winter day's spare fills, and adds a module for backup", () => {
    const plain = sizeFromKw({ kw: 10, battery: "solar", phase: "three" })!;
    expect(plain.hybrid).toBe(true);
    expect(plain.batteryKwh).toBe(Math.max(5, Math.ceil(plain.winterSpareKwh / 0.9)));
    const backup = sizeFromKw({ kw: 10, battery: "backup", phase: "three" })!;
    expect(backup.batteryKwh).toBe(plain.batteryKwh! + BACKUP_MODULE_KWH);
    expect(backup.backupKwh).toBe(BACKUP_MODULE_KWH);
  });
  it("keeps the battery to the evenings when the use is known", () => {
    const s = sizeFromKw({ kw: 15, battery: "solar", phase: "three", kwhPerDay: 10 })!;
    expect(s.batteryKwh).toBe(Math.ceil(6 / 0.9));
    expect(s.yearShare).toBe(100);
    expect([s.eveningKwh, s.toEvenings]).toEqual([6, true]);
    expect(s.notes[0]).toBe("Battery sized to the 6 kWh they use after dark: a bigger one wouldn't be used.");
  });
  it("flags single phase over the export size, and a size over the calculator's", () => {
    expect(sizeFromKw({ kw: 6.6, battery: "none", phase: "single" })!.exportCheck).toBe(true);
    expect(sizeFromKw({ kw: 6.6, battery: "none", phase: "three" })!.exportCheck).toBe(false);
    expect(sizeFromKw({ kw: 30, battery: "none", phase: "three" })!.overMax).toBe(true);
  });
  it("is nothing without a size", () => expect(sizeFromKw({ kw: 0, battery: "none", phase: "single" })).toBeNull());
});

describe("openingAdvice", () => {
  it("leads with a battery when the evenings are worth storing", () => {
    const a = openingAdvice(quickSize({ kwhPerDay: 20 })!);
    expect(a.lead).toBe("battery");
    expect(a.headline).toContain("battery");
    expect(a.why).toHaveLength(3);
  });
  it("leads with solar alone for small evenings", () => {
    expect(openingAdvice(quickSize({ kwhPerDay: 6 })!).lead).toBe("solar");
  });
});

describe("recommendKw", () => {
  it("waits for the home's use", () => {
    expect(recommendKw(null, "solar")).toBeNull();
    expect(recommendKw(0, "none")).toBeNull();
  });
  it("puts in quickSize's solar, larger with a battery", () => {
    const size = quickSize({ kwhPerDay: 25 })!;
    expect(recommendKw(25, "none")!.kw).toBe(size.solar.kw);
    expect(recommendKw(25, "solar")!.kw).toBe(size.withBattery.kw);
    expect(recommendKw(25, "backup")!.kw).toBe(size.withBattery.kw);
    expect(recommendKw(25, "solar")!.kw).toBeGreaterThanOrEqual(recommendKw(25, "none")!.kw);
  });
  it("says why, and when the smallest system covers it", () => {
    expect(recommendKw(25, "solar")!.why).toMatch(/fill the battery/);
    expect(recommendKw(25, "none")!.why).toMatch(/a year's use/);
    expect(recommendKw(3, "none")!.why).toMatch(/smallest system/);
  });
});

describe("how much of the evening the battery covers", () => {
  it("says so when a small system can't fill the battery (1 kW typed, 7.6 kWh a day)", () => {
    const s = sizeFromKw({ kw: 1, battery: "solar", phase: "single", kwhPerDay: 7.6 })!;
    expect(s.kw).toBe(1.4); // three whole 475 W panels
    expect(s.dayKwh).toBe(5.3);
    expect(s.eveningKwh).toBe(4.6);
    expect(s.coveredKwh).toBe(3.2); // 60% of 5.3 spare after the home's own use
    expect(s.solarShort).toBe(true);
  });
  it("covers the whole evening at Sol's size", () => {
    const pick = recommendKw(7.6, "solar")!;
    const s = sizeFromKw({ kw: pick.kw, battery: "solar", phase: "single", kwhPerDay: 7.6 })!;
    expect(s.coveredKwh).toBe(s.eveningKwh);
    expect(s.solarShort).toBe(false);
  });
  it("leaves the blackout module out of what covers the evening", () => {
    const s = sizeFromKw({ kw: 1, battery: "backup", phase: "single", kwhPerDay: 7.6 })!;
    expect(s.coveredKwh).toBe(3.2);
  });
  it("has nothing to say without a battery or a use", () => {
    expect(sizeFromKw({ kw: 5, battery: "none", phase: "single", kwhPerDay: 7.6 })!.coveredKwh).toBeNull();
    expect(sizeFromKw({ kw: 5, battery: "solar", phase: "single" })!.coveredKwh).toBeNull();
  });
});
