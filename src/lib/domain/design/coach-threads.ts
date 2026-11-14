/**
 * The chats a business has had with its phone assistant, kept apart (14 Nov 2026, Martin: typing to the assistant from
 * its day "continues on in an old thread which is confusing. I need it to start a new chat thread, and I should be able
 * to find previous chat threads"). One chat is the one going; the ones before it are kept, newest first. Typing from the
 * assistant's day starts a new chat, which files the one going away; any earlier chat can be opened again, which files
 * the one going away in its place. The script (the notes) is the business's and is the same whichever chat is open.
 * Pure: no I/O.
 */
import { cleanTurns, type CoachTurn } from "./coaching";

export interface CoachChat {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  turns: CoachTurn[];
}

/** What the list of chats shows: never the turns themselves. */
export interface CoachChatLine {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  /** How many messages it holds. */
  count: number;
}

/** The most earlier chats kept: the oldest goes first. */
export const MAX_COACH_CHATS = 30;
const TITLE_MAX = 64;

export const isChatId = (raw: unknown): raw is string => typeof raw === "string" && /^cc_[0-9a-f]{8,32}$/.test(raw);

/** A chat is worth keeping once someone has said something in it. */
export const chatWorthKeeping = (turns: readonly CoachTurn[]) => turns.some((t) => t.role === "you" && t.text.trim());

/** What a chat is called in the list: the first thing said to the assistant, on one line. */
export function chatTitle(turns: readonly CoachTurn[]): string {
  const first = turns.find((t) => t.role === "you" && t.text.trim());
  const line = (first?.text ?? "").replace(/\s+/g, " ").trim();
  if (!line) return "A chat";
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1).trimEnd()}…` : line;
}

/** The chat going, as the list shows it; null while nothing has been said in it. */
export function currentChatLine(turns: readonly CoachTurn[]): Omit<CoachChatLine, "id"> | null {
  if (!chatWorthKeeping(turns)) return null;
  return { title: chatTitle(turns), startedAt: turns[0].at, endedAt: turns[turns.length - 1].at, count: turns.length };
}

/** The chat going filed away, newest first, within the limit; unchanged when there is nothing to keep. */
export function fileChatAway(past: readonly CoachChat[], turns: readonly CoachTurn[], id: string): CoachChat[] {
  const line = currentChatLine(turns);
  if (!line) return [...past];
  return [{ id, title: line.title, startedAt: line.startedAt, endedAt: line.endedAt, turns: [...turns] }, ...past].slice(
    0,
    MAX_COACH_CHATS,
  );
}

/**
 * An earlier chat opened again: it becomes the one going and leaves the list, and the one that was going is filed away
 * in its place. Null when that chat isn't there.
 */
export function reopenChat(
  past: readonly CoachChat[],
  turns: readonly CoachTurn[],
  id: string,
  newId: string,
): { past: CoachChat[]; turns: CoachTurn[] } | null {
  const found = past.find((p) => p.id === id);
  if (!found) return null;
  return {
    past: fileChatAway(
      past.filter((p) => p.id !== id),
      turns,
      newId,
    ),
    turns: [...found.turns],
  };
}

export const forgetChat = (past: readonly CoachChat[], id: string) => past.filter((p) => p.id !== id);

export const chatLines = (past: readonly CoachChat[]): CoachChatLine[] =>
  past.map(({ id, title, startedAt, endedAt, turns }) => ({ id, title, startedAt, endedAt, count: turns.length }));

/** Earlier chats as read back from storage: only whole ones with something said, within the limit. */
export function cleanCoachChats(raw: unknown): CoachChat[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: CoachChat[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const c = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    if (!isChatId(c.id) || seen.has(c.id)) continue;
    const turns = cleanTurns(c.turns);
    const line = currentChatLine(turns);
    if (!line) continue;
    seen.add(c.id);
    out.push({ id: c.id, title: line.title, startedAt: line.startedAt, endedAt: line.endedAt, turns });
  }
  return out.slice(0, MAX_COACH_CHATS);
}

/** When a chat was last added to, in a few words: "today", "yesterday", "12 Nov". */
export function chatDayWords(at: string, now: Date, timeZone: string): string {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
  const no = (d: Date) => Math.round(Date.parse(`${day(d)}T00:00:00Z`) / 86_400_000);
  const then = new Date(at);
  if (Number.isNaN(then.getTime())) return "";
  const ago = no(now) - no(then);
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  return then.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone });
}
