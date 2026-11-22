import { describe, expect, it } from "vitest";
import { numberStandingWords, phoneFacts, voiceTerms } from "./add-ons";
import { coachPrompt } from "./coaching";

describe("what a business is told before adding Calls & Texts", () => {
  it("says when billing starts, with the next bill day when known", () => {
    const lines = voiceTerms("2026-12-05T00:00:00Z");
    expect(lines[0]).toContain("Billing starts today");
    expect(lines[0]).toContain("on 5 December");
    expect(lines[0]).toContain("$49 each month");
    expect(voiceTerms(null)[0]).toContain("next bill, then");
  });

  it("says what a call costs and that the number comes with it", () => {
    const all = voiceTerms().join(" ");
    expect(all).toContain("no charge per call");
    expect(all).toContain("60 voice-agent minutes and 250 texts");
    expect(all).toContain("a minute takes 3 Sol credits and a text 1");
    expect(all).toContain("business number comes with it");
  });
});

describe("where the business's number stands", () => {
  it("names the number, the button, or that RENUABL is setting it up", () => {
    expect(numberStandingWords({ number: "0480 123 456", canBuy: false })).toContain("0480 123 456");
    expect(numberStandingWords({ number: null, canBuy: true })).toContain("Get my business number");
    const pending = numberStandingWords({ number: null, canBuy: false });
    expect(pending).toContain("being set up by RENUABL");
    expect(pending).toContain("test and training calls");
  });
});

describe("what a voice agent can say about its phone line", () => {
  it("tells a business without the add-on how to add it and what it costs", () => {
    const facts = phoneFacts({ standing: "add-on", number: null, canBuy: false }).join(" ");
    expect(facts).toContain("Add to your plan");
    expect(facts).toContain("$49 a month");
    expect(facts).toContain("asked for automatically");
  });

  it("tells a business waiting on its number that tests work and customers can't be rung yet", () => {
    const facts = phoneFacts({ standing: "number", number: null, canBuy: false }).join(" ");
    expect(facts).toContain("customers can't be rung");
    expect(facts).toContain("Test call and Train");
  });

  it("reaches the agent's chat as facts to answer from", () => {
    const prompt = coachPrompt({
      assistant: "Charlie",
      business: "Sunrise Solar",
      notes: [],
      history: [],
      message: "how do i obtain a phone number",
      phone: phoneFacts({ standing: "add-on", number: null, canBuy: false }),
    });
    expect(prompt).toContain("Your phone line, the price and billing");
    expect(prompt).toContain("Add to your plan");
    expect(coachPrompt({ assistant: "Charlie", business: "Sunrise Solar", notes: [], history: [], message: "hi" })).not.toContain(
      "Your phone line, the price and billing",
    );
  });
});
