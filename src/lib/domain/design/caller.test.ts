import { describe, expect, it } from "vitest";
import {
  CALLER_NAME_MAX,
  CALLER_TINTS,
  CALLER_VOICES,
  cleanHiddenVoices,
  cleanTint,
  tintOf,
  TINT_NAMES,
  hideVoice,
  showVoice,
  voiceKey,
  voicesRemoved,
  voicesShown,
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
    expect(voiceLabel({ provider: "deepgram", voiceId: "notonourlist" })).toBe("Deepgram voice notonourlist");
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

  it("takes voices off the list and brings them back, never the one in use", () => {
    const ken = "azure:en-AU-KenNeural";
    const tara = "vapi:Tara";
    expect(cleanHiddenVoices([ken, ken, "nonsense:x", 7])).toEqual([ken]);
    const hidden = hideVoice(hideVoice([], ken), tara);
    expect(hidden).toEqual([ken, tara]);
    expect(voicesShown(hidden, null).some((v) => v.label === "Ken" || v.label === "Tara")).toBe(false);
    expect(voicesShown(hidden, null)).toHaveLength(CALLER_VOICES.length - 2);
    // The voice an agent speaks in stays on its list though it was removed.
    expect(voicesShown(hidden, { provider: "azure", voiceId: "en-AU-KenNeural" }).some((v) => v.label === "Ken")).toBe(true);
    expect(voicesRemoved(hidden, { provider: "azure", voiceId: "en-AU-KenNeural" }).map((v) => v.label)).toEqual(["Tara"]);
    expect(showVoice(hidden, ken)).toEqual([tara]);
    expect(voiceKey({ provider: "vapi", voiceId: "Tara" })).toBe(tara);
  });

  it("draws the stand-in in the colour chosen, else the name's own", () => {
    expect(cleanTint(3)).toBe(3);
    expect(cleanTint(0)).toBe(0);
    for (const bad of [-1, 6, 2.5, "2", null, undefined]) expect(cleanTint(bad)).toBeNull();
    expect(tintOf({ name: "Gary", tint: 4 })).toBe(4);
    expect(tintOf({ name: "Gary", tint: null })).toBe(callerTint("Gary"));
    expect(tintOf({ name: "Gary", tint: 99 })).toBe(callerTint("Gary"));
    expect(TINT_NAMES).toHaveLength(CALLER_TINTS);
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

describe("voiceAccent", () => {
  it("reads each voice's accent from its first word", async () => {
    const { voiceAccent, CALLER_VOICES } = await import("./caller");
    expect(voiceAccent({ words: "Australian, relaxed and natural" })).toBe("Australian");
    expect(voiceAccent({ words: "Australian · Microsoft, hear it on a test call" })).toBe("Australian");
    expect(voiceAccent({ words: "British" })).toBe("British");
    expect(voiceAccent({ words: "New Zealand · Microsoft" })).toBe("New Zealand");
    expect(new Set(CALLER_VOICES.map(voiceAccent))).toEqual(
      new Set(["Australian", "New Zealand", "Indian English", "Irish", "South African", "British", "Filipino", "Canadian", "American"]),
    );
  });
});

describe("voice samples", () => {
  it("plays our solar line where the maker's key is on the site, else the maker's clip", async () => {
    const { voiceSampleUrl, sampleLine, sampleName, CALLER_VOICES } = await import("./caller");
    const molly = { provider: "azure" as const, voiceId: "en-NZ-MollyNeural" };
    expect(voiceSampleUrl(molly)).toBeNull();
    expect(voiceSampleUrl(molly, ["azure"])).toContain("en-NZ-MollyNeural");
    expect(voiceSampleUrl({ provider: "vapi", voiceId: "Elliot" }, ["azure", "11labs", "deepgram"])).toBeNull();
    expect(voiceSampleUrl({ provider: "deepgram", voiceId: "theia" })).not.toBeNull();
    expect(sampleName(molly)).toBe("Molly");
    expect(sampleName({ provider: "11labs", voiceId: "somethingTyped123" })).toBe("your assistant");
    expect(sampleLine("Molly")).toMatch(/automated/);
    expect(sampleLine("Molly")).not.toMatch(/\d/);
    expect(new Set(CALLER_VOICES.map((v) => `${v.provider}:${v.voiceId}`)).size).toBe(CALLER_VOICES.length);
  });
});
