/**
 * Customers' names offered as a name is typed in an agent's chat (22 Nov 2026, Martin: "typing customer and then typing
 * the first letter of a name should bring up customers names and filter out. It should be easily ignored if it's not
 * the intended function"). The word being typed at the caret is looked up when it reads as a name: it starts with a
 * capital, or follows a word like call, ring, text or customer. The names come up as chips to tap; nothing else
 * changes, so typing on ignores them. Pure, tested.
 */

/** Words after which the next word is taken as a name even in lower case. */
const LEADS = new Set([
  "call",
  "ring",
  "text",
  "phone",
  "email",
  "message",
  "customer",
  "customers",
  "client",
  "to",
  "with",
  "about",
  "for",
]);
/** Words that start a sentence and are never a name, even with a capital. */
const NOT_NAMES = new Set([
  "call",
  "ring",
  "text",
  "phone",
  "email",
  "message",
  "can",
  "could",
  "would",
  "please",
  "ask",
  "tell",
  "the",
  "a",
  "an",
  "i",
  "and",
  "what",
  "how",
  "when",
  "why",
  "who",
  "is",
  "are",
  "do",
  "does",
  "did",
  "hi",
  "hey",
  "ok",
  "okay",
  "yes",
  "no",
  "thanks",
  "make",
  "say",
  "get",
  "let",
  "send",
  "check",
  "find",
  "give",
  "it",
  "he",
  "she",
  "they",
  "we",
  "you",
  "my",
  "our",
  "his",
  "her",
  "their",
]);

export const HINT_MAX = 5;

export interface NameSpan {
  /** Where the name being typed starts in the text, and what has been typed of it (one or two words). */
  start: number;
  typed: string;
}

const WORD = /[A-Za-z][A-Za-z'’-]*$/;

/** The name being typed just before the caret, or null when what is there doesn't read as one. */
export function nameAt(text: string, caret: number): NameSpan | null {
  const before = text.slice(0, caret);
  if (/\s$/.test(before)) return null;
  const word = before.match(WORD);
  if (!word) return null;
  const start = caret - word[0].length;
  const prior = before.slice(0, start).match(/([A-Za-z'’-]+)\s+$/);
  const prev = prior?.[1] ?? "";
  // Two words of one name ("Martin S"): the first a capitalised word that isn't a lead word.
  if (prev && /^[A-Z]/.test(prev) && !LEADS.has(prev.toLowerCase()) && !NOT_NAMES.has(prev.toLowerCase())) {
    return { start: start - prior![0].length, typed: `${prev} ${word[0]}` };
  }
  const capital = /^[A-Z]/.test(word[0]) && !NOT_NAMES.has(word[0].toLowerCase());
  const led = LEADS.has(prev.toLowerCase());
  if (!capital && !led) return null;
  return { start, typed: word[0] };
}

/**
 * The customers whose name has a word starting with what was typed (or the whole name, for two words), those whose
 * first name matches first, up to HINT_MAX.
 */
export function nameHints<T extends { id: string; name: string }>(people: readonly T[], typed: string): T[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const two = q.includes(" ");
  const seen = new Set<string>();
  const first: T[] = [];
  const rest: T[] = [];
  for (const p of people) {
    const name = p.name.trim().toLowerCase();
    if (!name || seen.has(name)) continue;
    const words = name.split(/\s+/);
    if (two ? name.startsWith(q) : words[0].startsWith(q)) first.push(p);
    else if (!two && words.some((w) => w.startsWith(q))) rest.push(p);
    else continue;
    seen.add(name);
  }
  return [...first, ...rest].slice(0, HINT_MAX);
}

/** The text with the name being typed replaced by the one picked, a space after it, and where the caret goes. */
export function withName(text: string, span: NameSpan, name: string): { text: string; caret: number } {
  const end = span.start + span.typed.length;
  const after = text.slice(end).replace(/^\s*/, "");
  const head = `${text.slice(0, span.start)}${name} `;
  return { text: head + after, caret: head.length };
}
