/**
 * The team chat (1 Nov 2026, Martin: Primero's team chat copied across, wave 3): a business's own members talking to
 * one another, opened from the rail down the right of every page. Three channels the whole team shares (Deals,
 * Installations, Service) and a direct conversation between any two members. In a channel, @someone tags a member
 * (they are emailed) and @Sol asks Sol, who answers there as the person who tagged him. # drops a deal in as a card;
 * pictures and files go with a line; lines can be changed or taken out by their writer, and anyone can react. Who wrote
 * a line is the signed-in member, set on the server; a direct conversation is only ever read by its two people;
 * nothing here reaches a customer. Pure, tested.
 */
import { handleOf } from "./mentions";
import type { ChatAction } from "./sol-chat-work";
import { cleanCharts, type SolChart } from "./sol-charts";
import { cleanDiagrams, type SolDiagram } from "./sol-diagrams";

export const TEAM_CHANNELS = [
  { id: "deals", label: "Deals" },
  { id: "installations", label: "Installations" },
  { id: "service", label: "Service" },
  { id: "grid", label: "Grid connections" },
] as const;
export type TeamChannel = (typeof TEAM_CHANNELS)[number]["id"];
const CHANNEL_IDS = new Set<string>(TEAM_CHANNELS.map((c) => c.id));

/**
 * A channel a business adds itself (14 Nov 2026, Martin: "I need to be able to add channels"): its own name, read by
 * the whole business like the four it starts with. Its id is made on the server.
 */
export interface OwnChannel {
  id: string;
  label: string;
}
export const OWN_CHANNELS_MAX = 20;
export const CHANNEL_NAME_MAX = 32;
const OWN_ID = /^ch_[a-f0-9]{12}$/;
export const isOwnChannelId = (room: string) => OWN_ID.test(room);

/** A channel's name as typed: no leading #, one line, letters, digits and a few marks, to `CHANNEL_NAME_MAX`. */
export function cleanChannelName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[^\p{L}\p{N} &'+/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHANNEL_NAME_MAX)
    .trim();
}

/** Why a channel of this (cleaned) name can't be added beside the business's own, or null when it can. */
export function channelNameProblem(name: string, own: readonly OwnChannel[]): string | null {
  if (name.length < 2) return "Give the channel a name of two letters or more.";
  if (own.length >= OWN_CHANNELS_MAX) return `A business can add up to ${OWN_CHANNELS_MAX} channels.`;
  const taken = [...TEAM_CHANNELS, ...own].some((c) => c.label.toLowerCase() === name.toLowerCase());
  return taken ? "There's already a channel with that name." : null;
}

/** Who Sol's lines are written by. Never a member's email (it has no "@"). */
export const SOL_BY = "sol";
export const TEAM_LINE_MAX = 2000;
/** Lines of one room sent to the page. */
export const TEAM_LINES_SHOWN = 200;
export const TEAM_DEALS_MAX = 3;
/** How often an open chat asks for new lines, and the rail for its count. */
export const TEAM_POLL_MS = 10_000;

export interface TeamFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

/** A deal dropped in with #, read from the business's own deals on the server when the line is sent. */
export interface TeamDeal {
  id: string;
  name: string;
  address: string;
  /** Its stage then, in words. */
  stage: string;
}

export interface TeamLine {
  id: string;
  /** A channel ("deals", "installations", "service", "grid") or a direct conversation (`dmRoom`). */
  room: string;
  /** The writer's email, or `SOL_BY`. */
  by: string;
  text: string;
  at: string;
  edited?: string;
  files?: TeamFile[];
  deals?: TeamDeal[];
  /** Each emoji with the emails of those who reacted with it, in the order they did. */
  reactions?: Record<string, string[]>;
  /** The message this line answers, as iMessage shows it: who wrote it and a line of it. */
  replyTo?: TeamReply;
  /** Sol's charts and diagrams with his answer (a battery's clearances, how strings run), drawn under his words. */
  charts?: SolChart[];
  diagrams?: SolDiagram[];
  /** Work Sol offers to do from what was said (sol-chat-work.ts): a card pressed by a person, never done by him. */
  action?: ChatAction;
}

