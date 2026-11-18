import { describe, expect, it } from "vitest";
import {
  CALLER_NAME_MAX,
  CALLER_TINTS,
  CALLER_VOICES,
  callerInitial,
  callerTint,
  callerIntro,
  cleanCallerName,
  cleanVoice,
  DEFAULT_CALLER,
  DEFAULT_TINT,
  testCallWords,
  voiceLabel,
  voiceProvider,
  voiceSample,
  voiceSampleUrl,
  isElevenLabsClip,
} from "./caller";

describe("the phone assistant's name", () => {
  it("keeps a name that can be said out loud", () => {
    expect(cleanCallerName("  Ella  ")).toEqual({ ok: true, value: "Ella" });
    expect(cleanCallerName("Mary-Jane O'Neil")).toEqual({ ok: true, value: "Mary-Jane O'Neil" });
    expect(cleanCallerName("Zoë")).toEqual({ ok: true, value: "Zoë" });
  });

  it("refuses what can't be said, or is too short", () => {
    expect(cleanCallerName("R2D2").ok).toBe(false);
    expect(cleanCallerName("<script>").ok).toBe(false);
    expect(cleanCallerName("A").ok).toBe(false);
    expect(cleanCallerName(42).ok).toBe(false);
  });

  it("keeps it short", () => {
    const long = cleanCallerName("Bartholomew Montgomery");
    expect(long.ok && long.value.length).toBeLessThanOrEqual(CALLER_NAME_MAX);
  });

  it("opens a call with its name and the business, as automated", () => {
    const words = callerIntro("Ella", "Sunrise Solar");
    expect(words).toContain("It's Ella, Sunrise Solar's automated assistant");
    expect(words).not.toMatch(/record/i);
    expect(callerIntro("", "")).toContain(DEFAULT_CALLER);
  });

  it("shows an initial with no picture", () => {
    expect(callerInitial("ella")).toBe("E");
    expect(callerInitial("")).toBe("S");
  });

  it("gives each name a colour of its own that stays the same", () => {
    expect(callerTint("Charlie")).toBe(callerTint("  charlie "));
    expect(callerTint("")).toBe(DEFAULT_TINT);
    const tints = ["Charlie", "Ella", "Ava", "Jack", "Mia", "Noah", "Zoë"].map(callerTint);
    for (const t of tints) expect(t >= 0 && t < CALLER_TINTS && Number.isInteger(t)).toBe(true);
    expect(new Set(tints).size).toBeGreaterThan(2);
  });
});

describe("the phone assistant's voice", () => {
  it("offers voices of both kinds, each one it can keep", () => {
    expect(CALLER_VOICES.some((v) => v.sex === "female")).toBe(true);
    expect(CALLER_VOICES.some((v) => v.sex === "male")).toBe(true);
    for (const v of CALLER_VOICES)
      expect(cleanVoice({ provider: v.provider, voiceId: v.voiceId })).toEqual({ provider: v.provider, voiceId: v.voiceId });
    expect(new Set(CALLER_VOICES.map((v) => v.label)).size).toBe(CALLER_VOICES.length);
  });

  it("offers more than one Australian voice, of both sexes", () => {
    const australian = CALLER_VOICES.filter((v) => v.words.startsWith("Australian"));
    expect(australian.length).toBeGreaterThanOrEqual(3);
    expect(new Set(australian.map((v) => v.sex)).size).toBe(2);
    expect(voiceProvider("deepgram")).toBe("deepgram");
    expect(voiceProvider("azure")).toBe("azure");
    expect(voiceProvider("playht")).toBeNull();
    // Microsoft's Australian voices, by the names Microsoft gives them.
    const microsoft = australian.filter((v) => v.provider === "azure");
    expect(microsoft.length).toBeGreaterThanOrEqual(6);
    for (const v of microsoft) expect(v.voiceId).toMatch(/^en-AU-[A-Z][a-z]+Neural$/);
    expect(voiceLabel({ provider: "deepgram", voiceId: "orion" })).toBe("Deepgram voice orion");
  });

  it("knows where a voice's sample is, and which voices have none", () => {
    expect(voiceSample({ provider: "deepgram", voiceId: "theia" })).toEqual({
      from: "deepgram",
      url: "https://static.deepgram.com/examples/Aura-2-theia.wav",
    });
    expect(voiceSample({ provider: "deepgram", voiceId: "../x" })).toBeNull();
    expect(voiceSample({ provider: "11labs", voiceId: "IKne3meq5aSn9XLyUdCD" })).toEqual({
      from: "11labs",
      voiceId: "IKne3meq5aSn9XLyUdCD",
    });
    expect(voiceSample({ provider: "vapi", voiceId: "Clara" })).toBeNull();
    expect(voiceSampleUrl({ provider: "vapi", voiceId: "Clara" })).toBeNull();
    expect(voiceSampleUrl({ provider: "deepgram", voiceId: "hyperion" })).toBe(
      "/api/design/caller/voice-sample?provider=deepgram&id=hyperion",
    );
    // Deepgram's and ElevenLabs' voices have a sample to play; Vapi's and Microsoft's publish none.
    for (const v of CALLER_VOICES) expect(Boolean(voiceSampleUrl(v))).toBe(v.provider === "deepgram" || v.provider === "11labs");
  });

  it("fetches a clip only from ElevenLabs' own places", () => {
    expect(isElevenLabsClip("https://api.us.elevenlabs.io/v1/voices/abc/previews/audio?payload=x")).toBe(true);
    expect(isElevenLabsClip("https://storage.googleapis.com/eleven-public-prod/premade/voices/a/b.mp3")).toBe(true);
    expect(isElevenLabsClip("http://api.elevenlabs.io/x.mp3")).toBe(false);
    expect(isElevenLabsClip("https://elevenlabs.io.example.com/x.mp3")).toBe(false);
    expect(isElevenLabsClip("https://169.254.169.254/latest")).toBe(false);
    expect(isElevenLabsClip(null)).toBe(false);
  });

  it("takes another voice by its ID, and nothing else", () => {
    expect(cleanVoice({ provider: "11labs", voiceId: " 21m00Tcm4TlvDq8ikWAM " })).toEqual({
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    });
    expect(cleanVoice(null)).toBeNull();
    expect(cleanVoice({ provider: "playht", voiceId: "abc" })).toBe("bad");
    expect(cleanVoice({ provider: "vapi", voiceId: "<script>" })).toBe("bad");
  });

  it("names the voice for the page", () => {
    expect(voiceLabel(null)).toBe("Vapi's default voice");
    expect(voiceLabel({ provider: "vapi", voiceId: "Clara" })).toBe("Clara");
    expect(voiceLabel({ provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" })).toBe("ElevenLabs voice 21m00Tcm…");
  });

  it("says on the test call who it is, that it's automated, and that it's a test", () => {
    const w = testCallWords("Ella", "RENUABL");
    expect(w).toContain("it's Ella, RENUABL's automated assistant");
    expect(w).toContain("test");
  });
});
