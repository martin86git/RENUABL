import { describe, expect, it } from "vitest";
import { linesFromVapi, transcriptFor, type CallTranscript } from "./call-transcript";
import { recordingLine } from "./browser-call";

describe("Vapi's transcript as lines", () => {
  it("marks each side and joins a side's runs", () => {
    expect(linesFromVapi("AI: Hi Jo, it's Charlie.\nAI: Is now a good time?\nUser: Yes.\n  carried on\n\nUser: Go ahead")).toEqual([
      { role: "assistant", text: "Hi Jo, it's Charlie. Is now a good time?" },
      { role: "customer", text: "Yes. carried on Go ahead" },
    ]);
    expect(linesFromVapi("")).toEqual([]);
    expect(linesFromVapi("no speaker here")).toEqual([]);
  });
});

describe("which transcript goes with an entry on the timeline", () => {
  const assistantCall = (id: string, at: string): CallTranscript => ({
    id,
    at,
    kind: "assistant",
    lines: [{ role: "assistant", text: "Hi" }],
  });
  const list: CallTranscript[] = [
    assistantCall("vce_a", "2026-11-12T03:00:00.000Z"),
    assistantCall("vce_b", "2026-11-12T03:20:00.000Z"),
    { id: "bc_0123456789abcdef01234567", at: "2026-11-12T03:21:00.000Z", kind: "computer", lines: [{ role: "customer", text: "Hello" }] },
  ];

  it("takes the assistant's call that ended nearest the entry, within a few minutes", () => {
    expect(transcriptFor({ text: "Booked a call", at: "2026-11-12T03:00:04.000Z" }, "assistant", list)?.id).toBe("vce_a");
    expect(transcriptFor({ text: "Talked", at: "2026-11-12T03:19:30.000Z" }, "assistant", list)?.id).toBe("vce_b");
    expect(transcriptFor({ text: "Talked", at: "2026-11-12T05:00:00.000Z" }, "assistant", list)).toBeNull();
  });

  it("finds a computer call by the recording its entry names, never by time", () => {
    const text = `Called from the computer · 2 min\n${recordingLine("bc_0123456789abcdef01234567")}`;
    expect(transcriptFor({ text, at: "2026-11-12T09:00:00.000Z" }, "computer", list)?.kind).toBe("computer");
    expect(transcriptFor({ text: "Called from the computer · no answer", at: "2026-11-12T03:21:00.000Z" }, "computer", list)).toBeNull();
  });
});
