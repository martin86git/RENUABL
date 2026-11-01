/**
 * Sol joining in: in a channel the whole business reads (never a direct conversation), when someone asks the team a
 * question and nobody has answered after a short wait, Sol answers it if he can, without being tagged. He reads the
 * question first and stays quiet (PASS) when it isn't his to answer. A business switches it off in the channel's
 * header (`BusinessPrefs.solJoinsIn`).
 */

import { asksSol, isChannel } from "./team-chat";

/** How long a question waits for a teammate before Sol looks at it. */
export const SOL_JOIN_WAIT_SECONDS = 25;
/** Sol doesn't step in again in a room within this many minutes of his own last line there. */
export const SOL_JOIN_GAP_MINUTES = 3;
/** At most this many of Sol's lines in one room an hour, tagged or not, before he stops stepping in. */
export const SOL_JOIN_PER_HOUR = 6;
/** What Sol answers when the question isn't his to take; nothing is said in the room. */
export const SOL_PASS = "PASS";

const QUESTION_START =
  /^(what|whats|what's|how|hows|how's|when|where|which|who|whos|who's|why|can|could|does|do|did|is|are|should|would|will|has|have|any|anyone|anybody|does anyone|is there)\b/i;
/** A tag of a teammate: the question is theirs to answer. */
const TAGS_SOMEONE = /(^|\s)@(?!sol\b)[a-z0-9._-]+/i;

/**
 * Whether a line said in a room is one Sol might step in on: a channel, not already asking him (@Sol answers at once),
 * not tagging a teammate, and reading as a question with a few words to it.
 */
export function mayStepIn(room: string, text: string): boolean {
  if (!isChannel(room) || asksSol(room, text) || TAGS_SOMEONE.test(text)) return false;
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4 || t.length > 1200) return false;
  return t.endsWith("?") || QUESTION_START.test(t);
}

/**
 * Whether, now the wait is over, Sol may still step in: nobody but the asker has written since the question (a
 * teammate answering, or Sol tagged meanwhile, takes it), Sol hasn't spoken in the room in the last few minutes, and he
 * hasn't said too much there this hour.
 */
export function stillHisToTake(input: {
  asker: string;
  /** The room's lines after the question, by who wrote them. */
  since: readonly { by: string }[];
  /** When Sol last wrote in this room, if he has. */
  solLast: Date | null;
  /** Sol's lines in this room in the last hour. */
  solThisHour: number;
  now: Date;
}): boolean {
  const asker = input.asker.toLowerCase();
  if (input.since.some((l) => l.by.toLowerCase() !== asker)) return false;
  if (input.solLast && input.now.getTime() - input.solLast.getTime() < SOL_JOIN_GAP_MINUTES * 60_000) return false;
  return input.solThisHour < SOL_JOIN_PER_HOUR;
}

/** What Sol is asked when he reads a question nobody tagged him in. */
export function stepInPrompt(input: { channel: string; asker: string; question: string; context: string }): string {
  return (
    `You are reading the team chat's ${input.channel} channel, which everyone in the business reads. Nobody tagged you. ` +
    `${input.asker} has asked the team the message below and nobody has answered yet.\n` +
    `Step in only when you can answer it well yourself from what you have here: the business's deals as listed in your facts, ` +
    `solar, batteries and power bills, the electrical rules, the distributors' connection rules, and where things are in RENUABL. ` +
    `Answer with exactly ${SOL_PASS} and nothing else when it is meant for a particular person, when it is a remark or chat ` +
    `rather than a question, when it needs something you can't see here (a deal's notes or emails, a customer's details, a ` +
    `price list, a datasheet), or when you aren't sure. You have no tools in this reply.\n` +
    `When you answer: as a teammate, briefly (one to four short lines, plain text, the answer first), never a customer's ` +
    `phone or email, never a cost or margin, and never say you weren't asked.\n\n` +
    `The message: ${input.question}` +
    (input.context ? `\n\nThe channel's lines before it:\n${input.context}` : "")
  );
}

/** Sol's reply read back: his words to say in the room, or null when he passes. */
export function readStepIn(reply: string): string | null {
  const t = reply.trim();
  if (!t) return null;
  if (t.replace(/[^a-z]/gi, "").toUpperCase() === SOL_PASS) return null;
  if (t.toUpperCase().startsWith(SOL_PASS) && t.length < 40) return null;
  return t.slice(0, 2000);
}
