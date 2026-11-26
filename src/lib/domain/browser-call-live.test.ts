import { describe, expect, it } from "vitest";
import { LIVE_TRACK_LABELS, liveTranscriptionParams, readLiveEvent } from "./browser-call";
import { bothSides, callPointsPrompt, cleanHeard, transcriptOf } from "./design/call-notes";

const content = (o: Record<string, string>) => ({
  TranscriptionEvent: "transcription-content",
  TranscriptionData: JSON.stringify({ transcript: "  We'd like a   battery. ", confidence: 0.9 }),
  Final: "true",
  Track: "inbound_track",
  ...o,
});

describe("live words on a computer call", () => {
  it("asks Twilio for both sides, labelled, in Australian English, with partial results", () => {
    const p = liveTranscriptionParams("https://site/api/voice/twilio/live?call=bc_1");
    expect(p.Track).toBe("both_tracks");
    expect(p.InboundTrackLabel).toBe(LIVE_TRACK_LABELS.inbound);
    expect(p.OutboundTrackLabel).toBe(LIVE_TRACK_LABELS.outbound);
    expect(p.LanguageCode).toBe("en-AU");
    expect(p.PartialResults).toBe("true");
    expect(p.StatusCallbackUrl).toContain("call=bc_1");
  });

  it("reads a stretch of words: the member's track as us, the customer's as them, by track name or label", () => {
    expect(readLiveEvent(content({}))).toEqual({ kind: "words", who: "us", text: "We'd like a battery.", final: true });
    expect(readLiveEvent(content({ Track: "outbound_track" }))).toMatchObject({ who: "them" });
    expect(readLiveEvent(content({ Track: "them" }))).toMatchObject({ who: "them" });
    expect(readLiveEvent(content({ Final: "false" }))).toMatchObject({ final: false });
  });

  it("passes over empty or broken words, and reads the end and errors", () => {
    expect(readLiveEvent(content({ TranscriptionData: "not json" }))).toEqual({ kind: "other" });
    expect(readLiveEvent(content({ TranscriptionData: '{"transcript":"  "}' }))).toEqual({ kind: "other" });
    expect(readLiveEvent({ TranscriptionEvent: "transcription-stopped" })).toEqual({ kind: "stopped" });
    expect(readLiveEvent({ TranscriptionEvent: "transcription-error", TranscriptionError: "boom" })).toEqual({
      kind: "error",
      message: "boom",
    });
    expect(readLiveEvent({ TranscriptionEvent: "transcription-started" })).toEqual({ kind: "other" });
  });

  it("keeps who said each line, and gives Sol both sides marked", () => {
    const lines = cleanHeard([
      { at: "9:00", text: "How big is your bill?", who: "us" },
      { at: "9:00", text: "About four hundred a quarter.", who: "them" },
      { at: "9:01", text: "Send the quote Friday", note: true, who: "us" },
      { at: "9:01", text: "x", who: "someone" },
    ]);
    expect(lines[3].who).toBeUndefined();
    expect(bothSides(lines)).toBe(true);
    const t = transcriptOf(lines, "Jo Smith");
    expect(t).toContain("Us: How big is your bill?");
    expect(t).toContain("Jo (customer): About four hundred a quarter.");
    expect(t).toContain("[Note] Send the quote Friday");
  });

  it("reads the member's side alone as before", () => {
    const lines = cleanHeard([{ at: "9:00", text: "Your roof faces north" }]);
    expect(bothSides(lines)).toBe(false);
    expect(transcriptOf(lines, "Jo")).toBe("Your roof faces north");
  });

  it("tells the live points prompt which it has", () => {
    expect(callPointsPrompt("Sunrise", "Jo", "Us: hi", [], true)).toContain("both sides");
    expect(callPointsPrompt("Sunrise", "Jo", "hi", [])).toContain("salesperson's side only");
  });
});
