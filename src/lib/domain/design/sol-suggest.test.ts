import { describe, expect, it } from "vitest";
import { SOL_SUGGESTED, SOL_TOPICS, solGreeting, topicOf } from "./sol-suggest";

describe("Sol's suggestions", () => {
  it("has four topics, each with three prompts, none repeated", () => {
    expect(SOL_TOPICS).toHaveLength(4);
    for (const t of SOL_TOPICS) expect(t.prompts).toHaveLength(3);
    const all = SOL_TOPICS.flatMap((t) => t.prompts);
    expect(new Set(all).size).toBe(all.length);
  });
  it("finds a topic by its id, else nothing", () => {
    expect(topicOf("summarise")?.label).toBe("Summarise");
    expect(topicOf("nope")).toBeNull();
    expect(topicOf(null)).toBeNull();
  });
  it("suggests five short prompts", () => {
    expect(SOL_SUGGESTED).toHaveLength(5);
    for (const s of SOL_SUGGESTED) expect(s.length).toBeLessThan(90);
  });
  it("greets by first name only once given", () => {
    expect(solGreeting("Martin")).toBe("Ready when you are, Martin");
    expect(solGreeting("  Jo Smith ")).toBe("Ready when you are, Jo");
    expect(solGreeting("")).toBe("Ready when you are");
    expect(solGreeting(undefined)).toBe("Ready when you are");
  });
});
