/**
 * The business's phone assistant as its customers meet it (12 Nov 2026, Martin: RENUABL Business is something solar
 * retailers sign up to, so the call function is personified by each of them: a name and a profile picture). Sol is
 * RENUABL's own AI and the name every business starts with; the name is what the assistant says on the phone ("It's
 * Ella, Sunrise Solar's automated assistant") and what its calls are written under on a deal. Pure, tested.
 */
import { speakableName } from "../voice-agent";

/** The name a business's phone assistant has until the business gives it one. */
export const DEFAULT_CALLER = "Sol";
export const CALLER_NAME_MIN = 2;
export const CALLER_NAME_MAX = 20;

/** Settings → Phone assistant, as the business reads it. */
export const CALLER_COPY = {
  title: "Phone assistant",
  intro:
    "The assistant that rings your new leads and the customers who ask for a call, and answers people who ring your number back. Give it a name and a face: it introduces itself by the name on every call, and its calls are written on your deals under it.",
  automated: "It always says it's an automated assistant and that the call is recorded. A name never changes that.",
  photo: "A square photo or drawing works best. It's shown beside its calls on your deals and in Today's Calls tab.",
} as const;

/** The name as it will be kept and said, or what is wrong with it. */
export function cleanCallerName(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const typed = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  const name = speakableName(typed).replace(/\s+/g, " ").slice(0, CALLER_NAME_MAX).trim();
  if (name.length < CALLER_NAME_MIN) return { ok: false, message: "Give it a name of at least two letters." };
  if (name !== typed.slice(0, CALLER_NAME_MAX).trim())
    return { ok: false, message: "Use letters only (spaces, apostrophes and hyphens are fine): it's said out loud on calls." };
  return { ok: true, value: name };
}

/** The opening words with this name, for the business to hear in its head before saving. */
export function callerIntro(name: string, business: string): string {
  return `"Hi, is that Sam? It's ${speakableName(name) || DEFAULT_CALLER}, ${business.trim() || "your business"}'s automated assistant, calling about the solar enquiry you made on our website. This call is recorded."`;
}

/** A voice for the phone assistant, as Vapi takes it on a call (`voice: { provider, voiceId }`). */
export interface CallerVoice {
  provider: "vapi" | "11labs";
  voiceId: string;
}

export interface VoiceChoice extends CallerVoice {
  label: string;
  /** How it sounds, as the voice's maker describes it. */
  words: string;
  sex: "female" | "male";
}

/**
 * The voices offered (12 Nov 2026, Martin: a picker, so the voice can suit the name). Vapi's own voices as listed on
 * docs.vapi.ai/providers/voice/vapi-voices (read 12 Nov 2026; none is Australian), and ElevenLabs' Charlie, an
 * Australian voice Vapi can use. VERIFY each on a test call before relying on it, and again when Vapi retires voices
 * (it retired eight in 2026). Any other ElevenLabs or Vapi voice can be typed in by its ID.
 */
export const CALLER_VOICES: readonly VoiceChoice[] = [
  { provider: "11labs", voiceId: "IKne3meq5aSn9XLyUdCD", label: "Charlie", words: "Australian, relaxed and natural", sex: "male" },
  { provider: "vapi", voiceId: "Elliot", label: "Elliot", words: "Canadian, young and calm (Vapi's default)", sex: "male" },
  { provider: "vapi", voiceId: "Dan", label: "Dan", words: "British", sex: "male" },
  { provider: "vapi", voiceId: "Kai", label: "Kai", words: "American, adult", sex: "male" },
  { provider: "vapi", voiceId: "Neil", label: "Neil", words: "American, young", sex: "male" },
  { provider: "vapi", voiceId: "Clara", label: "Clara", words: "American, adult", sex: "female" },
  { provider: "vapi", voiceId: "Emma", label: "Emma", words: "American, young", sex: "female" },
  { provider: "vapi", voiceId: "Savannah", label: "Savannah", words: "American, young", sex: "female" },
  { provider: "vapi", voiceId: "Layla", label: "Layla", words: "American, young", sex: "female" },
  { provider: "vapi", voiceId: "Tara", label: "Tara", words: "American", sex: "female" },
];

export const VOICE_PROVIDERS: { id: CallerVoice["provider"]; label: string }[] = [
  { id: "11labs", label: "ElevenLabs" },
  { id: "vapi", label: "Vapi" },
];

/** A voice sent from the browser, checked: a known provider and an ID of letters and digits. Null is "the default". */
export function cleanVoice(raw: unknown): CallerVoice | null | "bad" {
  if (raw === null || raw === undefined || raw === "") return null;
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const provider = v.provider === "vapi" || v.provider === "11labs" ? v.provider : null;
  const voiceId = typeof v.voiceId === "string" ? v.voiceId.trim() : "";
  if (!provider || !/^[A-Za-z0-9_-]{2,40}$/.test(voiceId)) return "bad";
  return { provider, voiceId };
}

export const VOICE_BAD = "That isn't a voice ID we can use: letters and numbers only, as Vapi or ElevenLabs show it.";

/** The voice's name for the page: one of ours by its name, else "ElevenLabs voice 21m00…". */
export function voiceLabel(v: CallerVoice | null): string {
  if (!v) return "Vapi's default voice";
  const ours = CALLER_VOICES.find((c) => c.provider === v.provider && c.voiceId === v.voiceId);
  if (ours) return ours.label;
  return `${v.provider === "11labs" ? "ElevenLabs" : "Vapi"} voice ${v.voiceId.length > 12 ? `${v.voiceId.slice(0, 8)}…` : v.voiceId}`;
}

/** What the test call says, so the business hears the voice with its own name in it. */
export function testCallWords(name: string, business: string): string {
  return `Hi, it's ${speakableName(name) || DEFAULT_CALLER}, ${business.trim() || "your business"}'s automated assistant. This is a test, so you can hear how I'll sound on your calls. Bye for now.`;
}

/** How many colours the stand-in picture comes in (`--caller-0` … in globals.css). */
export const CALLER_TINTS = 6;

/** The signal orange's place among them: an assistant not yet named keeps it. */
export const DEFAULT_TINT = 2;

/**
 * The colour of an assistant's stand-in picture, by its name, so two callers with no photo can be told apart
 * and each keeps its colour wherever it shows. Upper and lower case count the same.
 */
export function callerTint(name: string): number {
  const said = speakableName(name).toLowerCase();
  if (!said) return DEFAULT_TINT;
  let sum = 0;
  for (const ch of said) sum += ch.codePointAt(0) ?? 0;
  return sum % CALLER_TINTS;
}

/** The initial shown when there is no photo. */
export const callerInitial = (name: string) => (speakableName(name).charAt(0) || "S").toUpperCase();
