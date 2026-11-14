import { describe, expect, it } from "vitest";
import { assistantConfig, voiceSystemPrompt } from "../voice-agent";
import { isPracticeRef, PRACTICE_ID, practiceBlock, practiceBrief, practicePlacedWords } from "./practice-call";

describe("a practice call with the phone assistant", () => {
  const brief = practiceBrief({ assistant: "Charlie", business: "RENUABL", memberFirstName: "Martin", coaching: ["Pause after hello."] });

  it("rings the member as a new lead, with the coaching, and can't book or send anything", () => {
    expect(brief.mode).toBe("lead");
    expect(brief.firstName).toBe("Martin");
    expect(brief.canBook).toBe(false);
    expect(brief.canSendLink).toBe(false);
    expect(brief.coaching).toEqual(["Pause after hello."]);
    const prompt = voiceSystemPrompt(brief, [], { canTransfer: false });
    expect(prompt).toContain("Pause after hello.");
  });

  it("tells the assistant its tools aren't connected and to say what it would do", () => {
    const b = practiceBlock({ memberFirstName: "Martin", business: "RENUABL" });
    expect(b).toContain("practice call");
    expect(b).toContain("Martin from RENUABL");
    expect(b).toContain("tools aren't connected");
    expect(b).toContain("end the call");
  });

  it("keeps the full call's rules: it waits for the other end and keeps no audio", () => {
    const a = assistantConfig({ brief, slots: [], serverUrl: "u", secret: "s", model: "m" });
    expect(a.artifactPlan).toEqual({ recordingEnabled: false });
    expect(a.firstMessageMode).toBe("assistant-waits-for-user");
  });

  it("knows its own references and never looks like a deal", () => {
    expect(isPracticeRef("pc_0123456789abcdef")).toBe(true);
    expect(isPracticeRef("vc_0123456789abcdef")).toBe(false);
    expect(isPracticeRef("pc_../x")).toBe(false);
    expect(PRACTICE_ID.startsWith("job_")).toBe(false);
    expect(practicePlacedWords("Charlie")).toContain("Charlie is ringing your mobile");
  });
});
