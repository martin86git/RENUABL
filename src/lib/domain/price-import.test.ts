import { describe, expect, it } from "vitest";
import { PANEL } from "./catalogue";
import { billOfMaterials } from "./costing";
import { catalogueEntries, matchPrices, parseCsv, parsePrice } from "./price-import";

describe("supplier price imports", () => {
  it("reads prices however suppliers write them", () => {
    expect(parsePrice("$123.50")).toBe(123.5);
    expect(parsePrice("1,295.00")).toBe(1295);
    expect(parsePrice("26.0c/w ($123.50)")).toBe(123.5);
    expect(parsePrice("0.235")).toBe(0.235);
    expect(parsePrice("Jinko 475W")).toBeNull();
    expect(parsePrice("")).toBeNull();
  });

  it("knows every product we quote", () => {
    const skus = catalogueEntries().map((e) => e.sku);
    expect(skus).toContain(PANEL.sku);
    expect(skus).toContain("SIG11130001");
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("matches rows by SKU and lists what changed", () => {
    const rows = parseCsv(
      `SKU,Description,Price ex GST\n${PANEL.sku},"Jinko 475W, all black",119.90\nSIG11130001,Sigenergy 8kWh module,2299\nUNKNOWN-1,Something else,10\n`,
    );
    const m = matchPrices(rows);
    expect(m.changes).toEqual([expect.objectContaining({ sku: PANEL.sku, oldCost: PANEL.cost, newCost: 119.9 })]);
    expect(m.unchanged).toBe(1);
    expect(m.notInFile.length).toBeGreaterThan(10);
  });

  it("uses imported prices in the bill of materials, after a retailer's own", () => {
    const base = {
      panelCount: 12,
      batteryKwh: 0,
      evCharger: false,
      roof: "tin" as const,
      storeys: "single" as const,
      phase: "single" as const,
      addOns: [],
    };
    const panelLine = (costs?: Record<string, number>, supplyCosts?: Record<string, number>) =>
      billOfMaterials({ ...base, costs, partner: supplyCosts ? { rates: undefined as never, supplyCosts } : undefined }).find(
        (l) => l.sku === PANEL.sku,
      )!;
    expect(panelLine().unitCost).toBe(PANEL.cost);
    expect(panelLine({ [PANEL.sku]: 110 }).unitCost).toBe(110);
  });
});
