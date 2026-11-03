import { describe, expect, it } from "vitest";
import { checkString } from "./electrical";
import {
  NO_DATASHEETS,
  foundBasis,
  foundFigures,
  missingSheets,
  readingFrom,
  sheetCandidates,
  type RawReading,
  type SheetReading,
} from "./datasheets";

const panelReading: SheetReading = {
  isDatasheet: true,
  kind: "panel",
  model: "Trina Vertex S+ TSM-440NEG9R.28",
  panel: { voc: 52.3, vmp: 43.6, isc: 10.7, imp: 10.1, vocPercentPerC: -0.24, iscPercentPerC: 0.04, pmaxPercentPerC: -0.29 },
  inverter: null,
};

describe("datasheets found online", () => {
  it("lists only the products with no figures anywhere, once each", () => {
    const missing = missingSheets(
      {
        panels: [
          { sku: "JKM475N-48QL6-DV", name: "Jinko 475" },
          { sku: "TSM-440NEG9R.28", name: "Trina 440" },
          { sku: "tsm 440neg9r.28", name: "Trina 440 again" },
        ],
        inverters: [
          { sku: "SGWSH5RT", name: "Sungrow SH5.0RT" },
          { sku: "X1-HYB-5.0", name: "Solax" },
        ],
      },
      { ...NO_DATASHEETS, inverters: {} },
    );
    expect(missing.map((m) => `${m.kind}:${m.sku}`)).toEqual(["panel:TSM-440NEG9R.28", "inverter:X1-HYB-5.0"]);
  });
  it("leaves out products the business already has figures for", () => {
    const sheets = { panels: { "TSM-440NEG9R.28": {} as never }, inverters: {} };
    expect(missingSheets({ panels: [{ sku: "TSM-440NEG9R.28", name: "Trina" }], inverters: [] }, sheets)).toEqual([]);
  });
  it("checks found figures as a person's save is checked, and says where they came from", () => {
    const got = foundFigures(panelReading, "panel", "https://static.trinasolar.com/sheet.pdf", "3 Nov 2026");
    expect(got.ok).toBe(true);
    if (got.ok)
      expect(got.value.basis).toBe(foundBasis("Trina Vertex S+ TSM-440NEG9R.28", "https://static.trinasolar.com/sheet.pdf", "3 Nov 2026"));
    expect(foundFigures(panelReading, "inverter", "https://x.com/a.pdf", "today").ok).toBe(false);
    expect(foundFigures({ ...panelReading, isDatasheet: false }, "panel", "https://x.com/a.pdf", "today").ok).toBe(false);
    expect(
      foundFigures({ ...panelReading, panel: { ...panelReading.panel!, voc: null } }, "panel", "https://x.com/a.pdf", "today").ok,
    ).toBe(false);
  });
  it("never passes a string outright on figures not yet checked", () => {
    const got = foundFigures(panelReading, "panel", "https://static.trinasolar.com/sheet.pdf", "3 Nov 2026");
    if (!got.ok) throw new Error("unexpected");
    const panel = {
      ...(got.value as never as Parameters<typeof checkString>[0]["panel"] & object),
      unchecked: "https://static.trinasolar.com/sheet.pdf",
    };
    const inverter = {
      maxVoltage: 1000,
      mppMin: 160,
      mppMax: 950,
      startVoltage: 180,
      mppts: [{ maxCurrent: 25, maxShortCircuit: 32, strings: 2 }],
      basis: "test",
    };
    const checked = checkString({ panels: 10, panel, inverter, mppt: 0, sharing: 1 });
    expect(checked.verdict).toBe("caution");
    expect(checked.words).toMatch(/found online/);
    expect(checkString({ panels: 10, panel: { ...panel, unchecked: undefined }, inverter, mppt: 0, sharing: 1 }).verdict).toBe("good");
  });
});

describe("the links tried for a datasheet", () => {
  it("tries PDFs the search really showed, closest to the product code first, and a made-up answer last", () => {
    const got = sheetCandidates(
      "https://jinkosolar.com.au/made-up/JKM450-475N-48QL6-DB.pdf",
      [
        "https://www.jinkosolar.com/en/site/tigerneo",
        "https://dist.example.com/files/jinko-tiger-neo.pdf",
        "https://www.jinkosolar.com/uploads/JKM450-475N-48QL6-DB-F1-EN.pdf",
        "http://insecure.example.com/JKM475N-48QL6-DB.pdf",
      ],
      "JKM475N-48QL6-DB",
    );
    expect(got).toEqual([
      "https://www.jinkosolar.com/uploads/JKM450-475N-48QL6-DB-F1-EN.pdf",
      "https://dist.example.com/files/jinko-tiger-neo.pdf",
      "https://jinkosolar.com.au/made-up/JKM450-475N-48QL6-DB.pdf",
    ]);
    expect(sheetCandidates(null, [], "X")).toEqual([]);
  });
});

describe("the reader's answer", () => {
  it("turns a 0 into a figure not read, and leaves out the other kind", () => {
    const got = readingFrom({
      isDatasheet: true,
      kind: "panel",
      model: " Jinko JKM475N-48QL6-DB ",
      panel: { voc: 38.95, vmp: 32.56, isc: 15.18, imp: 14.59, vocPercentPerC: -0.25, iscPercentPerC: 0.045, pmaxPercentPerC: 0 },
      inverter: { maxVoltage: 0, mppMin: 0, mppMax: 0, startVoltage: 0, mppts: [] },
    });
    expect(got.model).toBe("Jinko JKM475N-48QL6-DB");
    expect(got.panel?.voc).toBe(38.95);
    expect(got.panel?.pmaxPercentPerC).toBeNull();
    expect(got.inverter).toBeNull();
    expect(readingFrom({ isDatasheet: false, kind: "unknown", model: "" } as RawReading).kind).toBeNull();
  });
});
