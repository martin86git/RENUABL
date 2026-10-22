import { describe, expect, it } from "vitest";
import { checkInverter, checkPanel, formFromReading, sheetBasis, withDatasheets } from "./datasheets";
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
