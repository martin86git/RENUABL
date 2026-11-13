/**
 * Talking to the business's phone assistant to coach it (domain/design/coaching.ts, `/api/design/caller/coach`). The
 * window (`CoachWindow`, mounted once in the shell) is opened from the assistant's face on the rail, Settings → Phone
 * assistant, or a call's transcript on a deal, which hands it that call.
 */
"use client";

import { useSyncExternalStore } from "react";
import type { CoachNote, CoachTurn } from "@/lib/domain/design/coaching";
import type { CallerState } from "./caller";

export interface CoachCall {
  jobId: string;
  transcriptId: string;
  /** "A call with Jo, 12 Nov", for the window. */
  about: string;
}

let open: { call: CoachCall | null } | null = null;
const listeners = new Set<() => void>();
const set = (next: typeof open) => {
  open = next;
  listeners.forEach((l) => l());
};

export const openCoach = (call: CoachCall | null = null) => set({ call });
export const closeCoach = () => set(null);
export const clearCoachCall = () => open && set({ call: null });

export function useCoachOpen(): { call: CoachCall | null } | null {
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

const URL_ = "/api/design/caller/coach";
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const loadCoaching = () => ask<{ notes: CoachNote[]; turns: CoachTurn[]; fixed: string[]; mayCoach: boolean }>(URL_);

export const coachAssistant = (message: string, call: CoachCall | null) =>
  ask<{ notes: CoachNote[]; turns: CoachTurn[]; caller: CallerState }>(
    URL_,
    json("POST", { message, ...(call ? { call: { jobId: call.jobId, transcriptId: call.transcriptId } } : {}) }),
  );

export const rewordNote = (id: string, text: string) => ask<{ notes: CoachNote[] }>(URL_, json("PUT", { id, text }));
export const removeNote = (id: string) => ask<{ notes: CoachNote[] }>(`${URL_}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
