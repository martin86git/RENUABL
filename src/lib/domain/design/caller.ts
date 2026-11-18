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
  automated: "It always says it's an automated assistant. A name never changes that.",
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
  return `"Hi, is that Sam? It's ${speakableName(name) || DEFAULT_CALLER}, ${business.trim() || "your business"}'s automated assistant, calling about the solar enquiry you made on our website."`;
}

/** A voice for the phone assistant, as Vapi takes it on a call (`voice: { provider, voiceId }`). */
export interface CallerVoice {
  provider: "vapi" | "11labs" | "deepgram" | "azure";
  voiceId: string;
}

const PROVIDERS: readonly CallerVoice["provider"][] = ["vapi", "11labs", "deepgram", "azure"];

/** A provider as kept in the database or sent from a browser, or null when it isn't one we send to Vapi. */
export function voiceProvider(raw: unknown): CallerVoice["provider"] | null {
  return PROVIDERS.find((p) => p === raw) ?? null;
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
 *
 * 18 Nov 2026 (Martin: "more australian voices"): Deepgram's two Australian Aura-2 voices (developers.deepgram.com/docs/
 * tts-models, in Vapi's own list of Deepgram voice IDs) and ElevenLabs' four British ready-made voices, the nearest it
 * has without an ElevenLabs account of the business's own (its ready-made voices are every account's; Charlie is its only
 * Australian one). More Australian voices are in ElevenLabs' library, which Vapi reaches only through an ElevenLabs key
 * added in Vapi; one of those is typed in by its ID. None of the six has been tried on a call: VERIFY.
 *
 * 18 Nov 2026, later (Martin: "i want more australian voice options"): eight of Microsoft's Australian neural voices
 * (learn.microsoft.com, Speech service language support, en-AU), which Vapi speaks through its own Azure integration
 * (docs.vapi.ai/providers/voice/azure: provider "azure", "Language is set by the voice you choose"). Vapi's page shows
 * only a short voice name ("andrew"); that it takes Microsoft's full name ("en-AU-NatashaNeural") is NOT confirmed,
 * and Microsoft publishes no clip we can play, so each must be heard on a test call first. If Vapi turns a call away
 * with one of these, the call goes once more in the usual voice (withoutSpeedSettings in voice-agent.ts).
 */
