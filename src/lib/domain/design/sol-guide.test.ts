import { describe, expect, it } from "vitest";
import {
  MAX_PANEL_CELLS,
  cellWords,
  guideStep,
  guiding,
  panelCells,
  panelsFor,
  reachedWords,
  targetWords,
  type GuideFacts,
} from "./sol-guide";
import { batteryForKw, batteryWords, freeHoursWords, unstrungWords, wantsInputs, layingWords } from "./sol-guide";

const facts = (over: Partial<GuideFacts> = {}): GuideFacts => ({
  roof: "tile",
  suggested: { kw: 7.6, kwh: 10, spend: "$450 a quarter" },
  target: null,
  panels: 0,
  kw: 0,
  inverters: 0,
  unstrung: 0,
  battery: null,
  ...over,
});

describe("Sol leads the design", () => {
  it("asks about the home first, and the flat roof's questions only on a flat roof", () => {
    expect(guideStep([], facts())).toBe("home");
    expect(guideStep(["home"], facts())).toBe("target");
    expect(guideStep(["home"], facts({ roof: "flat" }))).toBe("flat");
  });
  it("asks whether the outlined lot is the home first, only when the register found one, until panels go down", () => {
    expect(guideStep([], facts({ lot: true }))).toBe("house");
    expect(guideStep(["house"], facts({ lot: true }))).toBe("home");
    expect(guideStep(["home"], facts({ lot: true }))).toBe("house");
    expect(guideStep(["home"], facts({ lot: true, panels: 4 }))).toBe("target");
  });
  it("goes on whatever the answer: each step answered once moves to the next", () => {
    expect(guideStep(["home", "target"], facts())).toBe("panel");
    expect(guideStep(["home", "target", "panel"], facts())).toBe("place");
  });
  it("waits while panels are placed, then says the target is reached", () => {
    const placing = ["home", "target", "panel", "place"] as const;
    const target = { kw: 7.6, kwh: 10 };
    expect(guideStep(placing, facts({ target, panels: 8, kw: 3.8 }))).toBeNull();
    expect(guiding(placing, facts({ target, panels: 8, kw: 3.8 }))).toBe(true);
    expect(guideStep(placing, facts({ target, panels: 16, kw: 7.6 }))).toBe("reached");
  });
  it("asks to commence the shade analysis once the panels are down", () => {
    const placed = ["home", "target", "panel", "place", "reached"] as const;
    expect(guideStep(placed, facts({ panels: 16, kw: 7.6 }))).toBe("shade");
    expect(guideStep([...placed, "shade"], facts({ panels: 16, kw: 7.6 }))).toBe("inverter");
  });
  it("then the inverter, the strings, the battery and backup, passing over what's done", () => {
    const done = ["home", "target", "panel", "place", "reached", "shade"] as const;
    const target = { kw: 7.6, kwh: 10 };
    expect(guideStep(done, facts({ target, panels: 16, kw: 7.6 }))).toBe("inverter");
    expect(guideStep(done, facts({ target, panels: 16, kw: 7.6, inverters: 1, unstrung: 16 }))).toBe("string");
    expect(guideStep(done, facts({ target, panels: 16, kw: 7.6, inverters: 1 }))).toBe("battery");
    expect(guideStep(done, facts({ target: { kw: 7.6, kwh: 0 }, panels: 16, kw: 7.6, inverters: 1 }))).toBeNull();
    const withBattery = facts({ target, panels: 16, kw: 7.6, inverters: 1, battery: { kwh: 9.6 } });
    expect(guideStep(done, withBattery)).toBe("backup");
    expect(guideStep([...done, "backup"], withBattery)).toBeNull();
    expect(guiding([...done, "backup"], withBattery)).toBe(false);
  });
  it("says the size from the bill, or asks for it", () => {
    expect(targetWords("Clive", facts().suggested)).toBe(
      "Clive spends $450 a quarter, so we should aim for 7.6 kW of panels with a 10 kWh battery.",
    );
    expect(targetWords("Clive", null)).toMatch(/don't have their bill/);
    expect(panelsFor(7.6, 475)).toBe(16);
    expect(reachedWords(7.6, { kw: 7.6, kwh: 10 })).toMatch(/Target reached/);
  });
});

describe("the battery a size of panels points to", () => {
  it("is filled by the panels' 60% spare on a winter day, and larger with the three free hours", () => {
    // 10 kW makes 38 kWh on an average day: 22.8 spare, 11.4 in winter.
    const b = batteryForKw(10)!;
    expect(b.spareKwh).toBe(22.8);
    expect(b.winterSpareKwh).toBe(11.4);
    expect(b.solarKwh).toBe(13);
    expect(b.freeKwh).toBe(26);
  });

  it("is never more than the home uses after dark, when its use is known", () => {
    // 20 kWh a day: 12 after dark.
    const b = batteryForKw(10, 20)!;
    expect(b.eveningKwh).toBe(12);
    expect(b.solarKwh).toBe(13);
    // The free hours fill a bigger one all the same: the rest past the evenings is a reserve for blackouts.
    expect(b.freeKwh).toBe(26);
    expect(b.reserveKwh).toBe(11);
    expect(freeHoursWords(b)).toMatch(/About 11 kWh .* reserve for blackouts/);
    expect(batteryWords(b)).toBe("The panels spare about 23 kWh on an average day, 11 in winter. They use about 12 kWh after dark.");
  });

  it("is never under the smallest battery, and nothing without panels", () => {
    expect(batteryForKw(1)!.solarKwh).toBe(5);
    expect(batteryForKw(1)!.freeKwh).toBe(13);
    expect(batteryForKw(0)).toBeNull();
  });
});

describe("panels left off the strings", () => {
  it("says so after Sol strings them, with why, and offers more inputs when that's the reason", () => {
    const answered = ["home", "target", "panel", "place", "reached", "shade", "inverter", "string"] as const;
    const f = facts({
      panels: 15,
      kw: 7.1,
      inverters: 1,
      unstrung: 4,
      leftWhy: ["4 panels facing 0° at 22°: no inverter input is left for them"],
    });
    expect(guideStep(answered, f)).toBe("unstrung");
    expect(guideStep([...answered, "unstrung"], f)).toBeNull();
    expect(guideStep(answered, { ...f, leftWhy: undefined })).toBeNull();
    expect(unstrungWords(4, f.leftWhy!)).toBe("I couldn't string 4 panels: 4 panels facing 0° at 22°: no inverter input is left for them.");
    expect(wantsInputs(f.leftWhy!)).toBe(true);
  });
});

describe("panels already on the roof", () => {
  it("asks whether to replace them or work around them after the size, only when the roof check found some", () => {
    const answered = ["home", "target"] as const;
    expect(guideStep(answered, facts({ existingSolar: true }))).toBe("existing");
    expect(guideStep([...answered, "existing"], facts({ existingSolar: true }))).toBe("panel");
    expect(guideStep(answered, facts())).toBe("panel");
  });
});

describe("layingWords", () => {
  it("counts the row and what is left to the target", () => {
    expect(layingWords(6, 0, 475, { kw: 5.2, kwh: 0 })).toEqual({
      row: "6 panels · 2.85 kW",
      left: "5 more to reach 5.2 kW",
      state: "short",
    });
    expect(layingWords(4, 7, 475, { kw: 5.2, kwh: 0 }).state).toBe("on");
    expect(layingWords(8, 7, 475, { kw: 5.2, kwh: 0 })).toMatchObject({
      row: "8 panels · 7.13 kW in all",
      left: "4 over the 5.2 kW target",
      state: "over",
    });
  });
  it("counts alone without a target", () => {
    expect(layingWords(1, 0, 475, null)).toEqual({ row: "1 panel · 0.48 kW", left: null, state: "none" });
  });
});

describe("the panels-to-go bar", () => {
  it("fills a cell a panel towards the target, marks the row being laid, and counts down", () => {
    const c = panelCells(1, 3, 475, { kw: 7.1, kwh: 0 })!;
    expect(c.cells).toHaveLength(15);
    expect(c.cells.slice(0, 5)).toEqual(["laid", "laying", "laying", "laying", "empty"]);
    expect(c.toGo).toBe(11);
    expect(cellWords(c)).toBe("11 to go");
  });
  it("marks cells past the target as over, and caps what it draws", () => {
    const c = panelCells(1, 33, 475, { kw: 7.1, kwh: 0 })!;
    expect(c.over).toBe(19);
    expect(c.cells.filter((x) => x === "over")).toHaveLength(19);
    expect(cellWords(c)).toBe("19 over");
    expect(cellWords(panelCells(15, 0, 475, { kw: 7.1, kwh: 0 })!)).toBe("On target");
    const big = panelCells(0, 60, 475, { kw: 7.1, kwh: 0 })!;
    expect(big.cells).toHaveLength(MAX_PANEL_CELLS);
    expect(big.more).toBe(20);
  });
  it("draws nothing without a target", () => {
    expect(panelCells(3, 2, 475, null)).toBeNull();
  });
});
