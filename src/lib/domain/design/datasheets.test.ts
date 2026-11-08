import { describe, expect, it } from "vitest";
import {
  checkInverter,
  checkPanel,
  codeKey,
  datasheetFigures,
  formFromReading,
  isAustralianSheet,
  sheetBasis,
  sheetCandidates,
  withDatasheets,
} from "./datasheets";
import { checkString } from "./electrical";

const panel = { voc: "36.42", vmp: "31.11", isc: "15.86", imp: "15.27", vocPercent: "-0.24", iscPercent: "0.046", pmaxPercent: "-0.26" };
const inverter = {
  maxVoltage: "600",
  mppMin: "40",
  mppMax: "560",
  startVoltage: "40",
  mppts: [
    { maxCurrent: "16", maxShortCircuit: "20", strings: "1" },
    { maxCurrent: "16", maxShortCircuit: "20", strings: "1" },
  ],
};

describe("a product's datasheet", () => {
  it("keeps a panel's checked figures, the percentages as shares", () => {
    const r = checkPanel(panel, "basis");
    expect(r).toEqual({
      ok: true,
      value: { voc: 36.42, vmp: 31.11, isc: 15.86, imp: 15.27, vocPerC: -0.0024, iscPerC: 0.00046, pmaxPerC: -0.0026, basis: "basis" },
    });
  });

  it("refuses a panel's figures that are missing or can't be right", () => {
    expect(checkPanel({ ...panel, voc: "" }, "b").ok).toBe(false);
    expect(checkPanel({ ...panel, vmp: "40" }, "b")).toEqual({ ok: false, message: "Vmp should be lower than Voc." });
    expect(checkPanel({ ...panel, vocPercent: "0.24" }, "b").ok).toBe(false);
  });

  it("keeps an inverter's inputs, and refuses a range that doesn't add up", () => {
    const r = checkInverter(inverter, "b");
    expect(r.ok && r.value.mppts).toHaveLength(2);
    expect(checkInverter({ ...inverter, mppMax: "700" }, "b").ok).toBe(false);
    expect(checkInverter({ ...inverter, mppts: [] }, "b").ok).toBe(false);
    expect(checkInverter({ ...inverter, mppts: [{ maxCurrent: "16", maxShortCircuit: "12", strings: "1" }] }, "b").ok).toBe(false);
  });

  it("turns a reading into the form to check, blanks where nothing was read", () => {
    const f = formFromReading({
      isDatasheet: true,
      kind: "inverter",
      model: "SH6.0RS",
      panel: null,
      inverter: {
        maxVoltage: 600,
        mppMin: null,
        mppMax: 560,
        startVoltage: 40,
        mppts: [{ maxCurrent: 16, maxShortCircuit: 20, strings: 1 }],
      },
    });
    expect(f.kind).toBe("inverter");
    expect(f.inverter.mppMin).toBe("");
    expect(f.inverter.mppts).toEqual([{ maxCurrent: "16", maxShortCircuit: "20", strings: "1" }]);
  });

  it("puts the business's figures ahead of ours, and the string check then uses them", () => {
    const p = checkPanel(panel, sheetBasis("Tiger Neo 475", "jinko.pdf", "sam@x.example", "22 Oct 2026"));
    const i = checkInverter(inverter, "b");
    if (!p.ok || !i.ok) throw new Error("unexpected");
    expect(p.value.basis).toBe("Tiger Neo 475 (jinko.pdf), read and checked by sam on 22 Oct 2026");
    const products: { sku: string; electrical?: typeof p.value }[] = [{ sku: "NEW-PANEL" }, { sku: "OTHER" }];
    const [mine, other] = withDatasheets(products, { "NEW-PANEL": p.value });
    expect(mine.electrical).toBe(p.value);
    expect(other).toEqual({ sku: "OTHER" });
    // Ten of these panels on one input of this inverter are judged from the checked figures, which it names.
    const check = checkString({ panels: 10, panel: p.value, inverter: i.value, mppt: 0, sharing: 1 });
    expect(check.verdict).not.toBe("unknown");
    expect(check.basis.join(" ")).toContain("read and checked by sam");
    // Twenty would be over the 600 V input on a cold morning.
    expect(checkString({ panels: 20, panel: p.value, inverter: i.value, mppt: 0, sharing: 1 }).verdict).toBe("bad");
  });
});

describe("codeKey", () => {
  it("reads codes written differently as the same product", () => {
    expect(codeKey("SG-WSH10.0RT")).toBe(codeKey("sgwsh10rt"));
    expect(codeKey("JKM 475N_54HL4")).toBe("JKM475N54HL4");
  });
  it("finds a datasheet for a code written another way", () => {
    const out = withDatasheets([{ sku: "SGWSH10RT", electrical: undefined as unknown }], { "SGWSH10.0RT": { maxV: 1 } });
    expect(out[0].electrical).toEqual({ maxV: 1 });
  });
});

describe("datasheetFigures, for Sol", () => {
  const sheet = {
    kind: "panel" as const,
    sku: "ABC-440",
    model: "Example 440 W",
    figures: { voc: 40, vmp: 33, isc: 14, imp: 13.3, vocPerC: -0.0025, iscPerC: 0.0005, pmaxPerC: -0.003, basis: "x" },
    checkedBy: "sam@example.com",
    checkedAt: "2026-10-30T00:00:00.000Z",
  };
  it("finds the business's sheet by code or model words, saying who checked it", () => {
    const got = datasheetFigures([sheet], "example 440");
    expect(got).toContain("ABC-440");
    expect(got).toContain("Voc 40 V");
    expect(got).toContain("-0.25%/°C");
    expect(got).toContain("checked by sam");
  });
  it("falls back to RENUABL's own figures, marked to check", () => {
    expect(datasheetFigures([], "JKM475N")).toMatch(/RENUABL's figures .*check against the datasheet/);
  });
  it("says when nothing matches or nothing was asked", () => {
    expect(datasheetFigures([sheet], "nothing-like-it")).toMatch(/No datasheet figures match/);
    expect(datasheetFigures([sheet], "  ")).toMatch(/Say which product/);
  });
});

describe("the Australian sheet first", () => {
  const eu = "https://jinkosolar.eu/wp-content/uploads/2025/09/JKM460-485N-48QL6-DB-F2-EU.pdf";
  const au = "https://www.jinkosolar.com.au/uploads/JKM450-475N-48QL6-DB-F2C2-OC.pdf";
  const plain = "https://example.com/files/JKM475N-48QL6-DB.pdf";

  it("knows an Australian sheet from its link", () => {
    expect(isAustralianSheet(au)).toBe(true);
    expect(isAustralianSheet("https://maker.com/datasheets/au/inverter.pdf")).toBe(true);
    expect(isAustralianSheet(eu)).toBe(false);
    expect(isAustralianSheet(plain)).toBe(false);
  });

  it("tries the Australian sheet before a European one, and a plain one before the European", () => {
    expect(sheetCandidates(eu, [eu, plain, au], "JKM475N-48QL6-DB")).toEqual([au, plain, eu]);
  });
});
