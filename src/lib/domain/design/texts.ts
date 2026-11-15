/**
 * Texts with a customer, both ways (15 Nov 2026, Martin: "where do reply texts get received?… is there a way that
 * texts will automatically sign off with: Regards, (Name) | (Company name)"). A text a person sends from a deal ends
 * with their sign-off, added on the server; a reply comes back to the number it was sent from and is kept on the
 * customer's deal, where the text that prompted it already is. A reply of STOP means no more texts to that customer
 * until they send START. A text from a number on no customer's record is kept apart, never dropped. Pure, tested.
 */
import { normaliseMobile } from "../contact";

export interface TextLine {
  id: string;
  /** "out": the business texted them. "in": they texted back. */
  direction: "in" | "out";
  text: string;
  at: string;
  /** Who in the business sent it (their email); empty for a text that came in. */
  by: string;
}

/** A text that came in from a number on no customer's record. */
export interface StrayText {
  id: string;
  /** The number as people write it: 0412 345 678. */
  from: string;
  text: string;
  at: string;
}

/** The longest text taken in: ten standard messages' worth, as Twilio joins them. */
export const TEXT_IN_MAX = 1600;
/** How many lines of a deal's texts are shown. */
export const TEXTS_SHOWN = 40;

/**
 * The sign-off a person's text ends with: "Regards,\nMartin | RENUABL". With no first name it is the business alone;
 * with neither, nothing.
 */
export function textSignOff(firstName: string | null | undefined, business: string | null | undefined): string {
  const one = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/[\u0000-\u001f\u007f|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
  const who = [one(firstName), one(business)].filter(Boolean).join(" | ");
  return who ? `Regards,\n${who}` : "";
}

/** The words as they go: the text, a blank line, the sign-off. One already signed that way isn't signed twice. */
export function signedText(text: string, signOff: string): string {
  const words = text.trim();
  if (!signOff || words.toLowerCase().endsWith(signOff.toLowerCase())) return words;
  return `${words}\n\n${signOff}`;
}

/** A text that came in, as kept: line ends made plain, no control characters, to `TEXT_IN_MAX`. */
export function cleanInbound(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, TEXT_IN_MAX);
}

const STOP = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "opt out", "optout"]);
const START = new Set(["start", "unstop"]);

/**
 * Whether a reply asks for texts to stop, or to start again: only when it is that word alone (a full stop or
 * exclamation mark after it allowed), so "please don't stop by before 9" stops nothing.
 */
export function stopWord(text: string): "stop" | "start" | null {
  const word = text
    .trim()
    .toLowerCase()
    .replace(/[.!\s]+$/, "")
    .replace(/\s+/g, " ");
  return STOP.has(word) ? "stop" : START.has(word) ? "start" : null;
}

/** A mobile as people write it (0412 345 678) from however it was kept; anything else is given back trimmed. */
export function localMobile(number: string): string {
  const m = normaliseMobile(number);
  if (!m) return number.trim().slice(0, 30);
  const local = `0${m.replace(/\D/g, "").slice(2)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** The line kept on the deal's record for a text that came in. */
export const replyRecord = (from: string, text: string) => `Text from ${localMobile(from)}: ${text}`;

/** The line kept on the deal's record when they ask for texts to stop, or to start again. */
export const stopRecord = (from: string, word: "stop" | "start") =>
  word === "stop"
    ? `${localMobile(from)} replied STOP: no more texts to this customer until they text START.`
    : `${localMobile(from)} replied START: they can be texted again.`;

/** Whether the customer is waiting on an answer: the latest text on the deal is theirs. */
export function waitingOnUs(lines: readonly Pick<TextLine, "direction">[]): boolean {
  return lines.length > 0 && lines[lines.length - 1].direction === "in";
}

export const TEXTS_COPY = {
  stopped: (who: string) => `${who} replied STOP, so they can't be texted until they text START.`,
  replies: "Replies come back onto this deal.",
  none: "No texts with them yet.",
  strays: "Texts from numbers not on a customer",
  replied: "Replied by text",
} as const;
