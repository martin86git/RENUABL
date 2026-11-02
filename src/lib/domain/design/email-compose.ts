/**
 * Writing an email to a customer (a deal's Email tab, and sending a proposal):
 * bullet and numbered lists typed as text, symbols put in at the caret, and
 * pictures and files sent with it. The words are kept as typed, which is the
 * email's plain-text version; `messageHtml` turns the lists into real lists for
 * the HTML version, with inline styles, since email clients ignore stylesheets.
 * Pictures go inside the email as `cid:` attachments under the words, never as
 * links. Pure, tested.
 */

import { TEAM_FILE_TYPES } from "./team-chat";

/** The same kinds the team chat and a deal's attachments take. */
export const EMAIL_FILE_TYPES: Readonly<Record<string, string>> = TEAM_FILE_TYPES;
export const EMAIL_FILES_MAX = 6;
/** 4 MB together keeps the request under Vercel's ~4.5 MB body limit. */
export const EMAIL_FILES_BYTES = 4 * 1024 * 1024;
const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const PICTURE_ACCEPT = PICTURE_TYPES.join(",");
export const FILE_ACCEPT = Object.keys(EMAIL_FILE_TYPES)
  .filter((t) => !PICTURE_TYPES.includes(t))
  .join(",");

export const isPicture = (type: string) => PICTURE_TYPES.includes(type);

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
export const fileSize = size;

/** Why these files can't go with the email, or null when they can. */
export function emailFilesProblem(files: readonly { size: number; type: string; name?: string }[]): string | null {
  if (files.length > EMAIL_FILES_MAX) return `Up to ${EMAIL_FILES_MAX} files with one email.`;
  const odd = files.find((f) => !EMAIL_FILE_TYPES[f.type]);
  if (odd) return `${odd.name ? `${odd.name} can't be sent. ` : ""}Send pictures, PDFs, Word, Excel, CSV or text files.`;
  const empty = files.find((f) => f.size === 0);
  if (empty) return `${empty.name ?? "One of those files"} is empty.`;
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > EMAIL_FILES_BYTES)
    return `That's ${size(total)} together, over the 4 MB an email can carry. Take one off, or send smaller ones.`;
  return null;
}

/**
 * How many bytes each picture may take once shrunk: what the other files leave of the 4 MB, shared evenly, never
 * under 150 KB (a picture that can't get that small is left for the limit to refuse).
 */
export function pictureBudget(otherBytes: number, pictures: number): number {
  if (pictures <= 0) return EMAIL_FILES_BYTES;
  return Math.max(150 * 1024, Math.floor((EMAIL_FILES_BYTES - otherBytes) / pictures) - 1024);
}

const EXTENSIONS: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "application/vnd.ms-excel": ["xls"] };

/**
 * A file's name as it can go in an email: no path, control characters or `<>:"/\|?*`, at most 100 characters, and the
 * extension its type has. A pasted screenshot (named "image.png" by the browser, or nothing) is "picture-N.png".
 */
export function emailFileName(name: string, type: string, n = 1): string {
  const ext = EMAIL_FILE_TYPES[type] ?? "bin";
  const exts = EXTENSIONS[type] ?? [ext];
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!base || (isPicture(type) && /^image\.(png|jpe?g|gif|webp)$/i.test(base))) return `picture-${n}.${ext}`;
  const dot = base.lastIndexOf(".");
  const has = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (exts.includes(has)) return base.length > 100 ? `${base.slice(0, 99 - has.length)}.${has}` : base;
  // A known extension of another kind (a photo redrawn as JPEG) is swapped; anything else is kept and the right one added.
  const stem = (has && Object.values(EMAIL_FILE_TYPES).concat("jpeg", "heic").includes(has) ? base.slice(0, dot) : base).slice(0, 95);
  return `${stem || "file"}.${ext}`;
}

/** The symbols popover: marks first, then a few emoji. */
export const EMAIL_SYMBOLS: readonly string[] = [
  "✓",
  "✗",
  "→",
  "←",
  "↑",
  "↓",
  "•",
  "–",
  "—",
  "…",
  "°",
  "½",
  "¼",
  "¾",
  "×",
  "±",
  "≈",
  "≤",
  "≥",
  "€",
  "£",
  "©",
  "™",
  "☀️",
  "⚡",
  "🔋",
  "🔌",
  "🏠",
  "👍",
  "🙂",
  "🎉",
  "📅",
];

export type ListKind = "bullets" | "numbers";
export type MessageBlock =
  { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; start: number; items: string[] };

const BULLET = /^\s*([•*-])\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})([.)])\s+(.*)$/;
/** A list line as typed, even with nothing after its marker yet ("• "). */
const BULLET_LINE = /^\s*([•*-])(?:\s+(.*))?$/;
const NUMBER_LINE = /^\s*(\d{1,3})([.)])(?:\s+(.*))?$/;

