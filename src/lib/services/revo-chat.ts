/**
 * The conversation with Revo, shared by every Ask Revo button on the page and
 * kept for the visit (sessionStorage), so it carries on from page to page.
 */
import { useSyncExternalStore } from "react";

export interface RevoTurn {
  q: string;
  /** null while Revo is answering. */
  a: string | null;
}

const KEY = "renuabl.revo.v1";
const MAX_TURNS = 30;
const EMPTY: RevoTurn[] = [];

let turns: RevoTurn[] | null = null;
const listeners = new Set<() => void>();

function read(): RevoTurn[] {
  if (turns) return turns;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    turns = Array.isArray(parsed)
      ? parsed.filter((t): t is { q: string; a: string } => typeof t?.q === "string" && typeof t?.a === "string")
      : [];
  } catch {
    turns = [];
  }
  return turns;
}

function write(next: RevoTurn[]) {
  turns = next.slice(-MAX_TURNS);
  try {
    // Only finished turns are kept; an unanswered question isn't restored.
    window.sessionStorage.setItem(KEY, JSON.stringify(turns.filter((t) => t.a !== null)));
  } catch {
    /* storage unavailable: the chat still works on this page */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRevoChat() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    turns: list,
    busy: list.at(-1)?.a === null,
    /** Finished turns, oldest first, for the next question's context. */
    history: () => read().filter((t): t is { q: string; a: string } => t.a !== null),
    start: (q: string) => write([...read(), { q, a: null }]),
    finish: (a: string) => {
      const cur = read();
      write(cur.map((t, i) => (i === cur.length - 1 && t.a === null ? { ...t, a } : t)));
    },
    clear: () => write([]),
  };
}
