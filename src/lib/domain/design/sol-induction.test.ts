import { describe, expect, it } from "vitest";
import {
  ASK_EACH_TIME,
  INDUCTION_QUESTIONS,
  agentVoice,
  callVoice,
  callVoiceBlock,
  asksScope,
  cleanInduction,
  cleanLearnAsk,
  inductionPrefId,
  keptFor,
  learnRefusal,
  learnedPref,
  prefsBlock,
  questionByKey,
  questionsFor,
  voiceBlock,
  withKeptPref,
} from "./sol-induction";
import { practiceBrief } from "./practice-call";
import { voiceSystemPrompt } from "../voice-agent";
import { installSystemPrompt } from "../install-call";

const now = new Date("2026-11-20T03:00:00Z");

describe("Sol's induction questions", () => {
  it("asks the twelve, each with a unique key and a kept preference", () => {
    expect(INDUCTION_QUESTIONS).toHaveLength(12);
    expect(new Set(INDUCTION_QUESTIONS.map((q) => q.key)).size).toBe(12);
    for (const q of INDUCTION_QUESTIONS) expect(q.keep(q.options[0] ?? "something").length).toBeGreaterThan(5);
  });

  it("leaves the customer questions out for staff once the owner set them for everyone", () => {
    const staff = questionsFor({ owner: false, scope: "all" });
    expect(staff.every((q) => q.scope === "person")).toBe(true);
    expect(questionsFor({ owner: false, scope: "own" })).toHaveLength(12);
    expect(questionsFor({ owner: false, scope: null })).toHaveLength(12);
    expect(questionsFor({ owner: true, scope: "all" })).toHaveLength(12);
  });

  it("asks the owner whether their answers are for everyone, once", () => {
    expect(asksScope({ owner: true, scope: null })).toBe(true);
    expect(asksScope({ owner: true, scope: "own" })).toBe(false);
    expect(asksScope({ owner: false, scope: null })).toBe(false);
  });

  it("keeps the owner's customer answers for the business only when set for everyone", () => {
    const tone = questionByKey("tone")!;
    const name = questionByKey("name")!;
    expect(keptFor(tone, { owner: true, scope: "all" })).toBe("business");
    expect(keptFor(tone, { owner: true, scope: "own" })).toBe("person");
    expect(keptFor(tone, { owner: false, scope: "all" })).toBe("person");
    expect(keptFor(name, { owner: true, scope: "all" })).toBe("person");
  });

  it("replaces an answer given again rather than adding a second", () => {
    const id = inductionPrefId("tone");
    const once = withKeptPref([], id, "Formal.", now);
    const twice = withKeptPref(once, id, "Warm and chatty.", now);
    expect(twice).toEqual([{ id, text: "Warm and chatty.", at: now.toISOString() }]);
  });

  it("reads a stored induction safely", () => {
    expect(cleanInduction(null)).toEqual({ status: "pending", asked: [] });
    expect(cleanInduction({ status: "done", asked: ["Think It Over", "think-it-over", 4] })).toEqual({
      status: "done",
      asked: ["think-it-over"],
    });
  });
});

describe("learning in the moment", () => {
  const raw = {
    key: "Think it over",
    when: "When a customer wants time to think",
    question: "Would you generally like me to:",
    options: ["Give them space", "Book a follow-up call", "Ask me each time", "Give them space"],
    context: "replying to Michelle",
  };

  it("cleans his question: a key, no repeats and never his own Ask me each time", () => {
    const ask = cleanLearnAsk(raw)!;
    expect(ask.key).toBe("think-it-over");
    expect(ask.options).toEqual(["Give them space", "Book a follow-up call"]);
    expect(cleanLearnAsk({ ...raw, options: ["Only one"] })).toBeNull();
  });

  it("asks at most once a conversation, never a topic twice, never in a shared channel", () => {
    const ask = cleanLearnAsk(raw)!;
    expect(learnRefusal(ask, { asked: [], askedThisChat: false, shared: false })).toBeNull();
    expect(learnRefusal(ask, { asked: [], askedThisChat: true, shared: false })).toMatch(/already/);
    expect(learnRefusal(ask, { asked: ["think-it-over"], askedThisChat: false, shared: false })).toMatch(/before/);
    expect(learnRefusal(ask, { asked: [], askedThisChat: false, shared: true })).toMatch(/own conversation/);
  });

  it("keeps the press as a preference", () => {
    const ask = cleanLearnAsk(raw)!;
    expect(learnedPref(ask, "Book a follow-up call")).toBe("When a customer wants time to think: book a follow-up call.");
    expect(learnedPref(ask, ASK_EACH_TIME)).toBe("When a customer wants time to think: ask me each time.");
  });
});

