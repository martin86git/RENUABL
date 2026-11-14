import { describe, expect, it } from "vitest";
import { JOB_STAGES } from "./crm";
import { stagePill } from "./deal-feed";

describe("a stage's pill", () => {
  it("gives a lead the blue New lead pill, as To action does", () => {
    expect(stagePill("lead")).toEqual({ words: "New lead", tone: "lead" });
  });

  it("gives the stages being sold and heading to install a colour each", () => {
    const tones = (["lead", "designed", "proposal", "won", "ordered", "scheduled"] as const).map((s) => stagePill(s).tone);
    expect(new Set(tones).size).toBe(tones.length);
  });

  it("has words for every stage", () => {
    for (const s of JOB_STAGES) expect(stagePill(s).words.length).toBeGreaterThan(0);
  });
});
