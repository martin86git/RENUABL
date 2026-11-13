import { describe, expect, it } from "vitest";
import {
  cleanTeamNote,
  clockWords,
  END_CALL_COMMAND,
  isControlUrl,
  joinRuns,
  mayEndCall,
  livePhase,
  phaseWords,
  readLiveEvent,
  TEAM_NOTE_MAX,
  vapiCallOver,
  teamCommand,
  teamLineWords,
} from "./live-call";
import { assistantConfig, transcriberFor, type CallBrief } from "./voice-agent";

const msg = (message: Record<string, unknown>) => ({ message: { call: { id: "vapi_1" }, ...message } });

describe("Vapi's messages for the live view", () => {
  it("reads the call's status", () => {
    expect(readLiveEvent(msg({ type: "status-update", status: "in-progress" }))).toEqual({
      kind: "status",
      callId: "vapi_1",
      status: "in-progress",
      controlUrl: null,
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

describe("the team typing to the assistant mid-call", () => {
  it("keeps Vapi's control address from a status update, only on Vapi's own hosts", () => {
    const ev = (url: string) =>
      readLiveEvent({ message: { type: "status-update", status: "in-progress", call: { id: "c1", monitor: { controlUrl: url } } } });
    expect(ev("https://phone-call-websocket.aws-us-west-2-backend-production1.vapi.ai/c1/control")).toMatchObject({
      controlUrl: "https://phone-call-websocket.aws-us-west-2-backend-production1.vapi.ai/c1/control",
    });
    expect(ev("https://evil.example/vapi.ai/control")).toMatchObject({ controlUrl: null });
    expect(ev("http://api.vapi.ai/control")).toMatchObject({ controlUrl: null });
    expect(isControlUrl("https://user:pw@api.vapi.ai/x")).toBe(false);
  });

  it("cleans the note to one line within the limit", () => {
    expect(cleanTeamNote("  the roof\n is  tile ")).toBe("the roof is tile");
    expect(cleanTeamNote(42)).toBe("");
    expect(cleanTeamNote("x".repeat(TEAM_NOTE_MAX + 50))).toHaveLength(TEAM_NOTE_MAX);
  });

  it("sends a note the assistant works in under its rules, or words to say as typed", () => {
    const told = teamCommand({ text: "The roof is tile", say: false, business: "Sunrise Solar" });
    expect(told).toMatchObject({ type: "add-message", triggerResponseEnabled: true, message: { role: "system" } });
    const words = (told as { message: { content: string } }).message.content;
    expect(words).toContain('"The roof is tile"');
    expect(words).toContain("can't see or hear it");
    expect(words).toContain("no price");
    expect(teamCommand({ text: "Hi Jo", say: true, business: "" })).toEqual({ type: "say", content: "Hi Jo", endCallAfterSpoken: false });
    expect(teamLineWords("team", "Charlie")).toBe("You told Charlie");
    expect(teamLineWords("team-say", "Charlie")).toBe("You had Charlie say");
  });
});

describe("hanging up on the assistant's call", () => {
  it("is Vapi's end-call, only while it rings or is on, with a control address", () => {
    expect(END_CALL_COMMAND).toEqual({ type: "end-call" });
    const url = "https://x.vapi.ai/c/control";
    expect(mayEndCall({ controlUrl: url, liveStatus: "in-progress" })).toBe(true);
    expect(mayEndCall({ controlUrl: url, liveStatus: "ringing" })).toBe(true);
    expect(mayEndCall({ controlUrl: url, liveStatus: "ended" })).toBe(false);
    expect(mayEndCall({ controlUrl: null, liveStatus: "in-progress" })).toBe(false);
    expect(teamLineWords("team-end", "Charlie")).toBe("You ended the call");
  });
});

describe("the call's transcriber", () => {
  it("is Deepgram nova-3 in Australian English, told the names and solar words to expect", () => {
    const t = transcriberFor(["Charlie", "Sunrise Solar", "Michelle", ""]);
    expect(t).toMatchObject({ provider: "deepgram", model: "nova-3", language: "en-AU" });
    expect(t.keyterm).toEqual(expect.arrayContaining(["Charlie", "Sunrise Solar", "Michelle", "inverter", "Solar Victoria"]));
    expect(t.keyterm.length).toBeLessThanOrEqual(50);
  });
});

describe("a call Vapi has finished", () => {
  it("is over only when Vapi says ended", () => {
    expect(vapiCallOver("ended")).toBe(true);
    for (const s of ["scheduled", "queued", "ringing", "in-progress", "forwarding", undefined, null, 3])
      expect(vapiCallOver(s)).toBe(false);
  });
});