describe("what Sol and his agents read", () => {
  const biz = [{ id: "in-tone", text: "When writing to customers, be formal.", at: now.toISOString() }];
  const own = [{ id: "in-answers", text: "How I like answers: short.", at: now.toISOString() }];

  it("puts the owner's for everyone first and says the person's own win", () => {
    const block = prefsBlock(biz, own);
    expect(block.indexOf("Set by the owner")).toBeLessThan(block.indexOf("This person's own"));
    expect(block).toMatch(/win where they differ/);
    expect(prefsBlock([], [])).toBe("- none yet");
  });

  it("gives agents the business's voice, else the owner's own customer answers, never the sign-off", () => {
    expect(agentVoice(biz, own)).toEqual(["When writing to customers, be formal."]);
    const ownerOwn = [
      { id: "in-price", text: "Talking price: lead with the saving.", at: now.toISOString() },
      { id: "in-signoff", text: "Sign off customer emails like this: Cheers.", at: now.toISOString() },
      ...own,
    ];
    expect(agentVoice([], ownerOwn)).toEqual(["Talking price: lead with the saving."]);
    expect(voiceBlock([])).toBe("");
    expect(voiceBlock(["Be formal."])).toMatch(/rule above still comes first/);
  });
});

describe("the voice agents", () => {
  const at = now.toISOString();
  const owner = [
    { id: "in-tone", text: "When writing to customers, be friendly but brief.", at },
    { id: "in-price", text: "Talking price: lead with the saving.", at },
    { id: "in-never", text: "Never: mention finance", at },
    { id: "in-nudge", text: "Follow up a quiet proposal weekly.", at },
    { id: "in-signoff", text: "Sign off customer emails like this: Cheers.", at },
  ];

  it("follow only what applies to a call: how to come across, price talk and the never-do's", () => {
    expect(callVoice(owner, [])).toEqual([
      "With customers, be friendly but brief.",
      "Talking price: lead with the saving.",
      "Never: mention finance",
    ]);
    expect(callVoice([], owner)).toHaveLength(3);
    expect(callVoice([], [])).toEqual([]);
  });

  it("are told the rules still come first", () => {
    expect(callVoiceBlock([])).toBe("");
    expect(callVoiceBlock(["Never: mention finance"])).toMatch(/every rule above still comes first/);
  });

  it("carry them on every kind of call, after the rules", () => {
    const style = callVoice(owner, []);
    const brief = {
      ...practiceBrief({ assistant: "Charlie", business: "Sunrise Solar", memberFirstName: "Sam", coaching: [] }),
      houseStyle: style,
    };
    const sales = voiceSystemPrompt(brief, [], { canTransfer: false });
    expect(sales).toContain("Never: mention finance");
    expect(sales.indexOf("Rules you always keep")).toBeLessThan(sales.indexOf("Never: mention finance"));
    expect(installSystemPrompt({ ...brief, mode: "install" }, [], { canTransfer: false })).toContain("lead with the saving");
    expect(
      practiceBrief({ assistant: "Charlie", business: "Sunrise Solar", memberFirstName: "Sam", coaching: [], houseStyle: style })
        .houseStyle,
    ).toEqual(style);
  });
});
