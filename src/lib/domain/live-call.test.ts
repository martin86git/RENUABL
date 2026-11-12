import { describe, expect, it } from "vitest";
import { clockWords, joinRuns, livePhase, phaseWords, readLiveEvent } from "./live-call";
import { assistantConfig, type CallBrief } from "./voice-agent";

const msg = (message: Record<string, unknown>) => ({ message: { call: { id: "vapi_1" }, ...message } });

describe("Vapi's messages for the live view", () => {
  it("reads the call's status", () => {
    expect(readLiveEvent(msg({ type: "status-update", status: "in-progress" }))).toEqual({
      kind: "status",
      callId: "vapi_1",
      status: "in-progress",
    });
    expect(readLiveEvent(msg({ type: "status-update", status: "made-up" }))).toBeNull();
  });

  it("reads what is said, by whom, and whether it's said in full", () => {
    expect(readLiveEvent(msg({ type: "transcript", role: "assistant", transcriptType: "final", transcript: " Hi  Jo, " }))).toEqual({
      kind: "line",
      callId: "vapi_1",
      role: "assistant",
      text: "Hi Jo,",
      final: true,
    });
    expect(readLiveEvent(msg({ type: "transcript", role: "user", transcriptType: "partial", transcript: "Who's" }))).toMatchObject({
      role: "customer",
      final: false,
    });
    expect(readLiveEvent(msg({ type: "transcript", role: "system", transcript: "x" }))).toBeNull();
    expect(readLiveEvent(msg({ type: "transcript", role: "user", transcript: "   " }))).toBeNull();
  });

  it("leaves every other message alone", () => {
    expect(readLiveEvent(msg({ type: "end-of-call-report" }))).toBeNull();
    expect(readLiveEvent(msg({ type: "tool-calls" }))).toBeNull();
    expect(readLiveEvent(null)).toBeNull();
  });

  it("is asked of Vapi with every call", () => {
    const brief = { business: "RENUABL", assistant: "Charlie", mode: "lead", firstName: "Jo", about: [] } as unknown as CallBrief;
    const config = assistantConfig({
      brief,
      slots: [],
      serverUrl: "https://x/api/voice/vapi?ref=vc_1",
      secret: "s".repeat(24),
      model: "m",
    }) as {
      serverMessages: string[];
    };
    expect(config.serverMessages).toEqual(expect.arrayContaining(["status-update", "transcript", "end-of-call-report", "tool-calls"]));
  });
});

describe("where the call stands", () => {
  it("follows Vapi's status, and the call's own", () => {
    expect(livePhase({ status: "waiting", liveStatus: null })).toBe("lined-up");
    expect(livePhase({ status: "calling", liveStatus: "queued" })).toBe("lined-up");
    expect(livePhase({ status: "calling", liveStatus: "ringing" })).toBe("ringing");
    expect(livePhase({ status: "calling", liveStatus: "in-progress" })).toBe("on-call");
    expect(livePhase({ status: "waiting", liveStatus: "ended" })).toBe("trying-again");
    expect(livePhase({ status: "booked", liveStatus: "ended" })).toBe("ended");
    expect(livePhase({ status: "done", liveStatus: null })).toBe("ended");
  });

  it("says it in words under the assistant's name", () => {
    expect(phaseWords("on-call", "Jo")).toBe("is on the call with Jo");
    expect(phaseWords("ringing", "")).toBe("is ringing the customer…");
  });

  it("times the call", () => {
    expect(clockWords(0)).toBe("0:00");
    expect(clockWords(65_400)).toBe("1:05");
    expect(clockWords(-5)).toBe("0:00");
  });

  it("joins a side's lines said one after another", () => {
    expect(
      joinRuns([
        { role: "assistant", text: "Hi Jo." },
        { role: "assistant", text: "It's Charlie." },
        { role: "customer", text: "Hello." },
      ]),
    ).toEqual([
      { role: "assistant", text: "Hi Jo. It's Charlie." },
      { role: "customer", text: "Hello." },
    ]);
  });
});
