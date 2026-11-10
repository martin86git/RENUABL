import { describe, expect, it } from "vitest";
import { bannerFigures, systemSummary } from "./system-summary";

const line = (key: string, value: string | null) => ({ key, value });

describe("the deal's system, set out", () => {
  const lines = [
    line("systemType", "Solar and battery"),
    line("systemSize", "6.65 kW"),
    line("storeys", "Double"),
    line("roofType", "Tile"),
    line("phases", "1"),
    line("panel", "Jinko 475W All Black"),
    line("panelQty", "14"),
    line("inverter", "Sungrow 5kW Single Phase"),
    line("inverterQty", "1"),
    line("inverterCapacity", "5 kW"),
    line("battery", "Sigenergy 8.0kWh SigenStor Battery Module"),
    line("batteryQty", "3"),
    line("batteryStorage", "24 kWh"),
    line("arrays", "2"),
    line("evCharger", null),
    line("nmi", ""),
  ];

  it("puts the home first, in plain words", () => {
    expect(systemSummary(lines).home).toEqual([
      { label: "System", value: "Solar and battery" },
      { label: "Storeys", value: "Double storey" },
      { label: "Roof", value: "Tile roof" },
      { label: "Power", value: "Single phase" },
    ]);
  });

  it("gives each part its product, how many and its size on one line", () => {
    expect(systemSummary(lines).parts).toEqual([
      { name: "Solar", product: "Jinko 475W All Black", qty: "× 14", size: "6.65 kW" },
      { name: "Inverter", product: "Sungrow 5kW Single Phase", qty: "× 1", size: "5 kW", extra: null },
      { name: "Battery", product: "Sigenergy 8.0kWh SigenStor Battery Module", qty: "× 3", size: "24 kWh" },
    ]);
  });

  it("keeps the rest under its own heading and leaves out what isn't known", () => {
    const s = systemSummary(lines);
    expect(s.layout).toEqual([{ label: "Arrays", value: "2" }]);
    expect(s.site).toEqual([]);
    expect(systemSummary([]).parts).toEqual([]);
  });

  it("doesn't say a word twice when it was typed in full", () => {
    const s = systemSummary([line("storeys", "Single storey"), line("roofType", "Tin roof"), line("phases", "Three phase")]);
    expect(s.home.map((h) => h.value)).toEqual(["Single storey", "Tin roof", "Three phase"]);
  });
});

describe("the banner's figures", () => {
  it("names the solar with its panels, then the battery, inverter and EV charger", () => {
    const lines = [
      { key: "systemSize", value: "11.88 kW" },
      { key: "panelQty", value: "25" },
      { key: "batteryStorage", value: "16 kWh" },
      { key: "battery", value: "Sigenergy SigenStor" },
      { key: "inverterCapacity", value: "10 kW" },
      { key: "inverter", value: "Sigenergy 10 kW hybrid" },
    ];
    expect(bannerFigures(lines)).toEqual([
      { label: "Solar", value: "11.88 kW", note: "25 panels" },
      { label: "Battery", value: "16 kWh", note: "Sigenergy SigenStor" },
      { label: "Inverter", value: "10 kW", note: "Sigenergy 10 kW hybrid" },
    ]);
  });

  it("falls back to the deal's own kW, and leaves out what isn't known", () => {
    expect(bannerFigures([], 6.6)).toEqual([{ label: "Solar", value: "6.6 kW", note: null }]);
    expect(bannerFigures([])).toEqual([]);
  });
});
