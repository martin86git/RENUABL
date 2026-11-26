/**
 * How Sol's answers are laid out to read at a glance (5 Nov 2026, Martin: a question three quarters of the way down a
 * long answer is easily missed). Sol writes plain text with a few marks (`SOL_LAYOUT` in his instructions): short
 * paragraphs with a blank line between, "- " lines for a list, the one point that matters most on a line starting "! ",
 * and a question to the reader on a line starting "? ". This reads that back into blocks: paragraphs, round-bulleted
 * lists, a highlighted key point and a highlighted question. A long paragraph is broken at its sentences, a lone
 * question is highlighted even unmarked, and the routine "Want more detail?" stays quiet. Pure, tested.
 */
import { MORE_DETAIL } from "./sol-charts";
import { withQuote } from "./chat-quote";

export type SolBlock =
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[] }
  /** The salient point, in a highlighted pad. */
  | { kind: "key"; text: string }
  /** A question put to the reader, highlighted so it isn't missed. */
  | { kind: "ask"; text: string }
  /** The routine offer of more detail, kept quiet. */
  | { kind: "more"; text: string }
  /** A question with a few options to pick from, drawn as a card of numbered choices. */
  | { kind: "choose"; text: string; options: SolOption[] };

/** One option of a choice: a short name and, when given, a line on what it means. */
export interface SolOption {
  label: string;
  detail: string;
}

/** A choice offers two to this many options; more is a list to read, not a card to press. */
export const MAX_OPTIONS = 4;

/** A paragraph longer than this is broken at its sentences. */
export const LONG_PARAGRAPH = 360;
/** About how long each piece of a broken paragraph runs. */
const PIECE = 240;

const ITEM = /^\s*(?:[-*•‣–]|\d{1,2}[.)])\s+/;
const KEY = /^\s*!\s+/;
const ASK = /^\s*\?\s+/;

/** Sentences of a paragraph, keeping figures like 1.5 and abbreviations like e.g. whole. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(“‘$])/).filter(Boolean);
}

/** A long paragraph as pieces of a few sentences each. */
export function brokenUp(text: string): string[] {
  if (text.length <= LONG_PARAGRAPH || text.includes("\n")) return [text];
  const out: string[] = [];
  let piece = "";
  for (const s of sentences(text)) {
    if (piece && piece.length + s.length + 1 > PIECE) {
      out.push(piece);
      piece = s;
    } else piece = piece ? `${piece} ${s}` : s;
  }
  if (piece) out.push(piece);
  return out;
}

/** A paragraph that is one question put to the reader. */
const isQuestion = (text: string) => text.endsWith("?") && !text.includes("\n") && sentences(text).length === 1 && text.length <= 240;

/** Sol's words as blocks to draw. */
export function solBlocks(text: string): SolBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: SolBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const endPara = () => {
    const words = para.join("\n").trim();
    para = [];
    if (!words) return;
    if (words === MORE_DETAIL) out.push({ kind: "more", text: words });
    else if (isQuestion(words)) out.push({ kind: "ask", text: words });
    else for (const piece of brokenUp(words)) out.push({ kind: "para", text: piece });
  };
  const endList = () => {
    if (list?.length) out.push({ kind: "list", items: list });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      endPara();
      // A blank line between items keeps one list; anything else after it starts afresh.
      continue;
    }
    if (ITEM.test(line)) {
      endPara();
      (list ??= []).push(line.replace(ITEM, "").trim());
      continue;
    }
    endList();
    if (KEY.test(line) || ASK.test(line)) {
      endPara();
      const said = line.replace(KEY.test(line) ? KEY : ASK, "").trim();
      if (said) out.push({ kind: KEY.test(line) ? "key" : "ask", text: said });
      continue;
    }
    para.push(line.trim());
  }
  endPara();
  endList();
  return withChoices(out);
}

/** An option line: "Name: what it means" or "Name — what it means", or a short name alone. */
function optionOf(item: string): SolOption | null {
  const m = /^(.{1,48}?)\s*(?::|\s[–—-]\s)\s*(.+)$/.exec(item.replace(/\*\*/g, ""));
  const label = (m ? m[1] : item.replace(/\*\*/g, "")).trim().replace(/[.:]$/, "");
  const detail = m ? m[2].trim() : "";
  if (!label || label.length > 48 || (!m && label.split(/\s+/).length > 6)) return null;
  return { label, detail };
}

