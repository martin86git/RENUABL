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
    expect(shown).toBe(firstMessage(brief({ audience: "cold" })));
  });

  it("never asks for anyone by name on a cold call", () => {
    const b = brief({ audience: "cold", reason: "to ask whether you've thought about a battery" });
    expect(firstMessage(b)).toBe(
      "Hi, it's Charlie, Star Solar's automated assistant, calling to ask whether you've thought about a battery. Have you got a minute?",
    );
    expect(openingParts(b).ask).toBeNull();
    expect([firstMessage(b), screeningAnswer(b), voicemailMessage(b)].join(" ")).not.toContain("Sam");
    expect(voiceSystemPrompt(b, [], { canTransfer: false })).toContain("Never open by asking for anyone by name");
  });

  it("opens the way the script says, still saying who it is and that it's automated", () => {
    const scripted = voiceSystemPrompt(brief({ audience: "cold", coaching: ["On cold calls, open by asking about a battery."] }), [], {
      canTransfer: false,
    });
    expect(scripted).toContain("The script's own opening");
    expect(scripted).toContain("that is your opening");
    expect(scripted).toContain("that you're automated");
    expect(scripted).toContain("you never ask for anyone by name");
    // An enquiry call's script may set the opening too, but the wait for an answer stays.
    const enquiry = voiceSystemPrompt(brief({ locked: ["Open by thanking them for their enquiry."] }), [], { canTransfer: false });
    expect(enquiry).toContain("you still wait for them to answer before going on");
    // With no script, and on calls the script isn't for, the opening stays as given.
    expect(voiceSystemPrompt(brief(), [], { canTransfer: false })).not.toContain("The script's own opening");
    expect(voiceSystemPrompt(brief({ mode: "proposal", coaching: ["Open warmly."] }), [], { canTransfer: false })).not.toContain(
      "The script's own opening",
    );
  });
});

describe("the call's objective (26 Nov 2026)", () => {
  it("reads only an objective it knows, none otherwise", async () => {
    const { cleanCallSetup, cleanObjective } = await import("./call-setup");
    expect(cleanObjective("visit")).toBe("visit");
    expect(cleanObjective("sell them a car")).toBe("none");
    expect(cleanCallSetup({ objective: "close" }).objective).toBe("close");
    expect(cleanCallSetup({}).objective).toBeUndefined();
  });

  it("says nothing with none, and never lets a visit or install day be promised", async () => {
    const { objectiveLine } = await import("./call-setup");
    expect(objectiveLine("none", { canBook: true, business: "Sunrise" })).toBe("");
    expect(objectiveLine(undefined, { canBook: true, business: "Sunrise" })).toBe("");
    expect(objectiveLine("visit", { canBook: true, business: "Sunrise" })).toMatch(/can.t book it yourself[\s\S]*Never promise/);
    expect(objectiveLine("install", { canBook: true, business: "Sunrise" })).toMatch(/Never promise a date/);
    expect(objectiveLine("call", { canBook: true, business: "Sunrise" })).toMatch(/book them a call appointment/);
    expect(objectiveLine("call", { canBook: false, business: "Sunrise" })).toMatch(/request_callback/);
    expect(objectiveLine("close", { canBook: false, business: "Sunrise" })).toMatch(/Never change, discount or agree/);
  });
});

describe("the objective on a call", () => {
  const prompt = (over: Partial<CallBrief>) => voiceSystemPrompt(brief(over), [], { canTransfer: false });
  it("goes into the instructions of the business's own calls only", () => {
    expect(prompt({ objective: "visit" })).toMatch(/Your objective on this call: arrange a home visit/);
    expect(prompt({ objective: "none" })).not.toMatch(/Your objective on this call/);
    expect(prompt({ objective: "visit", teamAbout: "their invoice" })).not.toMatch(/Your objective on this call/);
  });
});
