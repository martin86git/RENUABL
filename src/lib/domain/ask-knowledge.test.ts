import { describe, expect, it } from "vitest";
import { ASK_FACTS, askSystemPrompt, cleanAskInput, describeSnapshot } from "./ask-knowledge";

describe("Ask RENUABL grounding", () => {
  it("knows flat roofs are tilted and the frames are in the price", () => {
    expect(ASK_FACTS.join(" ")).toMatch(/flat roof.*tilt frames at 10–15°.*included in the price/i);
    expect(describeSnapshot({ roof: "flat" })[0]).toMatch(/tilt frames, included in the price/);
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
