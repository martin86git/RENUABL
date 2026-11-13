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

  it("opens a call with its name and the business, as automated and recorded", () => {
    const words = callerIntro("Ella", "Sunrise Solar");
    expect(words).toContain("It's Ella, Sunrise Solar's automated assistant");
    expect(words).toContain("recorded");
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

  it("takes another voice by its ID, and nothing else", () => {
    expect(cleanVoice({ provider: "11labs", voiceId: " 21m00Tcm4TlvDq8ikWAM " })).toEqual({
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    });
    expect(cleanVoice(null)).toBeNull();
    expect(cleanVoice({ provider: "azure", voiceId: "abc" })).toBe("bad");
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
