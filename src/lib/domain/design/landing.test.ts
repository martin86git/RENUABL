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

  it("marks what isn't built yet as coming soon", () => {
    const soon = [...AUTOMATIONS, ...AFTER_STEPS].filter((f) => f.status === "soon").map((f) => f.key);
    expect(soon).toEqual(["battery", "strings", "send-order", "invoices", "scheduler"]);
  });
});
