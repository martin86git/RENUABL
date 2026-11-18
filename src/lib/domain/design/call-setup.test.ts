import { describe, expect, it } from "vitest";
import { firstMessage, openingParts, screeningAnswer, voicemailMessage, voiceSystemPrompt, type CallBrief } from "../voice-agent";
import { installFirstMessage } from "../install-call";
import {
  DEFAULT_CALL_SETUP,
  USUAL_REASON,
  cleanCallSetup,
  cleanReason,
  cleanSaidAs,
  openingPreview,
  reasonWords,
  sayName,
  sayNameNote,
  usualCalls,
} from "./call-setup";

const brief = (over: Partial<CallBrief> = {}): CallBrief => ({
  mode: "lead",
  assistant: "Charlie",
  business: "Star Solar",
  firstName: "Sam",
  about: ["Looking for: solar and a battery"],
  asked: false,
  canBook: false,
  canSendLink: false,
  hasEmail: false,
  ...over,
});

describe("how the agent's name is said", () => {
  it("keeps only what a voice can say", () => {
    expect(cleanSaidAs("  Shar-lee  ")).toBe("Shar-lee");
    expect(cleanSaidAs("Sh@r<lee>1")).toBe("Shrlee");
    expect(cleanSaidAs(42)).toBe("");
  });

  it("says the name as spelled until a said-as form is set", () => {
    expect(sayName({ assistant: "Charlie" })).toBe("Charlie");
    expect(sayName({ assistant: "Charlie", assistantSaid: "Shar-lee" })).toBe("Shar-lee");
    expect(sayName({ assistant: "" })).toBe("Sol");
    expect(sayNameNote({ assistant: "Charlie" })).toBe("");
    expect(sayNameNote({ assistant: "Charlie", assistantSaid: "charlie" })).toBe("");
  });

  it("puts the said form in every line the voice reads, and tells the agent the spelling", () => {
    const b = brief({ assistantSaid: "Shar-lee" });
    expect(firstMessage(b)).toContain("It's Shar-lee, Star Solar's automated assistant");
    expect(firstMessage(b)).not.toContain("Charlie");
    expect(screeningAnswer(b)).toContain("Shar-lee");
    expect(voicemailMessage(b)).toContain("Shar-lee");
    expect(installFirstMessage(b)).toContain("Shar-lee");
    const prompt = voiceSystemPrompt(b, [], { canTransfer: false });
    expect(prompt).toContain(`Your name is spelled "Charlie" and said "Shar-lee"`);
    expect(prompt.startsWith("You are Shar-lee,")).toBe(true);
  });
});

describe("the reason for the call", () => {
  it("is made to read on after calling", () => {
    expect(cleanReason("I'm calling about your roof.")).toBe("about your roof");
    expect(cleanReason("your solar enquiry")).toBe("about your solar enquiry");
    expect(cleanReason("To see if a battery suits you")).toBe("to see if a battery suits you");
    expect(cleanReason("  ")).toBe("");
    expect(cleanReason("<b>about</b> {x}")).not.toMatch(/[<>{}]/);
  });

  it("is the usual one until typed, for whoever it rings", () => {
    expect(reasonWords(null)).toBe(USUAL_REASON.enquired);
    expect(reasonWords({ audience: "cold", reason: "" })).toBe(USUAL_REASON.cold);
    expect(reasonWords({ audience: "enquired", reason: "the battery offer" })).toBe("about the battery offer");
    expect(usualCalls(DEFAULT_CALL_SETUP)).toBe(true);
    expect(usualCalls({ audience: "cold", reason: "" })).toBe(false);
  });

  it("cleans whatever is sent to a whole setup", () => {
    expect(cleanCallSetup(null)).toEqual(DEFAULT_CALL_SETUP);
    expect(cleanCallSetup({ saidAs: "Shar-lee", audience: "nonsense", reason: "your roof" })).toEqual({
      saidAs: "Shar-lee",
      audience: "enquired",
      reason: "about your roof",
    });
  });

  it("leaves the calls exactly as they were when nothing is set", () => {
    const b = brief();
    expect(firstMessage(b)).toBe(
      "Hi, is that Sam? It's Charlie, Star Solar's automated assistant, calling about the solar enquiry you made on our website. Have you got a few minutes?",
    );
    expect(screeningAnswer(b)).toContain("about their solar enquiry");
    expect(voicemailMessage(b)).toContain("about your solar enquiry");
    expect(voiceSystemPrompt(b, [], { canTransfer: false })).toContain("agreed to be contacted");
  });

  it("opens with the business's own reason, still as two turns", () => {
    const b = brief({ reason: "about the battery rebate" });
    expect(openingParts(b)).toEqual({
      ask: "Hi, is that Sam?",
      then: "It's Charlie, Star Solar's automated assistant, calling about the battery rebate. Have you got a few minutes?",
    });
    expect(voicemailMessage(b)).toContain("calling about the battery rebate");
    expect(voicemailMessage(b)).not.toContain("enquiry");
  });

  it("never says a cold call's person enquired", () => {
    const b = brief({ audience: "cold" });
    const all = [firstMessage(b), screeningAnswer(b), voicemailMessage(b)].join(" ");
    expect(all).not.toMatch(/enquir/i);
    expect(all).toContain("automated assistant");
    const prompt = voiceSystemPrompt(b, [], { canTransfer: false });
    expect(prompt).toContain("has NOT been in touch");
    expect(prompt).toContain("Never say or imply that they enquired");
    expect(prompt).toContain("no_more_calls");
    expect(prompt).not.toContain("agreed to be contacted");
    // Every rule still stands.
    expect(prompt).toContain("You are an automated assistant.");
  });

  it("keeps a call they asked for, a call back, a proposal call and one that came in as they were", () => {
    const set = { audience: "cold" as const, reason: "about the battery rebate" };
    expect(firstMessage(brief({ ...set, asked: true }))).toContain("You said yes to a call");
    expect(firstMessage(brief({ ...set, teamAsk: "Confirm the roof" }))).toContain("one quick question from the team");
    expect(firstMessage(brief({ ...set, mode: "proposal" }))).toContain("the solar proposal we sent you");
    expect(firstMessage(brief({ ...set, inbound: true }))).toContain("thanks for calling");
    expect(voiceSystemPrompt(brief({ ...set, mode: "proposal" }), [], { canTransfer: false })).not.toContain("has NOT been in touch");
  });

  it("shows the opening the call is given", () => {
    const shown = openingPreview({ name: "Charlie", saidAs: "", business: "Star Solar", audience: "cold", reason: "" });
    expect(shown).toContain(firstMessage(brief({ audience: "cold" })).replace("Hi, is that Sam? ", ""));
  });
});