/** The words as paragraphs and lists: "• ", "- " or "* " starts a bullet, "1. " or "1) " a numbered item. */
export function messageBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", lines: para });
    para = [];
  };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBER);
    if (b || n) {
      flush();
      const last = blocks[blocks.length - 1];
      const item = (b ? b[2] : n![3]).trim();
      if (b) {
        if (last?.kind === "ul") last.items.push(item);
        else blocks.push({ kind: "ul", items: [item] });
      } else if (last?.kind === "ol") last.items.push(item);
      else blocks.push({ kind: "ol", start: Number(n![1]) || 1, items: [item] });
      continue;
    }
    if (!line.trim()) {
      flush();
      // A blank line ends a list, so the next list starts afresh.
      const last = blocks[blocks.length - 1];
      if (last && last.kind !== "p") blocks.push({ kind: "p", lines: [] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks
    .filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.some(Boolean)))
    .map((b) => (b.kind === "p" ? b : { ...b, items: b.items.filter(Boolean) }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The words as HTML: escaped, paragraphs with line breaks, and real lists styled inline. */
export function messageHtml(text: string): string {
  const li = (items: string[]) => items.map((i) => `<li style="margin:0 0 4px">${esc(i)}</li>`).join("");
  return messageBlocks(text)
    .map((b) => {
      if (b.kind === "p") return `<p>${b.lines.map(esc).join("<br>")}</p>`;
      if (b.kind === "ul") return `<ul style="margin:0 0 14px;padding-left:22px">${li(b.items)}</ul>`;
      return `<ol${b.start !== 1 ? ` start="${b.start}"` : ""} style="margin:0 0 14px;padding-left:24px">${li(b.items)}</ol>`;
    })
    .join("\n");
}

/** The `<img>` tags for pictures carried in the email by their inline ids, to go under the words. */
export function picturesHtml(ids: readonly string[]): string {
  return ids
    .map(
      (id) =>
        `<p style="margin:16px 0 0"><img src="cid:${esc(id)}" alt="" style="display:block;max-width:100%;height:auto;border-radius:6px"></p>`,
    )
    .join("\n");
}

const count = (n: number, one: string, many: string) => (n === 1 ? `A ${one}` : `${n} ${many}`);

/** "(A picture and a file are attached.)" for the plain-text version; empty with nothing attached. */
export function attachedLine(pictures: number, others: number): string {
  if (!pictures && !others) return "";
  const parts = [pictures ? count(pictures, "picture", "pictures") : "", others ? count(others, "file", "files") : ""].filter(Boolean);
  const words = parts.map((p, i) => (i ? p.replace(/^A /, "a ") : p)).join(" and ");
  return `(${words} ${pictures + others === 1 ? "is" : "are"} attached.)`;
}

type Selection = { text: string; start: number; end: number };

const lineStartAt = (text: string, at: number) => text.lastIndexOf("\n", at - 1) + 1;
const lineEndAt = (text: string, at: number) => {
  const i = text.indexOf("\n", at);
  return i < 0 ? text.length : i;
};
const unmarked = (line: string) => {
  const b = line.match(BULLET_LINE);
  if (b) return b[2] ?? "";
  const n = line.match(NUMBER_LINE);
  return n ? (n[3] ?? "") : line;
};
const kindOf = (line: string): ListKind | null => (BULLET_LINE.test(line) ? "bullets" : NUMBER_LINE.test(line) ? "numbers" : null);

/**
 * The Bullets or Numbering button: every line the selection touches becomes that list; when they all already are,
 * they go back to plain text. Blank lines in the middle are left blank. Answers the new text and selection.
 */
export function withList(text: string, start: number, end: number, kind: ListKind): Selection {
  const from = lineStartAt(text, start);
  // A selection ending just after a line break doesn't take in the line below it.
  const to = lineEndAt(text, end > start && text[end - 1] === "\n" ? end - 1 : end);
  const lines = text.slice(from, to).split("\n");
  const filled = lines.filter((l) => l.trim());
  const undo = filled.length > 0 && filled.every((l) => kindOf(l) === kind);
  let n = 0;
  const next = lines.map((line) => {
    if (undo) return unmarked(line);
    if (!line.trim() && lines.length > 1) return line;
    n += 1;
    return `${kind === "bullets" ? "•" : `${n}.`} ${unmarked(line).trimStart()}`;
  });
  const block = next.join("\n");
  const out = text.slice(0, from) + block + text.slice(to);
  return start === end && lines.length === 1
    ? { text: out, start: from + block.length, end: from + block.length }
    : { text: out, start: from, end: from + block.length };
}

/**
 * Enter on a list line: carries the list on with the next bullet or number, or, on a list line with nothing after its
 * marker, ends the list (the marker goes). Null on a line that isn't a list, so Enter does as it always does.
 */
export function listEnter(text: string, caret: number): { text: string; caret: number } | null {
  const from = lineStartAt(text, caret);
  const to = lineEndAt(text, caret);
  const line = text.slice(from, to);
  const b = line.match(BULLET_LINE);
  const n = b ? null : line.match(NUMBER_LINE);
  if (!b && !n) return null;
  // A caret inside the marker itself is ordinary typing.
  const marker = line.length - (b ? (b[2] ?? "") : (n![3] ?? "")).length;
  if (caret - from < marker && (b ? b[2] : n![3])) return null;
  if (!(b ? b[2] : n![3])?.trim()) return { text: text.slice(0, from) + text.slice(to), caret: from };
  const indent = line.match(/^\s*/)![0];
  const mark = b ? `${indent}${b[1]} ` : `${indent}${Number(n![1]) + 1}${n![2]} `;
  const insert = `\n${mark}`;
  return { text: text.slice(0, caret) + insert + text.slice(caret).replace(/^[ \t]+/, ""), caret: caret + insert.length };
}

/** A symbol in at the caret, over anything selected. */
export function atCaret(text: string, start: number, end: number, insert: string): { text: string; caret: number } {
  return { text: text.slice(0, start) + insert + text.slice(end), caret: start + insert.length };
}
