import { describe, expect, it } from "vitest";
import { QUOTE_COPY, cleanQuoteAnswers, profileFromQuote, quickEstimate, quoteAnswerLines } from "./quick-quote";

describe("quick quote landing page", () => {
  it("gives an indicative saving from the spend range, more with a battery", () => {
    const solar = quickEstimate({ interest: "solar-only", period: "monthly", band: "high" })!;
    const both = quickEstimate({ interest: "solar-battery", period: "monthly", band: "high" })!;
    expect(solar.amount).toBeGreaterThan(0);
    expect(both.amount).toBeGreaterThan(solar.amount);
    expect(both.amount % 50).toBe(0);
    expect(both.withBattery).toBe(true);
  });

  it("shows no figure for a battery on existing solar, or without a bill range", () => {
    expect(quickEstimate({ interest: "battery-existing", period: "monthly", band: "high" })).toBeNull();
    expect(quickEstimate({ interest: "solar-battery" })).toBeNull();
  });

  it("starts the plan wanting a battery unless they chose solar only", () => {
    expect(profileFromQuote({ interest: "unsure" }).wantsBattery).toBe(true);
    expect(profileFromQuote({ interest: "solar-only" }).wantsBattery).toBe(false);
  });

  it("keeps only known answers from the browser, and flags renters for staff", () => {
    expect(cleanQuoteAnswers({ interest: "hack", band: "high", period: "monthly", owner: false, extra: 1 })).toEqual({
      band: "high",
      period: "monthly",
      owner: false,
    });
    expect(quoteAnswerLines({ owner: false })["Owns the home"]).toContain("NO");
    expect(quoteAnswerLines({ interest: "solar-battery", period: "quarterly", band: "medium" })["Shown on screen"]).toContain("INDICATIVE");
  });

  it("never claims more than we can show (Australian Consumer Law)", () => {
    const text = JSON.stringify(QUOTE_COPY).toLowerCase();
    for (const word of ["exact", "precise", "guarantee", "best", "installer", " ai "]) expect(text).not.toContain(word);
    expect(text).toContain("indicative");
  });
});
