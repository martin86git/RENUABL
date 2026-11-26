import { describe, expect, it } from "vitest";
import { sheetsToFind } from "./find-all-sheets";

describe("sheetsToFind", () => {
  const products = [
    { kind: "battery" as const, sku: "SIGEN-BAT-8", name: "SigenStor 8 kWh" },
    { kind: "panel" as const, sku: "JKM475N-48QL6-DB", name: "Jinko 475" },
    { kind: "inverter" as const, sku: "SGWSH10RT", name: "Sungrow 10 kW" },
    { kind: "inverter" as const, sku: "SGWSH10.0RT", name: "Sungrow 10 kW again" },
    { kind: "panel" as const, sku: "TSM-440", name: "Trina 440" },
    { kind: "charger" as const, sku: "ZAPPI-7", name: "Zappi" },
  ];

  it("lists what has no sheet on hand, panels and inverters first, one a product code", () => {
    const out = sheetsToFind(products, [], []);
    expect(out.map((p) => p.sku)).toEqual(["JKM475N-48QL6-DB", "TSM-440", "SGWSH10RT", "SIGEN-BAT-8", "ZAPPI-7"]);
    expect(out.every((p) => p.gap === "none")).toBe(true);
  });

  it("leaves out sheets kept with their file, and asks for the file where only figures are kept", () => {
    const out = sheetsToFind(
      products,
      [
        { kind: "panel", sku: "jkm475n 48ql6 db", hasFile: true },
        { kind: "inverter", sku: "SGWSH10RT", hasFile: false },
      ],
      [{ kind: "charger", sku: "ZAPPI-7" }],
    );
    expect(out.map((p) => [p.sku, p.gap])).toEqual([
      ["TSM-440", "none"],
      ["SGWSH10RT", "no-file"],
      ["SIGEN-BAT-8", "none"],
    ]);
  });
});