export const CALLER_VOICES: readonly VoiceChoice[] = [
  { provider: "11labs", voiceId: "IKne3meq5aSn9XLyUdCD", label: "Charlie", words: "Australian, relaxed and natural", sex: "male" },
  { provider: "deepgram", voiceId: "hyperion", label: "Hyperion", words: "Australian, caring and warm", sex: "male" },
  { provider: "deepgram", voiceId: "theia", label: "Theia", words: "Australian, polite and sincere", sex: "female" },
  {
    provider: "azure",
    voiceId: "en-AU-NatashaNeural",
    label: "Natasha",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "female",
  },
  {
    provider: "azure",
    voiceId: "en-AU-AnnetteNeural",
    label: "Annette",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "female",
  },
  {
    provider: "azure",
    voiceId: "en-AU-CarlyNeural",
    label: "Carly",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "female",
  },
  {
    provider: "azure",
    voiceId: "en-AU-FreyaNeural",
    label: "Freya",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "female",
  },
  {
    provider: "azure",
    voiceId: "en-AU-WilliamNeural",
    label: "William",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "male",
  },
  {
    provider: "azure",
    voiceId: "en-AU-DarrenNeural",
    label: "Darren",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "male",
  },
  {
    provider: "azure",
    voiceId: "en-AU-DuncanNeural",
    label: "Duncan",
    words: "Australian · Microsoft, hear it on a test call",
    sex: "male",
  },
  { provider: "azure", voiceId: "en-AU-KenNeural", label: "Ken", words: "Australian · Microsoft, hear it on a test call", sex: "male" },
  { provider: "11labs", voiceId: "JBFqnCBsd6RMkjVDRZzb", label: "George", words: "British, warm", sex: "male" },
  { provider: "11labs", voiceId: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", words: "British, steady", sex: "male" },
  { provider: "11labs", voiceId: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", words: "British, clear", sex: "female" },
  { provider: "11labs", voiceId: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", words: "British, soft", sex: "female" },
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

/**
 * Voices a business has taken off its list (18 Nov 2026, Martin: "i need to be able to remove the voices i dont
 * like"). The list is the whole business's, for every agent: a voice removed is only put away, brought back in one
 * press, and the voice an agent speaks in now always stays on its own list.
 */
export const voiceKey = (v: CallerVoice) => `${v.provider}:${v.voiceId}`;

/** The removed voices as kept or sent: only voices we offer, each once. */
export function cleanHiddenVoices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(CALLER_VOICES.map(voiceKey));
  return [...new Set(raw.filter((k): k is string => typeof k === "string" && known.has(k)))];
}

export const hideVoice = (hidden: readonly string[], key: unknown): string[] => cleanHiddenVoices([...hidden, key]);
export const showVoice = (hidden: readonly string[], key: unknown): string[] => cleanHiddenVoices(hidden.filter((k) => k !== key));

/** The voices on the list: all but those removed, the one in use always among them. */
export function voicesShown(hidden: readonly string[], inUse: CallerVoice | null): VoiceChoice[] {
  const gone = new Set(hidden);
  const using = inUse ? voiceKey(inUse) : "";
  return CALLER_VOICES.filter((v) => !gone.has(voiceKey(v)) || voiceKey(v) === using);
}

/** The voices put away, to bring back. */
export const voicesRemoved = (hidden: readonly string[], inUse: CallerVoice | null): VoiceChoice[] => {
  const shown = new Set(voicesShown(hidden, inUse).map(voiceKey));
  return CALLER_VOICES.filter((v) => !shown.has(voiceKey(v)));
};

export const VOICE_PROVIDERS: { id: CallerVoice["provider"]; label: string }[] = [
  { id: "11labs", label: "ElevenLabs" },
  { id: "vapi", label: "Vapi" },
  { id: "deepgram", label: "Deepgram" },
  { id: "azure", label: "Microsoft" },
];

/** A voice sent from the browser, checked: a known provider and an ID of letters and digits. Null is "the default". */
export function cleanVoice(raw: unknown): CallerVoice | null | "bad" {
  if (raw === null || raw === undefined || raw === "") return null;
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const provider = voiceProvider(v.provider);
  const voiceId = typeof v.voiceId === "string" ? v.voiceId.trim() : "";
  if (!provider || !/^[A-Za-z0-9_-]{2,40}$/.test(voiceId)) return "bad";
  return { provider, voiceId };
}

/**
 * Where a voice's sample clip is, for the play button beside it (18 Nov 2026, Martin: hear a voice without a call):
 * Deepgram publishes one for each Aura-2 voice at a fixed address; ElevenLabs lists one for each of its ready-made
 * voices (its address changes, so the server asks ElevenLabs' public list for it); Vapi publishes none we can fetch.
 * The clip is the maker's own recording of the voice, not the agent's words.
 */
export function voiceSample(v: CallerVoice | null): { from: "deepgram"; url: string } | { from: "11labs"; voiceId: string } | null {
  if (!v) return null;
  if (v.provider === "deepgram")
    return /^[a-z]{3,20}$/.test(v.voiceId)
      ? { from: "deepgram", url: `https://static.deepgram.com/examples/Aura-2-${v.voiceId}.wav` }
      : null;
  if (v.provider === "11labs") return /^[A-Za-z0-9]{12,40}$/.test(v.voiceId) ? { from: "11labs", voiceId: v.voiceId } : null;
  return null;
}

/** The address the picker plays a voice's sample from, or null when it has none. */
export function voiceSampleUrl(v: CallerVoice | null): string | null {
  return v && voiceSample(v) ? `/api/design/caller/voice-sample?provider=${v.provider}&id=${encodeURIComponent(v.voiceId)}` : null;
}

/** Where ElevenLabs keeps the clips its list points to: nothing else is fetched on its say-so. */
export function isElevenLabsClip(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return u.hostname === "elevenlabs.io" || u.hostname.endsWith(".elevenlabs.io") || u.hostname === "storage.googleapis.com";
  } catch {
    return false;
  }
}

export const NO_SAMPLE = "No sample for this one: use Test call to hear it.";

export const VOICE_BAD = "That isn't a voice ID we can use: letters and numbers only, as Vapi or ElevenLabs show it.";

/** The voice's name for the page: one of ours by its name, else "ElevenLabs voice 21m00…". */
export function voiceLabel(v: CallerVoice | null): string {
  if (!v) return "Vapi's default voice";
  const ours = CALLER_VOICES.find((c) => c.provider === v.provider && c.voiceId === v.voiceId);
  if (ours) return ours.label;
  return `${VOICE_PROVIDERS.find((p) => p.id === v.provider)?.label ?? "Vapi"} voice ${v.voiceId.length > 12 ? `${v.voiceId.slice(0, 8)}…` : v.voiceId}`;
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

/**
 * A colour the business chose for the stand-in picture (19 Nov 2026, Martin: "i should be able to choose different
 * colors"): one of the six, or null to leave it to the name.
 */
export function cleanTint(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < CALLER_TINTS ? raw : null;
}

/** The colour the stand-in picture is drawn in: the one chosen, else the name's own. */
export const tintOf = (c: { name: string; tint?: number | null }): number => cleanTint(c.tint) ?? callerTint(c.name);

/** What each colour is called, for the picker's labels (`--caller-0` … in globals.css). */
export const TINT_NAMES = ["Teal", "Blue", "Orange", "Violet", "Pink", "Gold"] as const;

/** The initial shown when there is no photo. */
export const callerInitial = (name: string) => (speakableName(name).charAt(0) || "S").toUpperCase();
