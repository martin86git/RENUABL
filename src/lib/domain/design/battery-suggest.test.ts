import { describe, expect, it } from "vitest";
import { makerName, makerOf, SMALL_NIGHTS_KWH, suggestBatteries, takesBattery } from "./battery-suggest";
import type { CatalogueBattery } from "./catalogue";
import { DAY } from "./quote";
import { MAX_BATTERY_QTY } from "./roof-design";

const batteries: CatalogueBattery[] = [
  { sku: "SIG8", name: "Sigenergy 8.0kWh SigenStor Battery Module", kwh: 8 },
  { sku: "SIG9", name: "Sigenergy 9.0kWh SigenStor Battery Module", kwh: 9 },
  { sku: "GW83", name: "Goodwe ESA 8.3kw Battery", kwh: 8.3 },
  { sku: "SBR", name: "Sungrow SBR 3.2 kWh module", kwh: 3.2 },
  { sku: "SE10", name: "Solar Edge Energy Bank 10kwh Battery", kwh: 10 },
];
// A year of a design's output, kWh a month: about 26 to 29 kWh a day in the middling months.
const year = [1100, 950, 900, 700, 550, 450, 480, 620, 780, 950, 1050, 1120];
const base = { batteries, monthlyKwh: year, selfUseShare: 0.35, eveningShare: DAY.eveningShare };

describe("makers", () => {
  it("knows makers whatever the spacing or spelling", () => {
    expect(makerOf("Solar Edge Energy Bank 10kwh Battery")).toBe("solaredge");
    expect(makerOf("Goodwe ESA 8.3kw Battery")).toBe("goodwe");
    expect(makerOf("Sigen Energy Gateway Single Phase")).toBe("sigenergy");
    expect(makerOf("Acme Power 5kWh")).toBe("acme");
  });

  it("writes them as people do", () => {
    expect(makerName("byd")).toBe("BYD");
    expect(makerName("goodwe")).toBe("GoodWe");
    expect(makerName("sungrow")).toBe("Sungrow");
  });

  it("goes by the inverter's own hybrid flag first, else its name", () => {
    expect(takesBattery({ name: "Sungrow SH10RT hybrid", hybrid: false })).toBe(false);
    expect(takesBattery({ name: "Sungrow SG5.0RS", hybrid: true })).toBe(true);
    expect(takesBattery({ name: "Sungrow SH5.0RS" })).toBe(true);
    expect(takesBattery({ name: "Sigenergy 8.0kW SigenStor Single Phase Controller" })).toBe(true);
    expect(takesBattery({ name: "Sungrow 5kW Single Phase 2 MPPT Inverter" })).toBe(false);
  });
});

