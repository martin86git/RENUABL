import { describe, expect, it } from "vitest";
import { SHARED_BY, datasheetFigures, sharedBasis, sharedFor } from "./datasheets";

describe("datasheets shared across businesses", () => {
  const sheet = (kind: "panel" | "inverter", sku: string, n = 0) => ({ kind, sku, n });

  it("gives a business the sheets it has none of its own for, one a product", () => {
    const own = [sheet("inverter", "SGWSH10RT")];
    const others = [
      sheet("inverter", "SGWSH10.0RT", 1),
      sheet("panel", "JKM-475", 2),
      sheet("panel", "jkm 475", 3),
      sheet("panel", "SGWSH10RT", 4),
    ];
    // Its own inverter wins however the code is written; the first panel given wins; a panel of the same code as an inverter is another product.
    expect(sharedFor(own, others).map((s) => s.n)).toEqual([2, 4]);
    expect(sharedFor([], [])).toEqual([]);
  });

  it("never says whose a shared sheet is", () => {
    expect(SHARED_BY).not.toMatch(/@/);
    expect(sharedBasis("Jinko 475", "jinko.pdf", "22 Nov 2026", false)).toBe(
      "Jinko 475 (jinko.pdf), read and checked by another business on RENUABL on 22 Nov 2026",
    );
    expect(sharedBasis("", "", "22 Nov 2026", true)).toBe(
      "Datasheet (datasheet), found online for another business on RENUABL on 22 Nov 2026",
    );
  });

  it("tells Sol a shared sheet is shared", () => {
    const figures = { voc: 36.4, vmp: 31.1, isc: 15.9, imp: 15.3, vocPerC: -0.0024, iscPerC: 0.00046, pmaxPerC: -0.0026, basis: "x" };
    const line = datasheetFigures(
      [{ kind: "panel", sku: "NEW-475", model: "New 475", figures, checkedBy: SHARED_BY, checkedAt: "2026-11-22T00:00:00.000Z" }],
      "new 475",
      { panels: {}, inverters: {} },
    );
    expect(line).toContain("from a datasheet shared on RENUABL, checked by another business on RENUABL 2026-11-22");
  });
});
