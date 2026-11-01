/**
 * Sol, as the screens ask for him (`/api/design/sol`): the member's own conversation, and the events that open his
 * panel from anywhere and keep the rail's count in step.
 */
import type { SolFile, SolState, WhenChoice } from "@/lib/domain/design/sol";
import type { SolPast, SolPastLine } from "@/lib/domain/design/sol-history";
import type { KnowledgeEntry } from "@/lib/domain/design/sol-knowledge";
import { ask } from "./crm";

export const loadSol = () => ask<{ state: SolState }>("/api/design/sol");

const post = (body: Record<string, unknown>) => ask<{ state: SolState }>("/api/design/sol", { method: "POST", body });

export const askSol = (text: string, files: SolFile[]) => post({ do: "chat", text, files });
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
/** Said on the window with a question (`detail`, the words): opens Sol's panel and asks him (the search, "Ask Sol"). */
export const SOL_ASK = "renuabl:sol-ask";
/** Said back whenever the panel opens or shuts, so the rail can light its button. */
export const SOL_STATE = "renuabl:sol-state";
/** Said whenever Sol's conversation changes here, so the rail's count follows. */
export const SOL_CHANGED = "renuabl:sol-changed";

/** A draft Sol wrote, handed to the deal's Email tab to check and send (kept for this tab only). */
export const DRAFT_KEY = "renuabl.design.sol-draft";
