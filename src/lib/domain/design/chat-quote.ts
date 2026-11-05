/**
 * Replying to one message in a customer's chat (5 Nov 2026, Martin: as in a phone's messages app). The reply carries
 * the message it answers as its first line, "> " and a clip of it, so it reads the same everywhere it goes: drawn as a
 * quote over the reply in the chat (both sides), as a quoted line in the email the customer gets, and on the deal's
 * record. Plain text only, so `cleanLine` keeps it as it is. Pure, tested.
 */

/** What starts a quoted line. */
export const QUOTE_MARK = "> ";
/** The longest clip of the message answered. */
export const MAX_QUOTE = 140;

/** The reply with the message it answers over it. Quoting a reply keeps only the words it answered with. */
export function withQuote(reply: string, quoted: string): string {
  const words = splitQuote(quoted).text.replace(/\s+/g, " ").trim();
  if (!words) return reply;
  const clip = words.length > MAX_QUOTE ? `${words.slice(0, MAX_QUOTE - 1).trimEnd()}…` : words;
  return `${QUOTE_MARK}${clip}\n${reply}`;
}

/** A message's quote, when it answers one, and its own words. A lone "> " line with nothing after it is just words. */
export function splitQuote(text: string): { quote?: string; text: string } {
  if (!text.startsWith(QUOTE_MARK)) return { text };
  const cut = text.indexOf("\n");
  if (cut < 0) return { text };
  const quote = text.slice(QUOTE_MARK.length, cut).trim();
  const rest = text.slice(cut + 1);
  return quote && rest.trim() ? { quote, text: rest } : { text };
}