/**
 * Sol's pictures as kept with a line, cleaned again whenever read (a diagram is rebuilt from its allowlist, so nothing
 * stored can carry script). Only Sol's lines have them; anything else is empty.
 */
export function cleanVisuals(v: unknown): { charts: SolChart[]; diagrams: SolDiagram[] } {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { charts: cleanCharts(r.charts), diagrams: cleanDiagrams(r.diagrams) };
}

/**
 * The message a reply answers, as shown above the reply: its id (to jump to it), who wrote it and a short line of it
 * (`replyQuote`), read fresh each time so an edit shows. `gone` once it has been deleted.
 */
export interface TeamReply {
  id: string;
  by: string;
  text: string;
  gone?: boolean;
}

/** The longest quote of a message shown above a reply. */
export const REPLY_QUOTE_MAX = 140;
const LINE_ID = /^tl_[a-f0-9]{8,64}$/;
export const isTeamLineId = (id: unknown): id is string => typeof id === "string" && LINE_ID.test(id);

/**
 * A message in a line, to show above a reply to it: its words on one line, cut at a word near `REPLY_QUOTE_MAX`;
 * with no words, what it carried ("A picture", "2 files", "A deal"). A deal is never named here: a reply's quote is
 * shown to everyone in the room, who may not all see that deal.
 */
