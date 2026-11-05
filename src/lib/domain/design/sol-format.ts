/**
 * How Sol's answers are laid out to read at a glance (5 Nov 2026, Martin: a question three quarters of the way down a
 * long answer is easily missed). Sol writes plain text with a few marks (`SOL_LAYOUT` in his instructions): short
 * paragraphs with a blank line between, "- " lines for a list, the one point that matters most on a line starting "! ",
 * and a question to the reader on a line starting "? ". This reads that back into blocks: paragraphs, round-bulleted
 * lists, a highlighted key point and a highlighted question. A long paragraph is broken at its sentences, a lone
 * question is highlighted even unmarked, and the routine "Want more detail?" stays quiet. Pure, tested.
 */
import { MORE_DETAIL } from "./sol-charts";

export type SolBlock =
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[] }
  /** The salient point, in a highlighted pad. */
  | { kind: "key"; text: string }
  /** A question put to the reader, highlighted so it isn't missed. */
  | { kind: "ask"; text: string }
  /** The routine offer of more detail, kept quiet. */
  | { kind: "more"; text: string };

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
  return out;
}

/** Sol's words without the layout marks, for copying, quoting and team chat. */
export function solPlain(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(KEY, "").replace(ASK, ""))
    .join("\n");
}
