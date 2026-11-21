/**
 * Sol, as the screens ask for him (`/api/design/sol`): the member's own conversation, and the events that open his
 * panel from anywhere and keep the rail's count in step.
 */
import type { SolFile, SolState, WhenChoice } from "@/lib/domain/design/sol";
import type { SolPast, SolPastLine } from "@/lib/domain/design/sol-history";
import type { KnowledgeEntry } from "@/lib/domain/design/sol-knowledge";
import type { PageContext } from "@/lib/domain/design/page-context";
import type { SolRoom } from "@/lib/domain/design/sol-rooms";
import { ask } from "./crm";

export const loadSol = () => ask<{ state: SolState }>("/api/design/sol");

const post = (body: Record<string, unknown>) => ask<{ state: SolState }>("/api/design/sol", { method: "POST", body });

/**
 * A question, with what their screen shows when asked from the side panel (page-context.ts). `shown` is the short line
 * the chat shows for it when `text` is a long instruction sent for the member. `room` keeps it to a screen's own
 * conversation (sol-rooms.ts).
 */
export const askSol = (text: string, files: SolFile[], page?: PageContext | null, deep = false, shown?: string, room?: SolRoom) =>
  post({
    do: "chat",
    text,
    files,
    ...(page ? { page } : {}),
    ...(deep ? { deep: true } : {}),
    ...(shown ? { shown } : {}),
    ...(room ? { room } : {}),
  });
/** Try another answer: his last answer replaced by a new one to the same question, a different way. */
export const retrySol = (page?: PageContext | null) => post({ do: "retry", ...(page ? { page } : {}) });
export const solSeen = () => post({ do: "seen" });
export const clearSolChat = () => post({ do: "clear" });
export const remindAt = (id: string, when: WhenChoice) => post({ do: "remind", id, when });
export const forgetReminder = (id: string) => post({ do: "forget-reminder", id });
export const forgetPref = (id: string) => post({ do: "forget-pref", id });
/** Sol's induction and what he learns in the moment (domain/design/sol-induction.ts). */
export const answerInduction = (key: string, answer: string) => post({ do: "induction", key, answer });
export const chooseInductionScope = (scope: "all" | "own") => post({ do: "scope", scope });
export const setInductionStatus = (status: "later" | "done" | "pending") => post({ do: "induction-status", status });
export const answerLearn = (at: string, choice: string) => post({ do: "learn", at, choice });
export const forgetBusinessPref = (id: string) => post({ do: "forget-business-pref", id });
/** Said on the window to open Sol's panel on his introduction (the end of the first visit's tour, Today's card). */
export const SOL_INDUCTION = "renuabl:sol-induction";
/** Sol's memory for the business (domain/design/sol-knowledge.ts). */
export const listSolKnowledge = () =>
  ask<{ knowledge: KnowledgeEntry[] }>("/api/design/sol", { method: "POST", body: { do: "knowledge" } });
export const forgetSolKnowledge = (id: string) =>
  ask<{ knowledge: KnowledgeEntry[] }>("/api/design/sol", { method: "POST", body: { do: "forget-knowledge", id } });
/** One of his answers kept by hand, with the pages under it. */
export const rememberAnswer = (at: string) => post({ do: "remember", at });
/** Past conversations (domain/design/sol-history.ts). */
export const listSolPast = () => ask<{ past: SolPastLine[] }>("/api/design/sol", { method: "POST", body: { do: "past" } });
export const openSolPast = (id: string) => ask<{ past: SolPast }>("/api/design/sol", { method: "POST", body: { do: "past-open", id } });
export const newSolChat = () => post({ do: "new" });
export const resumeSolChat = (id: string) => post({ do: "resume", id });
export const forgetSolChat = (id: string) =>
  ask<{ past: SolPastLine[] }>("/api/design/sol", { method: "POST", body: { do: "forget-past", id } });
export const pinTurn = (at: string, role: "you" | "sol", pinned: boolean) => post({ do: "pin", at, role, pinned });

/** Said on the window to open or shut Sol's panel from anywhere (the rail, a "#" link). */
export const SOL_TOGGLE = "renuabl:sol-toggle";
/**
 * On a phone, a deal page shows Sol's card for that deal as a sheet over the foot (21 Nov 2026, Martin). While one is
 * on screen it sets `data-deal-sol` on <html>, and the foot bar's Sol round toggles that sheet instead of his panel.
 */
export const DEAL_SOL_TOGGLE = "renuabl:deal-sol-toggle";
export function toggleSolHere(phone: boolean) {
  const deal = phone && typeof document !== "undefined" && document.documentElement.dataset.dealSol === "1";
  window.dispatchEvent(new Event(deal ? DEAL_SOL_TOGGLE : SOL_TOGGLE));
}
/**
 * Said on the window with a question: opens Sol's panel and asks him (the search, "Ask Sol"). `detail` is the words,
 * or `{ text, shown }` when the words are a long instruction and the chat should show a short line for it.
 */
export const SOL_ASK = "renuabl:sol-ask";
export type SolAsk = string | { text: string; shown?: string };
/**
 * Asks Sol in his panel from anywhere. Inside the designer's pop-up (a frame of our own site with no panel of its own)
 * the question goes to the page around it, where his panel is (19 Nov 2026, Martin: Ask Sol under the quote did nothing).
 */
export const askSolInPanel = (ask: SolAsk) => {
  let target: Window = window;
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin) target = window.parent;
  } catch {
    target = window;
  }
  target.dispatchEvent(new (target as Window & typeof globalThis).CustomEvent<SolAsk>(SOL_ASK, { detail: ask }));
};
/** Said back whenever the panel opens or shuts, so the rail can light its button. */
export const SOL_STATE = "renuabl:sol-state";
/** Said whenever Sol's conversation changes here, so the rail's count follows. */
export const SOL_CHANGED = "renuabl:sol-changed";

/** A draft Sol wrote, handed to the deal's Email tab to check and send (kept for this tab only). */
export const DRAFT_KEY = "renuabl.design.sol-draft";
