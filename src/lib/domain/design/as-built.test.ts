import { describe, expect, it } from "vitest";
import { asBuiltDifferences, asBuiltFrom, asBuiltInWords, asBuiltMissing, cleanAsBuilt, serialsOf, type Designed } from "./as-built";

const designed: Designed = {
  panels: 16,
  panelModel: "Jinko 475 W",
  inverters: ["Sungrow SH8.0RS"],
  battery: { model: "Sigenergy 8 kWh", modules: 2 },
};

describe("the as-built record", () => {
  it("starts from the design, with nothing to differ and every serial to record", () => {
    const start = asBuiltFrom(designed);
    expect(asBuiltDifferences(start, designed)).toEqual([]);
    expect(asBuiltMissing(start)).toEqual(["16 panel serials", "1 inverter serial", "2 battery serials", "the install date"]);
  });
  it("says how what was installed differs", () => {
    const built = { ...asBuiltFrom(designed), panels: { model: "Trina 440 W", count: 15 }, battery: null };
    expect(asBuiltDifferences(built, designed)).toEqual([
      "Panels: 16 designed, 15 installed.",
      "Panel: designed Jinko 475 W, installed Trina 440 W.",
      "Battery: 2 × Sigenergy 8 kWh designed, none installed.",
    ]);
  });
  it("reads serials one a line or with commas, cleaned and without repeats", () => {
    expect(serialsOf("ab12 \n AB12, cd-34;\n\n<script>")).toEqual(["AB12", "CD-34"]);
  });
  it("cleans what a browser sends", () => {
    const clean = cleanAsBuilt({
      installedOn: "2026-11-20",
      panels: { model: "Jinko", count: 999 },
      inverters: [{ model: "X", serial: "s1" }],
      battery: {},
      notes: 7,
    });
    expect(clean).toEqual({
      installedOn: "2026-11-20",
      panels: { model: "Jinko", count: 0 },
      panelSerials: [],
      inverters: [{ model: "X", serial: "S1" }],
      battery: null,
      notes: "",
    });
  });
});

describe("the as-built in words, for Sol", () => {
  it("gives the models and every serial", () => {
    const words = asBuiltInWords({
      installedOn: "2026-09-01",
      panels: { model: "JKM475N", count: 2 },
      panelSerials: ["P1", "P2"],
      inverters: [{ model: "SH8.0RS", serial: "INV9" }],
      battery: { model: "SigenStor", modules: 1, serials: [] },
      notes: "",
      by: "jo@sunny.example",
      at: "2026-09-02T00:00:00Z",
    });
    expect(words).toContain("Panels: 2 × JKM475N; serials P1, P2");
    expect(words).toContain("Inverter: SH8.0RS, serial INV9");
    expect(words).toContain("Battery: SigenStor, 1 module; no serials recorded");
    expect(words).not.toContain("@");
  });
});
