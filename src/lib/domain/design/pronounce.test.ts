import { describe, expect, it } from "vitest";
import {
  cleanPronunciations,
  pronounceNote,
  pronounceProblem,
  pronounceReplacements,
  withPronunciations,
  PRONOUNCE_LIMITS,
} from "./pronounce";
import { assistantConfig, withoutSpeedSettings, type CallBrief } from "../voice-agent";

describe("the words list", () => {
  it("keeps whole entries, each word once, none said as spelled, nothing but words", () => {
    expect(
      cleanPronunciations([
        { word: " Solar ", say: "Sola" },
        { word: "solar", say: "Soh-lah" },
        { word: "Sigenergy", say: "sigenergy" },
        { word: "<b>", say: "bee" },
        { word: "Fronius", say: "" },
        { word: "O'Brien", say: "Oh Bry-en" },
        "nonsense",
      ]),
    ).toEqual([
      { word: "Solar", say: "Sola" },
      { word: "O'Brien", say: "Oh Bry-en" },
    ]);
    expect(cleanPronunciations("nope")).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => ({ word: `word${i}`, say: `said${i}` }));
    expect(cleanPronunciations(many)).toHaveLength(PRONOUNCE_LIMITS.words);
  });

  it("says why an entry can't be added", () => {
    const list = [{ word: "Solar", say: "Sola" }];
    expect(pronounceProblem({ word: "", say: "x" }, list)).toMatch(/Type the word/);
    expect(pronounceProblem({ word: "solar", say: "Soh-lah" }, list)).toMatch(/already/);
    expect(pronounceProblem({ word: "Tesla", say: "tesla" }, list)).toMatch(/differently/);
    expect(pronounceProblem({ word: "Tesla", say: "Tez-la" }, list)).toBeNull();
  });
});

describe("on a call", () => {
  const list = [{ word: "Solar", say: "Sola" }];

  it("tells the agent to write each word the way it's said", () => {
    expect(pronounceNote([])).toBe("");
    expect(pronounceNote(list)).toContain(`"Solar" → write "Sola"`);
  });

  it("gives the voice each word in its usual cases", () => {
    expect(pronounceReplacements(list)).toEqual([
      { type: "exact", key: "Solar", value: "Sola" },
      { type: "exact", key: "solar", value: "sola" },
      { type: "exact", key: "SOLAR", value: "Sola" },
    ]);
    expect(withPronunciations({ provider: "vapi" }, [])).toEqual({ provider: "vapi" });
  });

  const brief: CallBrief = {
    mode: "lead",
    assistant: "Alice",
    business: "Sunny Co",
    firstName: "Sam",
    about: [],
    asked: false,
    canBook: false,
    canSendLink: false,
    hasEmail: false,
    pronounce: list,
  };
  const config = (b: CallBrief) =>
    assistantConfig({
      brief: b,
      slots: [],
      serverUrl: "https://x.example",
      secret: "s",
      model: "m",
      voice: { provider: "vapi", voiceId: "Elliot" },
    });

  it("carries the list in the rules and on the voice, and a call without one is as before", () => {
    const with_ = config(brief);
    expect(with_.model.messages[0].content).toContain(`"Solar" → write "Sola"`);
    expect((with_.voice as { chunkPlan?: unknown }).chunkPlan).toBeDefined();
    const without = config({ ...brief, pronounce: [] });
    expect(without.model.messages[0].content).not.toContain("said differently from how they're spelled");
    expect((without.voice as { chunkPlan?: unknown }).chunkPlan).toBeUndefined();
  });

  it("drops the voice's swaps on the second try Vapi turns a call away (the rule in the instructions stays)", () => {
    const again = withoutSpeedSettings(config(brief) as unknown as Record<string, unknown>);
    expect((again.voice as { chunkPlan?: unknown }).chunkPlan).toBeUndefined();
  });
});
