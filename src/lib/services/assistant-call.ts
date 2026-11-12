/**
 * The phone assistant's call as it happens, for the window that opens when a call is handed to it (`AssistantCallWindow`,
 * mounted once in the shell). One call watched at a time for the page; the window asks the server every moment or two
 * (`/api/design/jobs/[id]/call/live`) and less often once the call is over.
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LiveCallView } from "@/lib/domain/live-call";

export interface Watched {
  jobId: string;
  /** The customer's first name, until the server says. */
  name: string;
  /** What the server said when the call was handed over ("Charlie will call now."). */
  message: string;
}

/** Kept for the tab, so a reload or a new page mid-call opens the window again (for up to `KEEP_MS`). */
const KEY = "renuabl.design.watched-call";
const KEEP_MS = 2 * 60 * 60 * 1000;

function remembered(): Watched | null {
  if (typeof window === "undefined") return null;
  try {
    const kept = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as (Watched & { at: number }) | null;
    if (!kept || typeof kept.jobId !== "string" || Date.now() - kept.at > KEEP_MS) return null;
    return { jobId: kept.jobId, name: String(kept.name ?? ""), message: String(kept.message ?? "") };
  } catch {
    return null;
  }
}

let watched: Watched | null = remembered();
const listeners = new Set<() => void>();
const set = (next: Watched | null) => {
  watched = next;
  try {
    if (next) window.sessionStorage.setItem(KEY, JSON.stringify({ ...next, at: Date.now() }));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Not kept: the window still shows on this page.
  }
  listeners.forEach((l) => l());
};

export const watchAssistantCall = (w: Watched) => set(w);
export const stopWatching = () => set(null);

export function useWatchedCall(): Watched | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => watched,
    () => null,
  );
}

export type LiveCall = LiveCallView & {
  /** When the answer arrived, on this computer's clock, to run the timer from. */
  receivedAt: number;
};

const FAST_MS = 1_500;
const SLOW_MS = 10_000;

/** The watched call as it stands, asked again while the window is open. */
export function useLiveCall(jobId: string | null): { call: LiveCall | null; loaded: boolean } {
  const [state, setState] = useState<{ jobId: string | null; call: LiveCall | null; loaded: boolean }>({
    jobId,
    call: null,
    loaded: false,
  });
  if (state.jobId !== jobId) setState({ jobId, call: null, loaded: false });

  useEffect(() => {
    if (!jobId) return;
    let live = true;
    let timer: number | undefined;
    const ask = async () => {
      let next: LiveCall | null = null;
      try {
        const res = await fetch(`/api/design/jobs/${encodeURIComponent(jobId)}/call/live`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; call?: LiveCallView | null } | null;
        if (json?.ok && json.call) next = { ...json.call, receivedAt: Date.now() };
      } catch {
        // Asked again in a moment.
      }
      if (!live) return;
      setState((s) => ({ jobId, call: next ?? s.call, loaded: true }));
      const over = next?.phase === "ended";
      timer = window.setTimeout(() => void ask(), over || document.hidden ? SLOW_MS : FAST_MS);
    };
    void ask();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [jobId]);

  return { call: state.call, loaded: state.loaded };
}