/**
 * A question put to the reader followed straight away by two to four short options becomes one choice (8 Nov 2026,
 * Martin: Sol's questions shown as a card of numbered choices to press, as Claude asks).
 */
function withChoices(blocks: SolBlock[]): SolBlock[] {
  const out: SolBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.kind === "ask" && next?.kind === "list" && next.items.length >= 2 && next.items.length <= MAX_OPTIONS) {
      const options = next.items.map(optionOf);
      if (options.every((o): o is SolOption => o !== null)) {
        out.push({ kind: "choose", text: b.text, options });
        i++;
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

/** A run of one line of Sol's: plain words, or something worth setting apart. */
export type SolRun =
  | { kind: "text"; text: string }
  /** Words he marked as mattering (**like this**). */
  | { kind: "strong"; text: string }
  /** A figure with its unit, or a dollar amount: the thing the eye is looking for. */
  | { kind: "figure"; text: string }
  /** A phone number to ring, with the digits to dial. */
  | { kind: "phone"; text: string; dial: string }
  | { kind: "email"; text: string }
  /** A web address to press (17 Nov 2026, Martin: a Meet link he had to copy and paste). Only https. */
  | { kind: "link"; text: string };

const RUNS = new RegExp(
  [
    String.raw`\*\*([^*\n]{1,200})\*\*`,
    String.raw`(https:\/\/[^\s<>()"]+[^\s<>()".,;:!?'])`,
    String.raw`([\w.+-]+@[\w-]+(?:\.[\w-]+)+)`,
    String.raw`((?<![\d-])(?:1[38]00 ?\d{3} ?\d{3}|13 ?\d{2} ?\d{2}|0[2-478](?: ?\d){8})(?![\d-]))`,
    String.raw`(\$\d[\d,]*(?:\.\d+)?|(?<![\w.])\d[\d,]*(?:\.\d+)?(?:–\d[\d,]*(?:\.\d+)?)? ?(?:kWh|kW|kVA|MW|mm|cm|m²|GHz|Hz|%|°C|°)(?![A-Za-z]))`,
  ].join("|"),
  "g",
);

/**
 * One line of Sol's as runs to draw (14 Nov 2026, Martin: "we can do better with the text formatting"): the figures a
 * reader is looking for (600 mm, 13.5 kWh, $1,200), the words he marked, and a phone number or email as something to
 * press. Everything else is plain. Nothing is reworded: joined back together the runs are his words (less the ** marks).
 */
export function solRuns(text: string): SolRun[] {
  const out: SolRun[] = [];
  let at = 0;
  for (const m of text.matchAll(RUNS)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ kind: "text", text: text.slice(at, i) });
    if (m[1] !== undefined) out.push({ kind: "strong", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "link", text: m[2] });
    else if (m[3] !== undefined) out.push({ kind: "email", text: m[3].replace(/\.$/, "") });
    else if (m[4] !== undefined) out.push({ kind: "phone", text: m[4], dial: m[4].replace(/\s+/g, "") });
    else out.push({ kind: "figure", text: m[5] });
    at = i + m[0].length;
    // An address that ended a sentence gives its full stop back.
    if (m[3] !== undefined && m[3].endsWith(".")) out.push({ kind: "text", text: "." });
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

/** A list item that opens with a short name and a colon ("Voc: the open-circuit voltage"), as the name and the rest. */
export function namedItem(item: string): { name: string; rest: string } | null {
  const m = /^(?:\*\*)?([^:*\n]{2,36}?)(?:\*\*)?:\s+(\S.*)$/.exec(item);
  if (!m || /\d$/.test(m[1]) || m[1].split(/\s+/).length > 5) return null;
  return { name: m[1].trim(), rest: m[2] };
}

/** A heading over its list: what Sol wrote as a line ending in a colon with a list straight under it. */
export interface SolSection {
  kind: "section";
  title: string;
  items: string[];
}

/** A section's heading is one short line; anything longer is a paragraph that happens to end in a colon. */
export const SECTION_TITLE_MAX = 110;

/**
 * His blocks with each heading and its list joined as one section (15 Nov 2026, Martin: "i cant tell the headers
 * from the rest of the text"), so the page can draw the heading as a heading and its items as that section's rows.
 * Nothing is reworded: only the heading's closing colon is left off.
 */
export function withSections(blocks: SolBlock[]): (SolBlock | SolSection)[] {
  const out: (SolBlock | SolSection)[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    const title = b.kind === "para" ? b.text.trim() : "";
    if (title.endsWith(":") && !title.includes("\n") && title.length <= SECTION_TITLE_MAX && next?.kind === "list") {
      out.push({ kind: "section", title: title.slice(0, -1).trimEnd(), items: next.items });
      i++;
    } else out.push(b);
  }
  return out;
}

/** How far a thread steps in before it holds its line (the chat is a narrow column). */
export const THREAD_DEPTH_MAX = 3;

/** Words that open a new subject: a paragraph starting with one begins a thread of its own. */
const NEW_SUBJECT =
  /^(?:last(?:ly)?|finally|next|after that|then|separately|also|another|on another note|one more thing|other than that|meanwhile|second(?:ly)?|third(?:ly)?|on the other hand|as for|apart from that)\b/i;

/**
 * How each block sits in the mini threads of a long answer (15 Nov 2026, Martin: "any block of text that is
 * complimentary to the one before it… should show some sort of relationship. this could be text block staggering…
 * mini threads in long text responses without using pads"): 0 starts a thread, 1 and up follow on from the block
 * before, a step further in each time up to `THREAD_DEPTH_MAX`. Read by rule, no AI: only paragraphs and plain lists
 * thread; a paragraph follows on unless it opens with a word that turns to a new subject; a section, key point,
 * question or choice stands alone and ends the thread before it.
 */
export function threadDepths(blocks: { kind: string; text?: string }[]): number[] {
  const out: number[] = [];
  let depth = -1;
  for (const b of blocks) {
    const threads = b.kind === "para" || b.kind === "list";
    if (!threads) {
      depth = -1;
      out.push(0);
      continue;
    }
    const turns = b.kind === "para" && NEW_SUBJECT.test((b.text ?? "").trim());
    depth = depth < 0 || turns ? 0 : Math.min(depth + 1, THREAD_DEPTH_MAX);
    out.push(depth);
  }
  return out;
}

/** One item of a list as a row: who or what it is about, an amount when it leads with one, and the rest. */
export interface SolRow {
  name: string | null;
  amount: string | null;
  detail: string;
}

/**
 * A list item read as a row ("Taylor Test, $18,400: sent 10 days ago" is Taylor Test, $18,400 and the rest; "Grid
 * pre-approval: no sign it's been lodged" a name and the rest). An item with no short opening before a colon is all
 * detail. The words are his; only where each is drawn changes.
 */
export function solRow(item: string): SolRow {
  const m = /^(?:\*\*)?([^:\n]{2,60}?)(?:\*\*)?:\s+(\S.*)$/.exec(item);
  if (!m) return { name: null, amount: null, detail: item };
  const head = m[1].replace(/\*\*/g, "").trim();
  const money = /^(.+?),?\s+(\$[\d,]+(?:\.\d+)?k?)$/.exec(head);
  if (money && money[1].split(/\s+/).length <= 6) return { name: money[1].trim(), amount: money[2], detail: m[2] };
  if (/\d$/.test(head) || head.split(/\s+/).length > 7) return { name: null, amount: null, detail: item };
  return { name: head, amount: null, detail: m[2] };
}

/** Sol's words without the layout marks, for copying, quoting and team chat. */
export function solPlain(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(KEY, "").replace(ASK, ""))
    .join("\n");
}

/**
 * A question of Sol's that a Yes or a No answers (8 Nov 2026, Martin: his questions had no way to be answered): it
 * opens the way such questions do and offers no choice between things ("this or that?").
 */
export function isYesNoQuestion(question: string): boolean {
  const q = question.trim().replace(/^[^A-Za-z]+/, "");
  if (!q.endsWith("?")) return false;
  if (/\bor\b/i.test(q)) return false;
  return /^(do|does|did|want|shall|should|can|could|would|will|is|are|was|were|have|has|may|happy|ok|okay)\b/i.test(q);
}

/** The openings that ask whether to do something ("Want me to …", "Shall I …"), taken off an either/or's first half. */
const OFFER_OPENING = /^(?:do you want me to|would you like me to|want me to|shall i|should i|can i|do you want|would you like|want)\s+/i;
/** Second halves that aren't a choice of their own ("… or not?", "… or something else?"). */
const NOT_A_CHOICE = /^(not|neither|something else|anything else|both|none)$/i;
/** The longest either/or half kept as a pill. */
export const REPLY_PILL_MAX = 60;

/**
 * The pills under one of Sol's questions (26 Nov 2026, Martin: "Should have yes / no / Something else pills to help
 * reply to the question"). An offer of two things ("Want me to open the approvals list or draft a follow-up to
 * Roberto?") gives the two things; a yes-or-no question gives Yes and No; anything else gives none. "Something
 * else" (a reply in his own words) is always drawn beside them, so it isn't listed here.
 */
export function questionReplies(question: string): string[] {
  const q = question.trim().replace(/^[^A-Za-z]+/, "");
  if (!q.endsWith("?")) return [];
  const body = q.slice(0, -1).trim();
  const halves = body.split(/,?\s+or\s+/i);
  if (halves.length === 2 && OFFER_OPENING.test(halves[0])) {
    const first = halves[0].replace(OFFER_OPENING, "").trim();
    const second = halves[1].trim();
    if (NOT_A_CHOICE.test(second)) return ["Yes", "No"];
    const pills = [first, second].map((h) => h.charAt(0).toUpperCase() + h.slice(1));
    if (pills.every((h) => h.length >= 2 && h.length <= REPLY_PILL_MAX)) return pills;
    return [];
  }
  return isYesNoQuestion(q) ? ["Yes", "No"] : [];
}

/**
 * What goes to Sol when a question of his is answered from his message (a Yes, a No or a reply typed to it): the
 * question named, so he knows which one even from earlier in the chat. The chat shows only the answer.
 */
export function answerFor(question: string, answer: string): string {
  const q = question
    .trim()
    .replace(/^\?\s+/, "")
    .slice(0, 300);
  return `Answering your question "${q}": ${answer.trim()}`;
}

/**
 * What the box is replying to (21 Nov 2026, Martin: every message in a chat with Sol has a reply arrow on hover): one of
 * his questions answered, or any message of the chat, his or the member's.
 */
export type SolReply = { kind: "question"; text: string } | { kind: "message"; text: string; from: "you" | "sol" };

/** The longest piece of a replied-to message that goes to Sol (the chat shows a shorter clip, `MAX_QUOTE`). */
export const REPLY_CLIP = 600;

/**
 * What goes to Sol and what the chat shows when the box replies to something. A question: named for him, the chat shows
 * only the answer (`answerFor`). A message: named for him with as much of it as he needs to know which, and the chat
 * shows the reply under a one-line quote of it (`withQuote`, the customer chat's "> " line).
 */
export function replyToSol(reply: SolReply | null, typed: string): { said: string; shown?: string } {
  const words = typed.trim();
  if (!reply || !words) return { said: words };
  if (reply.kind === "question") return { said: answerFor(reply.text, words), shown: words };
  const plain = solPlain(reply.text).replace(/\s+/g, " ").trim();
  if (!plain) return { said: words };
  const clip = plain.length > REPLY_CLIP ? `${plain.slice(0, REPLY_CLIP - 1).trimEnd()}…` : plain;
  const whose = reply.from === "sol" ? "your message" : "what I said earlier";
  return { said: `Replying to ${whose}: "${clip}"\n\n${words}`, shown: withQuote(words, plain) };
}

/** The line over the box while it replies: whose message, and the start of it. */
export function replyLabel(reply: SolReply): { who: string; words: string } {
  if (reply.kind === "question") return { who: "Sol's question", words: reply.text };
  const plain = solPlain(reply.text).replace(/\s+/g, " ").trim();
  return { who: reply.from === "sol" ? "Sol" : "yourself", words: plain.length > 160 ? `${plain.slice(0, 159).trimEnd()}…` : plain };
}
