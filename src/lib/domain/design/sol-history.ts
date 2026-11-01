/**
 * Sol's past conversations (1 Nov 2026, Martin: "a little clock-wind-back icon inside Sol's chat that surfaces past
 * conversations", and after a while away, ask whether to start a new chat). Each member has one conversation going and
 * keeps the ones before it: a new chat files the current one away (its pinned messages carry on into the new one), and
 * any past one can be read or picked up again, which files the current one away in its place. Pure: no I/O.
 */
import { cleanTurns, type SolTurn } from "./sol";

export interface SolPast {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  turns: SolTurn[];
}

/** What the history list shows: never the turns themselves. */
export interface SolPastLine {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  /** How many messages it holds. */
  count: number;
}

/** The most past conversations a member keeps: the oldest goes first. */
export const MAX_PAST = 40;
/** After this long since the last message, opening Sol asks whether to carry on or start a new chat. */
export const RETURN_GAP_HOURS = 4;

const ZONE = "Australia/Melbourne";

/** A conversation is worth keeping once the member has said something in it (Sol's reminders alone are not). */
export const worthKeeping = (turns: readonly SolTurn[]) => turns.some((t) => t.role === "you" && t.text.trim());

/** What a conversation is called in the list: the member's first question, on one line. */
export function titleOf(turns: readonly SolTurn[]): string {
  const first = turns.find((t) => t.role === "you" && t.text.trim()) ?? turns.find((t) => t.text.trim());
  const line = (first?.text ?? "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return "A conversation with Sol";
  return line.length > 70 ? `${line.slice(0, 69).trimEnd()}…` : line;
}

/** The current conversation filed away, newest first, within `MAX_PAST`; unchanged when there is nothing to keep. */
export function fileAway(past: readonly SolPast[], turns: readonly SolTurn[], id: string): SolPast[] {
  if (!worthKeeping(turns)) return [...past];
  const at = (t: SolTurn | undefined) => t?.at ?? new Date().toISOString();
  return [{ id, title: titleOf(turns), startedAt: at(turns[0]), endedAt: at(turns[turns.length - 1]), turns: [...turns] }, ...past].slice(
    0,
    MAX_PAST,
  );
}

/** The new conversation a fresh start begins with: only the pinned messages carry on. */
export const freshTurns = (turns: readonly SolTurn[]) => turns.filter((t) => t.pinned);

export const pastLines = (past: readonly SolPast[]): SolPastLine[] =>
  past.map(({ id, title, startedAt, endedAt, turns }) => ({ id, title, startedAt, endedAt, count: turns.length }));

/** Whether opening Sol should ask to carry on or start afresh: something was said, and the last of it a while ago. */
export function askToStartAfresh(turns: readonly SolTurn[], now: Date, gapHours = RETURN_GAP_HOURS): boolean {
  const last = turns[turns.length - 1];
  if (!last || !worthKeeping(turns)) return false;
  return now.getTime() - Date.parse(last.at) > gapHours * 3_600_000;
}

const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONE });
const DAY_MS = 86_400_000;
const dayNo = (d: Date) => Math.round(Date.parse(`${day(d)}T00:00:00Z`) / DAY_MS);

/** The heading a past conversation sits under, in the market's days: Today, Yesterday, This week, then the month. */
export function pastGroup(at: string, now: Date): string {
  const d = new Date(at);
  const ago = dayNo(now) - dayNo(d);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return "This week";
  return d.toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: ZONE });
}

/** "3:15 pm" today, "Tue" this week, "18 Oct" before. */
export function pastWhen(at: string, now: Date): string {
  const d = new Date(at);
  const ago = dayNo(now) - dayNo(d);
  if (ago <= 0)
    return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: ZONE }).replace(/\s?([ap])\.?m\.?/i, " $1m");
  if (ago < 7) return d.toLocaleDateString("en-AU", { weekday: "short", timeZone: ZONE });
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: ZONE });
}

/** Past conversations as kept, each to its shape (turns through `cleanTurns`), newest first, within `MAX_PAST`. */
export function cleanPast(raw: unknown): SolPast[] {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return (Array.isArray(raw) ? raw : [])
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
    .map((p) => {
      const turns = cleanTurns(p.turns);
      return {
        id: str(p.id, 40),
        title: str(p.title, 80) || titleOf(turns),
        startedAt: str(p.startedAt, 40),
        endedAt: str(p.endedAt, 40),
        turns,
      };
    })
    .filter((p) => p.id && p.turns.length)
    .slice(0, MAX_PAST);
}
