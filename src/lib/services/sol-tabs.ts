"use client";

/**
 * Sol's chats kept as tabs (domain/design/sol-tabs.ts): kept in the browser for the visit, told to every screen that
 * shows them, and marked ready when the answer a tab waited on reaches Sol's conversation.
 */
import { useEffect, useState } from "react";
import type { SolState } from "@/lib/domain/design/sol";
import { addTab, cleanTabs, withAnswers, type SolTab } from "@/lib/domain/design/sol-tabs";
import { SOL_CHANGED, loadSol } from "./sol";

const KEY = "renuabl.design.sol-tabs";
/** Told whenever the tabs change. */
export const SOL_TABS_CHANGED = "renuabl:sol-tabs";
/** Asks Today to open a tab's chat (its id as the detail). */
export const OPEN_SOL_TAB = "renuabl:open-sol-tab";
/** How often a waiting tab looks for its answer when no screen has told it. */
const LOOK_EVERY_MS = 5000;

function read(): SolTab[] {
  try {
    return cleanTabs(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function write(tabs: SolTab[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(tabs));
  } catch {
    // A private window: the tabs last only while this page does.
  }
  memory = tabs;
  window.dispatchEvent(new CustomEvent(SOL_TABS_CHANGED, { detail: tabs }));
}

let memory: SolTab[] | null = null;
const current = () => memory ?? (memory = read());

/** A chat minimised into a tab. */
export const keepTab = (tab: SolTab) => write(addTab(current(), tab));
/** A tab taken back into the chat, or closed. */
export const dropTab = (id: string) => write(current().filter((t) => t.id !== id));
/** A tab by its id. */
export const tabById = (id: string) => current().find((t) => t.id === id) ?? null;

function markAnswers(state: SolState) {
  const now = current();
  const next = withAnswers(now, state.turns);
  if (next.some((t, i) => t !== now[i])) write(next);
}

/** The tabs, kept up to date; while one waits, it looks for its answer itself. */
export function useSolTabs(): SolTab[] {
  const [tabs, setTabs] = useState<SolTab[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read from the browser once the page is up
    setTabs(current());
    const changed = (e: Event) => setTabs((e as CustomEvent<SolTab[]>).detail);
    const solChanged = (e: Event) => {
      const state = (e as CustomEvent<SolState | undefined>).detail;
      if (state?.turns) markAnswers(state);
    };
    window.addEventListener(SOL_TABS_CHANGED, changed);
    window.addEventListener(SOL_CHANGED, solChanged);
    return () => {
      window.removeEventListener(SOL_TABS_CHANGED, changed);
      window.removeEventListener(SOL_CHANGED, solChanged);
    };
  }, []);
  const waiting = tabs.some((t) => t.status === "writing");
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadSol().then((r) => r.ok && markAnswers(r.state));
    }, LOOK_EVERY_MS);
    return () => window.clearInterval(t);
  }, [waiting]);
  return tabs;
}