describe("suggesting a battery", () => {
  it("sizes to the nights from the bill, and keeps to the inverter's maker", () => {
    const s = suggestBatteries({ ...base, inverters: [{ name: "Sungrow SH10RT", hybrid: true }], dailyKwh: 20 });
    // 12 kWh of nights, 90% usable: 13.3 kWh asked for.
    expect(s.size).toBe(13.3);
    expect(s.suggestions).toHaveLength(1);
    expect(s.suggestions[0]).toMatchObject({ maker: "Sungrow", qty: 5 });
    expect(s.suggestions[0].why).toMatch(/5 × 3.2 kWh = 16 kWh/);
    expect(s.suggestions[0].why).toMatch(/same maker as the inverter/);
    expect(s.note).toMatch(/sized to the nights/);
    expect(s.note).not.toMatch(/hybrid/);
  });

  it("is no bigger than the panels can fill", () => {
    const s = suggestBatteries({ ...base, inverters: [], dailyKwh: 60 });
    expect(s.note).toMatch(/what the roof can fill/);
    expect(s.size).toBeLessThan(36 / 0.9);
  });

  it("without a bill, sizes to what the panels spare and asks for the bill", () => {
    const s = suggestBatteries({ ...base, inverters: [], dailyKwh: null });
    // Middling months make 26 and 29 kWh a day, 65% spare: 17.9 kWh, over 0.9.
    expect(s.size).toBe(19.9);
    expect(s.note).toMatch(/Add the customer's bill/);
    expect(s.note).not.toMatch(/wouldn't do much/);
  });

  it("treats a bill of nothing as no bill", () => {
    const s = suggestBatteries({ ...base, inverters: [], dailyKwh: 0 });
    expect(s.size).toBe(19.9);
  });

  it("rounds the size to a tenth", () => {
    // 6 kWh of nights over 0.9 = 6.666…
    expect(suggestBatteries({ ...base, inverters: [], dailyKwh: 10 }).size).toBe(6.7);
  });

  it("offers one a maker without an inverter, least to spare first", () => {
    const s = suggestBatteries({ ...base, inverters: [], dailyKwh: 20 });
    const makers = s.suggestions.map((x) => x.maker);
    expect(new Set(makers).size).toBe(makers.length);
    expect(makers.sort()).toEqual(["GoodWe", "Sigenergy", "SolarEdge", "Sungrow"]);
    expect(s.suggestions.find((x) => x.maker === "Sigenergy")?.battery.sku).toBe("SIG8");
    const totals = s.suggestions.map((x) => x.battery.kwh * x.qty);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(s.suggestions.every((x) => !/inverter/.test(x.why))).toBe(true);
  });

  it("asks to check the inverter when the list has none of its maker", () => {
    const s = suggestBatteries({ ...base, inverters: [{ name: "Fronius Primo 5.0", hybrid: true }], dailyKwh: 20 });
    expect(s.suggestions.length).toBe(4);
    expect(s.suggestions.every((x) => /Check it works with the inverter/.test(x.why))).toBe(true);
  });

  it("picks the fewest units between two stacks of the same size", () => {
    const list: CatalogueBattery[] = [
      { sku: "A4", name: "Acme 4 kWh", kwh: 4 },
      { sku: "A8", name: "Acme 8 kWh", kwh: 8 },
    ];
    const s = suggestBatteries({ ...base, batteries: list, inverters: [], dailyKwh: 20 });
    expect(s.suggestions[0]).toMatchObject({ qty: 2, battery: { sku: "A8" } });
  });

  it("offers the biggest stack when none reaches the size, and says so", () => {
    const list: CatalogueBattery[] = [
      { sku: "T1", name: "Tiny 0.5 kWh", kwh: 0.5 },
      { sku: "T2", name: "Tiny 0.4 kWh", kwh: 0.4 },
    ];
    const s = suggestBatteries({ ...base, batteries: list, inverters: [], dailyKwh: 20 });
    expect(s.suggestions[0]).toMatchObject({ qty: MAX_BATTERY_QTY, battery: { sku: "T1" } });
    expect(s.suggestions[0].why).toMatch(/the most this one stacks to/);
  });

  it("says so when the nights are small, and when the inverter can't take a battery", () => {
    const s = suggestBatteries({
      ...base,
      inverters: [{ name: "Sungrow 5kW Single Phase 2 MPPT Inverter", hybrid: false }],
      dailyKwh: 5,
    });
    expect(5 * DAY.eveningShare).toBeLessThan(SMALL_NIGHTS_KWH);
    expect(s.note).toMatch(/wouldn't do much/);
    expect(s.note).toMatch(/needs a hybrid inverter/);
  });

  it("keeps to six suggestions", () => {
    const list = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"].map((m, i) => ({
      sku: m,
      name: `${m} battery`,
      kwh: 5 + i,
    }));
    expect(suggestBatteries({ ...base, batteries: list, inverters: [], dailyKwh: 20 }).suggestions).toHaveLength(6);
  });

  it("with an empty catalogue, still gives the size and the note", () => {
    const s = suggestBatteries({ ...base, batteries: [], inverters: [], dailyKwh: 20 });
    expect(s.size).toBe(13.3);
    expect(s.note).not.toBe("");
    expect(s.suggestions).toEqual([]);
  });

  it("leaves out batteries with no size", () => {
    const list: CatalogueBattery[] = [{ sku: "X", name: "Nothing 0 kWh", kwh: 0 }];
    expect(suggestBatteries({ ...base, batteries: list, inverters: [], dailyKwh: 20 }).suggestions).toEqual([]);
  });

  it("suggests nothing without a year of output", () => {
    expect(suggestBatteries({ ...base, monthlyKwh: [], inverters: [], dailyKwh: 20 })).toEqual({
      size: 0,
      note: "",
      suggestions: [],
    });
    expect(suggestBatteries({ ...base, monthlyKwh: Array(12).fill(0), inverters: [], dailyKwh: 20 }).size).toBe(0);
  });

  it("never says AI", () => {
    const s = suggestBatteries({ ...base, inverters: [{ name: "Sungrow SG5.0RS", hybrid: false }], dailyKwh: 5 });
    expect(JSON.stringify(s)).not.toMatch(/\bAI\b/);
  });
});
