/**
 * Search across the business (31 Oct 2026, as Primero's Ctrl K): who's calling, found as each digit of their number goes
 * in, or by name, email or address; and deals by customer, title or address. Every word typed must match. Pure, tested.
 */

/** Digits only, with a leading +61 read as 0, so "+61 423 111 222" and "0423111222" match. */
export const digitsOf = (phone: string) => phone.replace(/\D/g, "").replace(/^61(?=\d{9}$)/, "0");

/** A phone number being typed: only digits, spaces, +, brackets and dashes, with a digit. */
export const looksLikePhone = (q: string) => /^[\d\s+()-]+$/.test(q) && /\d/.test(q);

/** How many digits before a number starts matching. */
export const PHONE_FROM = 4;

export interface Findable {
  /** Words to match against (name, email, address, title). */
  words: string[];
  phone?: string;
}

/** Whether what was typed finds this: a number by its digits anywhere, else every word somewhere in its words. */
export function matches(item: Findable, typed: string): boolean {
  const q = typed.trim().toLowerCase();
  if (!q) return false;
  if (looksLikePhone(q)) {
    const want = digitsOf(q);
    return want.length >= PHONE_FROM && Boolean(item.phone) && digitsOf(item.phone!).includes(want);
  }
  if (q.length < 2) return false;
  const hay = item.words.join(" ").toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Words that start a question or a request to Sol rather than a name ("draft", "show", "who"). */
const ASKING =
  /^(who|what|which|when|where|why|how|can|could|should|would|is|are|do|does|did|will|draft|write|show|tell|find me|remind|summarise|summarize|give|list|chart|explain|help)\b/;

/**
 * Whether what was typed in the search reads as something to ask Sol (1 Nov 2026, Martin: search and Sol are one box):
 * a question mark, a word that starts a question or a request, or five words or more. A number never is. Then "Ask Sol"
 * comes first and Enter asks him; otherwise the customers and deals found come first.
 */
export function looksLikeQuestion(typed: string): boolean {
  const q = typed.trim().toLowerCase();
  if (q.length < 2 || looksLikePhone(q)) return false;
  return q.endsWith("?") || ASKING.test(q) || q.split(/\s+/).length >= 5;
}
