import { describe, expect, it } from "vitest";
import { ASK_FACTS, askSystemPrompt, cleanAskInput, describeSnapshot } from "./ask-knowledge";

describe("Ask RENUABL grounding", () => {
  it("knows flat roofs can be laid flat or tilted, and tilting is checked on the call", () => {
    const facts = ASK_FACTS.join(" ");
    expect(facts).toMatch(/laid flat \(the default/);
    expect(facts).toMatch(/room for all the panels tilted/);
    expect(facts).toMatch(/seen from the street/);
    expect(describeSnapshot({ roof: "flat", flatMount: "tilt" })[0]).toBe("Roof: flat, panels tilted (if the roof has room)");
    expect(describeSnapshot({ roof: "flat" })[0]).toBe("Roof: flat, panels laid flat");
  });

  it("puts the customer's answers and the rules in the prompt", () => {
    const prompt = askSystemPrompt("profile", { suburb: "Glen Waverley", state: "VIC", roof: "flat", priceAfterRebates: 10871 });
    expect(prompt).toContain("Glen Waverley, VIC");
    expect(prompt).toContain("$10,871");
    expect(prompt).toContain("About your home");
    expect(prompt).toMatch(/Never call yourself an AI/);
    expect(prompt).toMatch(/never say anything is exact/i);
  });

  it("says when there are no answers yet", () => {
    expect(askSystemPrompt("home", {})).toContain("hasn't given any details yet");
  });

  it("limits questions and history", () => {
    expect(cleanAskInput({ question: " " })).toBeNull();
    const long = cleanAskInput({
      question: "x".repeat(900),
      history: Array(8)
        .fill({ q: "a", a: "b" })
        .concat([{ q: 1 }]),
    })!;
    expect(long.question).toHaveLength(500);
    expect(long.history).toHaveLength(4);
  });
});
