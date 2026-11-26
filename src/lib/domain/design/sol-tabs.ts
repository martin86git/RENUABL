/**
 * Sol's chats kept as tabs (26 Nov 2026, Martin: while Sol is still answering, minimise the chat and carry on
 * elsewhere, as a web browser's tab; only on purpose, never by leaving the page). A tab is a chat on Today minimised:
 * its first question as its name, when the chat began, and whether an answer was still coming. Its words are never kept
 * here: Sol's own conversation holds them (Today's room, sol-rooms.ts), and reopening a tab reads them back from there.
 * Kept in the browser for the visit only.
 */
import type { SolTurn } from "./sol";
import { roomTurns } from "./sol-rooms";

/** A tab's state: an answer still coming, an answer come since it was minimised, or nothing new. */
export type SolTabStatus = "writing" | "ready" | "idle";

export interface SolTab {
  id: string;
  /** The chat's first question, short. */
  title: string;
  /** When the chat began: its turns are Today's from here on. */
  since: string;
  /** When its latest question was asked, while the answer was still coming. */
  waitingSince: string | null;
  status: SolTabStatus;
  /** When it was minimised. */
  at: string;
}

/** The most tabs kept: one more takes the place of the oldest without news. */
export const MAX_TABS = 6;
/** How long a title runs before it is cut. */
export const TITLE_MAX = 34;
/** Leeway for the browser's clock against the server's, when a chat's turns are read back. */
export const CLOCK_SLACK_MS = 15_000;

/** A tab's name from its first question: one line, cut at a whole word. */
export function tabTitle(question: string): string {
  const line = question.replace(/\s+/g, " ").trim();
  if (!line) return "Chat with Sol";
  if (line.length <= TITLE_MAX) return line;
  const cut = line.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > TITLE_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

/** When a chat begins, read back against the server's times: a little before, for the clocks. */
export const chatSince = (nowMs: number): string => new Date(nowMs - CLOCK_SLACK_MS).toISOString();

/** A tab's turns in Today's conversation. */
export function tabTurns(turns: readonly SolTurn[], tab: Pick<SolTab, "since"> & Partial<Pick<SolTab, "at">>): SolTurn[] {
  const mine = roomTurns(turns, "today").filter((t) => t.at >= tab.since);
  if (!tab.at) return mine;
  // Only this chat's: a question asked after it was minimised belongs to the chat that came after it.
  const end = new Date(Date.parse(tab.at) + CLOCK_SLACK_MS).toISOString();
  const next = mine.findIndex((t) => t.role === "you" && t.at > end);
  return next < 0 ? mine : mine.slice(0, next);
}

/** A tab's turns in a conversation filed away since (Sol's new chat files Today's turns with his panel's). */
export const tabTurnsIn = (past: readonly { turns: readonly SolTurn[] }[], tab: Pick<SolTab, "since" | "at">): SolTurn[] => {
  for (const p of past) {
    const found = tabTurns(p.turns, tab);
    if (found.length) return found;
  }
  return [];
};

/** Whether the answer a tab was waiting for has come (an answer of Sol's after its question was asked). */
export const answerCame = (turns: readonly SolTurn[], tab: Pick<SolTab, "since" | "waitingSince">): boolean =>
  tab.waitingSince !== null && tabTurns(turns, tab).some((t) => t.role === "sol" && t.at >= tab.waitingSince!);

/** The tabs with a waiting one marked ready once its answer is in Sol's conversation. */
export function withAnswers(tabs: readonly SolTab[], turns: readonly SolTurn[]): SolTab[] {
  return tabs.map((t) => (t.status === "writing" && answerCame(turns, t) ? { ...t, status: "ready" as const, waitingSince: null } : t));
}

/** A tab added at the top; past the most, the oldest without news goes (else the oldest). */
export function addTab(tabs: readonly SolTab[], tab: SolTab): SolTab[] {
  const rest = tabs.filter((t) => t.id !== tab.id);
  const all = [tab, ...rest];
  if (all.length <= MAX_TABS) return all;
  const quiet = [...all].reverse().find((t) => t.status === "idle" && t.id !== tab.id);
  const drop = quiet ?? all[all.length - 1];
  return all.filter((t) => t !== drop);
}

/** Tabs as read back from the browser: only whole ones, at most the most. */
export function cleanTabs(raw: unknown): SolTab[] {
  if (!Array.isArray(raw)) return [];
  const ok: SolTab[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const t = r as Record<string, unknown>;
    const status = t.status === "writing" || t.status === "ready" || t.status === "idle" ? t.status : null;
    if (typeof t.id !== "string" || typeof t.title !== "string" || typeof t.since !== "string" || typeof t.at !== "string") continue;
    if (!status) continue;
    ok.push({
      id: t.id.slice(0, 40),
      title: t.title.slice(0, TITLE_MAX + 1),
      since: t.since,
      at: t.at,
      status,
      waitingSince: typeof t.waitingSince === "string" ? t.waitingSince : null,
    });
    if (ok.length >= MAX_TABS) break;
  }
  return ok;
}

/** A tab's line under its name. */
export function tabWords(tab: Pick<SolTab, "status" | "at">, nowMs: number): string {
  if (tab.status === "writing") return "Sol is writing it up…";
  if (tab.status === "ready") return "Answer ready";
  const mins = Math.max(0, Math.round((nowMs - Date.parse(tab.at)) / 60_000));
  return mins < 1 ? "Minimised just now" : mins < 60 ? `Minimised · ${mins} min ago` : "Minimised · over an hour ago";
}

/** The folded round's count, and whether it pulses (writing) or is lit (an answer ready). */
export const tabsGlance = (tabs: readonly SolTab[]) => ({
  count: tabs.length,
  writing: tabs.some((t) => t.status === "writing"),
  ready: tabs.some((t) => t.status === "ready"),
});
