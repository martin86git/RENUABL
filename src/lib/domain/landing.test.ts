import { describe, expect, it } from "vitest";
import { LANDING_PAGES, landingLabel } from "./landing";

describe("ad landing pages", () => {
  const pages = Object.values(LANDING_PAGES);

  it("never claims more than we can show (Australian Consumer Law)", () => {
    for (const p of pages) {
      const text = JSON.stringify(p).toLowerCase();
      for (const word of ["exact", "precise", "guarantee", "best", "first", "leading", "installer", " ai "])
        expect(text).not.toContain(word);
      // No dollar figures, cents or rebate amounts.
      expect(text).not.toMatch(/\$\s?\d|\d+\s?c\b|\d+%/);
    }
  });

  it("keeps each page's path and label", () => {
    expect(LANDING_PAGES.battery.path).toBe("/battery");
    expect(landingLabel("battery")).toBe("Got solar? Add a battery");
    expect(landingLabel(null)).toBeUndefined();
  });
});
