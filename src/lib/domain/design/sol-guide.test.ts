import { describe, expect, it } from "vitest";
import { guideStep, guiding, panelsFor, reachedWords, targetWords, type GuideFacts } from "./sol-guide";

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
  it("then the inverter, the strings, the battery and backup, passing over what's done", () => {
    const done = ["home", "target", "panel", "place", "reached"] as const;
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
