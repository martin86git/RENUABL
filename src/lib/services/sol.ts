/**
 * Sol, as the screens ask for him (`/api/design/sol`): the member's own conversation, and the events that open his
 * panel from anywhere and keep the rail's count in step.
 */
import type { SolFile, SolState, WhenChoice } from "@/lib/domain/design/sol";
import type { SolPast, SolPastLine } from "@/lib/domain/design/sol-history";
import type { KnowledgeEntry } from "@/lib/domain/design/sol-knowledge";
import type { PageContext } from "@/lib/domain/design/page-context";
import { ask } from "./crm";

export const loadSol = () => ask<{ state: SolState }>("/api/design/sol");

const post = (body: Record<string, unknown>) => ask<{ state: SolState }>("/api/design/sol", { method: "POST", body });

/**
 * A question, with what their screen shows when asked from the side panel (page-context.ts). `shown` is the short line
 * the chat shows for it when `text` is a long instruction sent for the member.
 */
export const askSol = (text: string, files: SolFile[], page?: PageContext | null, deep = false, shown?: string) =>
  post({ do: "chat", text, files, ...(page ? { page } : {}), ...(deep ? { deep: true } : {}), ...(shown ? { shown } : {}) });
/** Try another answer: his last answer replaced by a new one to the same question, a different way. */
export const retrySol = (page?: PageContext | null) => post({ do: "retry", ...(page ? { page } : {}) });
export const solSeen = () => post({ do: "seen" });
export const clearSolChat = () => post({ do: "clear" });
export const remindAt = (id: string, when: WhenChoice) => post({ do: "remind", id, when });
export const forgetReminder = (id: string) => post({ do: "forget-reminder", id });
export const forgetPref = (id: string) => post({ do: "forget-pref", id });
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
 * Said on the window with a question: opens Sol's panel and asks him (the search, "Ask Sol"). `detail` is the words,
 * or `{ text, shown }` when the words are a long instruction and the chat should show a short line for it.
 */
export const SOL_ASK = "renuabl:sol-ask";
export type SolAsk = string | { text: string; shown?: string };
/** Asks Sol in his panel from anywhere. */
export const askSolInPanel = (ask: SolAsk) => window.dispatchEvent(new CustomEvent<SolAsk>(SOL_ASK, { detail: ask }));
/** Said back whenever the panel opens or shuts, so the rail can light its button. */
export const SOL_STATE = "renuabl:sol-state";
/** Said whenever Sol's conversation changes here, so the rail's count follows. */
export const SOL_CHANGED = "renuabl:sol-changed";

/** A draft Sol wrote, handed to the deal's Email tab to check and send (kept for this tab only). */
export const DRAFT_KEY = "renuabl.design.sol-draft";
