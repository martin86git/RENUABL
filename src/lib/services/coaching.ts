/**
 * Talking to the business's phone assistant to coach it (domain/design/coaching.ts, `/api/design/caller/coach`). The
 * window (`CoachWindow`, mounted once in the shell) is opened from the assistant's face on the rail, Settings → Phone
 * assistant, or a call's transcript on a deal, which hands it that call.
 */
"use client";

import { useSyncExternalStore } from "react";
import type { AssistantDeal, AssistantDealCall } from "@/lib/domain/design/assistant-deals";
import type { CoachChatLine } from "@/lib/domain/design/coach-threads";
import type { CoachNote, CoachTurn } from "@/lib/domain/design/coaching";
import type { Delivery } from "@/lib/domain/design/delivery";
import type { CallSetup } from "@/lib/domain/design/call-setup";
import type { ScriptLine } from "@/lib/domain/design/call-scripts";
import type { TrainingView } from "@/lib/domain/design/training-call";
import type { CallerKey } from "@/lib/domain/install-call";
import { callerFor, useCallerInfo, type CallerState } from "./caller";

export interface CoachCall {
  jobId: string;
  transcriptId: string;
  /** "A call with Jo, 12 Nov", for the window. */
  about: string;
}

/** `role`: which of the business's two voice agents the window is talking to (left out: the sales one). */
let open: { call: CoachCall | null; role?: CallerKey } | null = null;
const listeners = new Set<() => void>();
const set = (next: typeof open) => {
  open = next;
  listeners.forEach((l) => l());
};

export const openCoach = (call: CoachCall | null = null, role: CallerKey = "sales") => set({ call, role });
export const closeCoach = () => set(null);
// Only when a call is set: a new state object lands the window on the assistant's day again.
export const clearCoachCall = () => open?.call && set({ call: null, role: open.role });

/** The assistant the window is open on (the sales one while it is shut). */
export const coachRole = (): CallerKey => open?.role ?? "sales";

/** The assistant the window is talking to, as a page shows it: its name, face and voice. */
export function useCoachCaller(): CallerState {
  const info = useCallerInfo();
  return callerFor(info, useCoachOpen()?.role);
}

export function useCoachOpen(): { call: CoachCall | null; role?: CallerKey } | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => null,
  );
}

type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };
const UNREACHABLE = "We couldn't reach the server just now. Try again in a moment.";

async function ask<T>(path: string, init?: RequestInit): Promise<Answer<T>> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; message?: string } & Record<string, unknown>) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return { ok: false, message: json?.message ?? UNREACHABLE };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

/** Each assistant keeps its own notes, chats and deals: the address says which one the window is on. */
const at = (path = "", more = "") => `/api/design/caller/${path || "coach"}?role=${coachRole()}${more}`;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const loadCoaching = () =>
  ask<{
    notes: CoachNote[];
    turns: CoachTurn[];
    past: CoachChatLine[];
    fixed: string[];
    mayCoach: boolean;
    delivery?: Delivery | null;
    setup?: CallSetup;
    business?: string;
    scripts?: ScriptLine[];
  }>(at());

type Chats = { turns: CoachTurn[]; past: CoachChatLine[] };
/** An earlier chat becomes the one going; the one that was going is filed away in its place. */
export const openCoachChat = (id: string) => ask<Chats>(at(), json("POST", { do: "open", id }));
/** The chat going is filed away with the earlier ones, leaving an empty one. */
export const newCoachChat = () => ask<Chats>(at(), json("POST", { do: "new" }));
export const forgetCoachChat = (id: string) => ask<Chats>(at(), json("POST", { do: "forget", id }));

/** With a deal picked beside the chat, the assistant is given that deal and its own calls on it. */
export const coachAssistant = (message: string, call: CoachCall | null, dealJobId: string | null = null, fresh = false) =>
  ask<{ notes: CoachNote[]; turns: CoachTurn[]; caller: CallerState; past: CoachChatLine[] }>(
    at(),
    json("POST", {
      message,
      ...(fresh ? { fresh: true } : {}),
      ...(call ? { call: { jobId: call.jobId, transcriptId: call.transcriptId } } : dealJobId ? { deal: { jobId: dealJobId } } : {}),
    }),
  );

export const rewordNote = (id: string, text: string) => ask<{ notes: CoachNote[] }>(at(), json("PUT", { id, text }));
/** A note locked in as a rule the agent follows on every call, or unlocked back to a note. */
export const lockNote = (id: string, locked: boolean) => ask<{ notes: CoachNote[] }>(at(), json("PUT", { id, locked }));
/** How the agent speaks; null goes back to how it was. */
export const saveDelivery = (delivery: Delivery | null) => ask<{ delivery: Delivery | null }>(at(), json("PUT", { delivery }));
/** The agent's scripts (call-scripts.ts): start one, use one, rename one (id null: the one in use) or remove one. */
export const changeScript = (
  script:
    | { do: "new"; name: string; copy: boolean; audience?: "enquired" | "cold" }
    | { do: "use" | "forget"; id: string }
    | { do: "rename"; id: string | null; name: string },
) => ask<{ notes: CoachNote[]; setup: CallSetup; scripts: ScriptLine[] }>(at(), json("PUT", { script }));
/** The agent's name as said, who it rings and why (call-setup.ts). */
export const saveCallSetup = (setup: CallSetup) => ask<{ setup: CallSetup }>(at(), json("PUT", { setup }));
export const removeNote = (id: string) => ask<{ notes: CoachNote[] }>(at("", `&id=${encodeURIComponent(id)}`), { method: "DELETE" });

/** The agent's latest training call: still on, being written up, or the changes it proposes (training-call.ts). */
export const loadTraining = () => ask<{ training: TrainingView | null; mayKeep: boolean }>(at("train"));
type Trained = { notes: CoachNote[]; training: TrainingView | null; gone: boolean; full?: boolean };
/** One proposed change locked in as a rule, kept as a note, or dropped. */
export const answerProposal = (id: string, proposal: string, what: "lock" | "keep" | "drop") =>
  ask<Trained>(at("train"), json("POST", { id, proposal, do: what }));
/** A write-up that failed is tried again. */
export const retryTraining = (id: string) => ask<Trained>(at("train"), json("POST", { id, do: "retry" }));

/** The deals the assistant is across: those it has rung, is on a call with or has a call lined up for. */
export const loadAssistantDeals = () => ask<{ deals: AssistantDeal[] }>(at("deals"));
/** Its calls on one deal, as they were said. */
export const loadDealCalls = (jobId: string) => ask<{ calls: AssistantDealCall[] }>(at("deals", `&job=${encodeURIComponent(jobId)}`));
