import { describe, expect, it } from "vitest";
import { AFTER_STEPS, AUTOMATIONS, landingCopy } from "./landing";

describe("the roof designer's front page", () => {
  it("makes no claim the product can't prove", () => {
    for (const line of landingCopy())
      expect(line).not.toMatch(/\b(best|leading|first|#1|number one|guaranteed?|exact|precise|AI|artificial intelligence)\b/i);
  });

  it("names no other product", () => {
    for (const line of landingCopy()) expect(line).not.toMatch(/pylon|opensolar|solargraf|aurora/i);
  });

  it("shows only what the product does today", () => {
    expect([...AUTOMATIONS, ...AFTER_STEPS].filter((f) => f.status !== "live")).toEqual([]);
  });
});
