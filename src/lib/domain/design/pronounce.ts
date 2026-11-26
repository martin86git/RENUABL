/**
 * How the business's voice agents say particular words (26 Nov 2026, Martin: "how can i adjust the voice agents way of
 * pronouncing something?", after Alice said "solar" as SO-LAR).
 *
 * A voice reads what it sees, so a note in an agent's script changes what the model writes, not how a word sounds
 * (said-as.ts). The business keeps one list for every agent: a word, and how to write it so the voice says it right.
 * It reaches a call twice over: the agent is told to write each word that way whenever it says it, and the same swaps
 * are given to Vapi's text-to-speech step (`voice.chunkPlan.formatPlan.replacements`, docs.vapi.ai/assistants/
 * voice-formatting-plan), which catches the fixed lines the agent is handed (its opening, voicemail) and anything it
 * writes as spelled.
 */

export interface Pronunciation {
  /** The word as it is spelled. */
  word: string;
  /** The word written the way the voice should say it. */
  say: string;
}

export const PRONOUNCE_LIMITS = { words: 30, word: 40, say: 60 } as const;

/** Letters (any language), digits, spaces, apostrophes, hyphens, full stops and ampersands: words, not markup. */
const WORDISH = /^[\p{L}\p{N}][\p{L}\p{N}' .&-]*$/u;

function cleanPart(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  const one = raw.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return WORDISH.test(one) ? one : "";
}

/** The list as kept: whole entries only, no word twice (any case), none said as written, at most the limit. */
export function cleanPronunciations(raw: unknown): Pronunciation[] {
  if (!Array.isArray(raw)) return [];
  const out: Pronunciation[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const word = cleanPart((r as Record<string, unknown>).word, PRONOUNCE_LIMITS.word);
    const say = cleanPart((r as Record<string, unknown>).say, PRONOUNCE_LIMITS.say);
    if (!word || !say || word.toLowerCase() === say.toLowerCase()) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word, say });
    if (out.length >= PRONOUNCE_LIMITS.words) break;
  }
  return out;
}

/** Why an entry being added can't be kept, or null. */
export function pronounceProblem(entry: { word: string; say: string }, list: readonly Pronunciation[]): string | null {
  const word = cleanPart(entry.word, PRONOUNCE_LIMITS.word);
  const say = cleanPart(entry.say, PRONOUNCE_LIMITS.say);
  if (!entry.word.trim() || !entry.say.trim()) return "Type the word, and how it should sound.";
  if (!word || !say) return "Use letters, numbers, spaces, hyphens and apostrophes only.";
  if (word.toLowerCase() === say.toLowerCase()) return "Write it the way it should sound, differently from how it's spelled.";
  if (list.some((p) => p.word.toLowerCase() === word.toLowerCase())) return `"${word}" is already on the list.`;
  if (list.length >= PRONOUNCE_LIMITS.words) return `The list holds up to ${PRONOUNCE_LIMITS.words} words.`;
  return null;
}

/**
 * The line of a call's rules that says how these words are said, or "" with none. The agent writes each the way it is
 * said, as it does the business's own name (said-as.ts).
 */
export function pronounceNote(list: readonly Pronunciation[]): string {
  if (!list.length) return "";
  const pairs = list.map((p) => `"${p.word}" → write "${p.say}"`).join("; ");
  return `- Some words are said differently from how they're spelled. Your words are read out by a voice that says what it sees, so whenever you say one of these, write it as shown (any capitals as usual): ${pairs}. It is the same word; only if someone asks how one is spelled, spell the real word.`;
}

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The swaps for Vapi's text-to-speech step. Its exact replacements aren't documented as ignoring case, so each word is
 * given as typed, in lower case, with a capital, and in capitals, its spoken form following suit.
 */
export function pronounceReplacements(list: readonly Pronunciation[]): { type: "exact"; key: string; value: string }[] {
  const out: { type: "exact"; key: string; value: string }[] = [];
  const keys = new Set<string>();
  const add = (key: string, value: string) => {
    if (!key || keys.has(key)) return;
    keys.add(key);
    out.push({ type: "exact", key, value });
  };
  for (const p of list) {
    add(p.word, p.say);
    add(p.word.toLowerCase(), p.say.toLowerCase());
    add(capital(p.word.toLowerCase()), capital(p.say.toLowerCase()));
    add(p.word.toUpperCase(), capital(p.say.toLowerCase()));
  }
  return out;
}

/** The voice as sent with the words swapped before it speaks them; the voice unchanged with none. */
export function withPronunciations<V extends object>(voice: V, list: readonly Pronunciation[] | undefined): V {
  const replacements = pronounceReplacements(list ?? []);
  if (!replacements.length) return voice;
  return { ...voice, chunkPlan: { enabled: true, formatPlan: { enabled: true, replacements } } };
}
