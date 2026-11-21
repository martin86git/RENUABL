import { describe, expect, it } from "vitest";
import { clashRefusal, clashesWithSupply, inverterPhase, supplyClashes } from "./supply-match";
import { readiness } from "./readiness";

describe("an inverter against the home's supply", () => {
  it("reads the supply from the list, else the name", () => {
    expect(inverterPhase({ name: "Sungrow SG8.0RT", phase: "three" })).toBe("three");
    expect(inverterPhase({ name: "GoodWe 10kW Three Phase Hybrid" })).toBe("three");
    expect(inverterPhase({ name: "Fronius Primo 5.0 single phase" })).toBe("single");
    expect(inverterPhase({ name: "Sungrow SG5.0RS" })).toBeNull();
  });
  it("stops only a three-phase inverter on a single-phase home", () => {
    const three = { name: "Sungrow SG10RT", phase: "three" as const };
    const single = { name: "Sungrow SG5.0RS", phase: "single" as const };
    expect(clashesWithSupply(three, "single")).toBe(true);
    expect(clashesWithSupply(three, "three")).toBe(false);
    expect(clashesWithSupply(single, "three")).toBe(false);
    expect(supplyClashes([three, three, single], "single")).toEqual(["Sungrow SG10RT"]);
    expect(clashRefusal("Sungrow SG10RT")).toMatch(/can't be connected to a single-phase supply/);
  });
  it("puts it on Ready to install as something to fix", () => {
    const items = readiness({
      panels: 16,
      inverters: 1,
      strings: ["good"],
      unstrung: 0,
      ratio: null,
      tooClose: null,
      pitchSet: true,
      undecided: [],
      missing: 0,
      solarVic: { on: false, bar: null },
      phase: "single",
      inverterKw: 10,
      supplyClash: ["Sungrow SG10RT"],
    });
    const supply = items.find((i) => i.id === "supply")!;
    expect(supply.state).toBe("fix");
    expect(supply.goTo).toBe("kit");
    expect(supply.words).toMatch(/three-phase/);
  });
});