export function replyQuote(line: {
  text: string;
  files?: readonly TeamFile[];
  deals?: readonly unknown[];
  diagrams?: readonly unknown[];
  charts?: readonly unknown[];
}): string {
  const words = line.text.replace(/\s+/g, " ").trim();
  if (words) {
    if (words.length <= REPLY_QUOTE_MAX) return words;
    const cut = words.slice(0, REPLY_QUOTE_MAX);
    const space = cut.lastIndexOf(" ");
    return `${(space > REPLY_QUOTE_MAX * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
  }
  const files = line.files ?? [];
  if (files.length === 1) return isTeamPicture(files[0].type) ? "A picture" : files[0].name;
  if (files.length > 1) return files.every((f) => isTeamPicture(f.type)) ? `${files.length} pictures` : `${files.length} files`;
  if (line.deals?.length) return line.deals.length === 1 ? "A deal" : `${line.deals.length} deals`;
  if (line.diagrams?.length) return "A diagram";
  if (line.charts?.length) return "A chart";
  return "A message";
}

/** The emojis offered, to type into a line and to react with; a reaction must be one of these. The first six are quick. */
export const TEAM_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "👀",
  "✅",
  "🙏",
  "🔥",
  "💯",
  "👏",
  "🙌",
  "💪",
  "😀",
  "😊",
  "😅",
  "🤔",
  "😮",
  "😢",
  "😎",
  "🤝",
  "👌",
  "☀️",
  "⚡",
  "🔋",
  "🏠",
  "📞",
  "📅",
  "📝",
  "💰",
  "🚀",
  "⚠️",
  "❌",
] as const;
export const TEAM_QUICK_REACTIONS = TEAM_EMOJIS.slice(0, 6);
const EMOJI_SET = new Set<string>(TEAM_EMOJIS);
const REACTORS_MAX = 50;

/** What one send may carry: about 4 MB together (what a request to the site can take), up to six files. */
export const TEAM_FILES_BYTES = 4 * 1024 * 1024;
export const TEAM_FILES_MAX = 6;
export const TEAM_FILE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export const TEAM_FILE_ACCEPT = Object.keys(TEAM_FILE_TYPES).join(",");
export const isTeamPicture = (type: string) => type.startsWith("image/");
const FILE_ID = /^tf_[a-f0-9]{16,32}$/;
export const isTeamFileId = (id: string) => FILE_ID.test(id);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** A file's name as it can be shown: no path or control characters, at most 100 characters. */
export function teamFileName(name: string, type: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 100);
  return base || `file.${TEAM_FILE_TYPES[type] ?? "bin"}`;
}

/** Why these files can't be sent together, or null when they can. */
export function teamFilesProblem(files: readonly { size: number; type: string }[]): string | null {
  if (files.length > TEAM_FILES_MAX) return `Up to ${TEAM_FILES_MAX} files at a time.`;
  if (files.some((f) => !TEAM_FILE_TYPES[f.type])) return "Send pictures, PDFs, Word, Excel, CSV or text files.";
  if (files.some((f) => f.size === 0)) return "One of those files is empty.";
  if (files.reduce((a, f) => a + f.size, 0) > TEAM_FILES_BYTES) return "That's over 4 MB together. Send fewer, or smaller ones.";
  return null;
}

/** The room two members talk in on their own: both emails, in order, so either of them opens the same one. */
export function dmRoom(a: string, b: string): string {
  return `dm:${[a.toLowerCase(), b.toLowerCase()].sort().join(",")}`;
}

/** The other person in a direct conversation, or null for a channel or a room this person isn't in. */
export function dmWith(room: string, me: string): string | null {
  if (!room.startsWith("dm:")) return null;
  const pair = room.slice(3).split(",");
  const self = me.toLowerCase();
  if (pair.length !== 2 || !pair.includes(self) || pair[0] === pair[1]) return null;
  return pair[0] === self ? pair[1] : pair[0];
}

/** A channel the whole business reads: one of the four it starts with, or one it added (by the shape of its id). */
export const isChannel = (room: string) => CHANNEL_IDS.has(room) || OWN_ID.test(room);

/**
 * Whether this member may read and write in a room: any channel (one the business added only while it is among
 * `own`, its ids), or a direct conversation with another member of the same business (`members`: its emails).
 */
export function mayUseRoom(room: string, me: string, members: readonly string[], own: readonly string[] = []): boolean {
  if (CHANNEL_IDS.has(room)) return true;
  if (OWN_ID.test(room)) return own.includes(room);
  const other = dmWith(room, me);
  return other !== null && members.map((m) => m.toLowerCase()).includes(other);
}

/** A room as sent from the browser, or null: a channel's id, or a direct conversation's. */
export function cleanRoom(raw: unknown): string | null {
  const room = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 420) : "";
  if (CHANNEL_IDS.has(room) || OWN_ID.test(room)) return room;
  return /^dm:[^,\s]+@[^,\s]+,[^,\s]+@[^,\s]+$/.test(room) ? room : null;
}

/** A room's name as shown: the channel's label, or the other person's name. */
export function roomLabel(room: string, me: string, own: readonly OwnChannel[] = []): string {
  const channel = TEAM_CHANNELS.find((c) => c.id === room) ?? own.find((c) => c.id === room);
  if (channel) return channel.label;
  const other = dmWith(room, me);
  return other ? nameOf(other) : "Conversation";
}

/** A member's name as the chat shows it: their email's first part, as @mentions name them; Sol is Sol. */
export function nameOf(email: string): string {
  if (email === SOL_BY) return "Sol";
  const h = handleOf(email)
    .replace(/[._-]+/g, " ")
    .trim();
  return h ? h.replace(/\b\w/g, (c) => c.toUpperCase()) : email;
}

/** Up to two letters for a member's round. */
export function initialsOf(email: string): string {
  if (email === SOL_BY) return "S";
  const parts = nameOf(email).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function cleanReactions(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!v || typeof v !== "object") return out;
  for (const [emoji, who] of Object.entries(v)) {
    if (!EMOJI_SET.has(emoji) || !Array.isArray(who)) continue;
    const people = [...new Set(who.filter((w): w is string => typeof w === "string").map((w) => w.toLowerCase().slice(0, 200)))]
      .filter(Boolean)
      .slice(0, REACTORS_MAX);
    if (people.length) out[emoji] = people;
  }
  return out;
}

/** This member's reaction with an emoji put on, or taken off when it is already theirs. Refused for an emoji not offered. */
export function toggledReaction(reactions: Record<string, string[]>, me: string, emoji: string): Record<string, string[]> {
  if (!EMOJI_SET.has(emoji)) throw new Error("Choose one of the emojis offered.");
  const by = me.toLowerCase();
  const next = { ...reactions };
  const who = next[emoji] ?? [];
  if (who.includes(by)) {
    const rest = who.filter((w) => w !== by);
    if (rest.length) next[emoji] = rest;
    else delete next[emoji];
  } else next[emoji] = [...who, by].slice(0, REACTORS_MAX);
  return next;
}

export function cleanFiles(v: unknown): TeamFile[] {
  return (Array.isArray(v) ? v : [])
    .map((f) => {
      const x = (f ?? {}) as Partial<TeamFile>;
      return { id: str(x.id, 40), name: str(x.name, 100), type: str(x.type, 120), size: Number(x.size) || 0 };
    })
    .filter((f) => FILE_ID.test(f.id) && f.name && TEAM_FILE_TYPES[f.type])
    .slice(0, TEAM_FILES_MAX);
}

export function cleanDeals(v: unknown): TeamDeal[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v : [])
    .map((d) => {
      const x = (d ?? {}) as Partial<TeamDeal>;
      return { id: str(x.id, 60), name: str(x.name, 200), address: str(x.address, 300), stage: str(x.stage, 120) };
    })
    .filter((d) => {
      if (!/^[\w-]{1,60}$/.test(d.id) || !d.name || seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    })
    .slice(0, TEAM_DEALS_MAX);
}

/** The deal ids a line asks for, as sent from the browser: at most `TEAM_DEALS_MAX`, each a plausible id. */
export const cleanDealIds = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : []).filter((d): d is string => typeof d === "string" && /^[\w-]{1,60}$/.test(d)))].slice(
    0,
    TEAM_DEALS_MAX,
  );

/** A line's words as sent: trimmed, to `TEAM_LINE_MAX`. */
export const cleanWords = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, TEAM_LINE_MAX) : "");

/** The #word being typed at the caret, for the deals to offer; null when the caret isn't in one. */
export function typingDeal(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)#([^#\n]{0,60})$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

/** The @word being typed at the caret, for the people to offer; null when the caret isn't in one. */
export function typingTag(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)@([\w.-]{0,40})$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

/** Whether a line may tag people: only in a channel (a direct conversation is already just the two of them). */
export const tagsIn = (room: string) => isChannel(room);

/** Whether a line in a channel asks Sol. */
export const asksSol = (room: string, text: string) => tagsIn(room) && /(^|\s)@sol\b/i.test(text);

/**
 * Lines from others in each room this member may read, since they last had that room open (`seen`, by room). A room
 * never opened counts the last day's.
 */
export function unreadByRoom(
  lines: readonly Pick<TeamLine, "room" | "by" | "at">[],
  seen: Record<string, string>,
  me: string,
  now: Date,
): Record<string, number> {
  const self = me.toLowerCase();
  const out: Record<string, number> = {};
  for (const l of lines) {
    if (l.by === self) continue;
    const since = Date.parse(seen[l.room] ?? "") || now.getTime() - 24 * 3600_000;
    if (Date.parse(l.at) > since) out[l.room] = (out[l.room] ?? 0) + 1;
  }
  return out;
}

/** Whether the words tag this member (their whole handle after an @). */
export function tags(text: string, email: string): boolean {
  const h = handleOf(email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Boolean(h) && new RegExp(`(^|\\s)@${h}\\b`, "i").test(text);
}

/** The email telling a member they were tagged: who, which channel, the words, and a link that opens the chat. */
export function teamTagEmail(input: { by: string; channel: string; text: string; link: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const by = nameOf(input.by);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const subject = `${by} tagged you in ${input.channel}`;
  const text = `${by} tagged you in the team chat's ${input.channel} channel:\n\n${input.text}\n\nOpen the chat: ${input.link}`;
  const html = `<div style="font:14px/1.6 Arial,sans-serif;color:#111"><p>${esc(by)} tagged you in the team chat's ${esc(input.channel)} channel:</p>
<blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #ddd;color:#333">${esc(input.text).replace(/\n/g, "<br>")}</blockquote>
<p><a href="${esc(input.link)}" style="display:inline-block;padding:10px 16px;background:#3a3d43;color:#fff;border-radius:6px;text-decoration:none">Open the chat</a></p></div>`;
  return { subject, text, html };
}
