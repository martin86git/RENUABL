import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchPrices } from "@/lib/domain/price-import";
import { readXlsxRows } from "./xlsx";

describe("supplier price list (AWM Clayton, August 2026)", () => {
  const rows = readXlsxRows(readFileSync(new URL("../domain/__fixtures__/awm-price-list.xlsx", import.meta.url)));

  it("reads the spreadsheet's rows", () => {
    expect(rows.length).toBeGreaterThan(50);
  });

  it("matches the products we quote and finds their prices unchanged", () => {
    const m = matchPrices(rows);
    expect(m.changes).toEqual([]);
    expect(m.unchanged).toBeGreaterThan(30);
    expect(m.notInFile).toEqual([]);
  });
});
