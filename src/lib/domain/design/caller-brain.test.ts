import { describe, expect, it } from "vitest";
import { BRAIN_MODELS, BRAIN_WORDS, CALLER_BRAINS, cleanBrain, modelOfBrain } from "./caller";

describe("each voice agent's model", () => {
  it("takes only the two choices, else the default", () => {
    expect(cleanBrain("quick")).toBe("quick");
    expect(cleanBrain("careful")).toBe("careful");
    expect(cleanBrain("claude-opus-5-5")).toBeNull();
    expect(cleanBrain(null)).toBeNull();
    expect(cleanBrain(3)).toBeNull();
  });

  it("runs quicker on Haiku and more careful on Sonnet, else the site's model", () => {
    expect(BRAIN_MODELS).toEqual({ quick: "claude-haiku-5-5", careful: "claude-sonnet-5" });
    expect(modelOfBrain("careful", "claude-haiku-5-5")).toBe("claude-sonnet-5");
    expect(modelOfBrain(null, "site-model")).toBe("site-model");
  });

  it("says each choice in plain words, never a model's name", () => {
    for (const key of [...CALLER_BRAINS, "default"] as const) {
      const [label, what] = BRAIN_WORDS[key];
      expect(label.length).toBeGreaterThan(0);
      expect(`${label} ${what}`).not.toMatch(/claude|haiku|sonnet|AI/i);
    }
  });
});
