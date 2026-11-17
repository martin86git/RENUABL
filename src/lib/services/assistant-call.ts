/**
 * The phone assistant's call as it happens, for the window that opens when a call is handed to it (`AssistantCallWindow`,
 * mounted once in the shell). One call watched at a time for the page; the window asks the server every moment or two
 * (`/api/design/jobs/[id]/call/live`) and less often once the call is over.
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cleanCallerKey, type CallerKey } from "@/lib/domain/install-call";
import type { LiveCallNow, LiveCallView } from "@/lib/domain/live-call";
import { PRACTICE_ID } from "@/lib/domain/design/practice-call";

/** Where a watched call is asked about: a deal's call, or the member's own practice call. */
const liveUrl = (jobId: string) =>
  jobId === PRACTICE_ID ? "/api/design/caller/test/live" : `/api/design/jobs/${encodeURIComponent(jobId)}/call/live`;

export interface Watched {
  jobId: string;
  /** The customer's first name, until the server says. */
  name: string;
  /** Which assistant it was handed to, until the server says: admin for a call to book an installation. */
  role?: CallerKey;
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
    return {
      jobId: kept.jobId,
      name: String(kept.name ?? ""),
      message: String(kept.message ?? ""),
      role: kept.role ? cleanCallerKey(kept.role) : undefined,
    };
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

/** Tells the assistant something while it's on the call (say: it says the words as typed). */
export async function tellAssistant(jobId: string, text: string, say: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(liveUrl(jobId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, say }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && json?.ok) return { ok: true };
    return { ok: false, message: json?.message ?? "That didn't reach the call. Try again in a moment." };
  } catch {
    return { ok: false, message: "We couldn't reach the server just now. Try again in a moment." };
  }
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
        const res = await fetch(liveUrl(jobId), { cache: "no-store" });
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

/** Rings the call waiting on this deal now, whatever the calling hours. */
export async function callNowInstead(jobId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(liveUrl(jobId), { method: "PUT" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && json?.ok) return { ok: true };
    return { ok: false, message: json?.message ?? "The call couldn't be placed just now. Try again in a moment." };
  } catch {
    return { ok: false, message: "We couldn't reach the server just now. Try again in a moment." };
  }
}

/** Hangs up on the assistant's call on this deal. */
export async function endAssistantCall(jobId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(liveUrl(jobId), { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && json?.ok) return { ok: true };
    return { ok: false, message: json?.message ?? "The call couldn't be ended from here. Try again in a moment." };
  } catch {
    return { ok: false, message: "We couldn't reach the server just now. Try again in a moment." };
  }
}

// --- Every call under way (13 Nov 2026, Martin: several customers called at once should be plain to see, and one, or
// all of them, a press away). One poller for the page, shared by whatever shows it; it runs only while something does.

export type LiveNowCall = LiveCallNow & {
  /** When the answer arrived, on this computer's clock, to run each call's timer from. */
  receivedAt: number;
};

const NONE: readonly LiveNowCall[] = [];
let nowCalls: readonly LiveNowCall[] = NONE;
const nowListeners = new Set<() => void>();
let nowTimer: number | undefined;
let nowRun = 0;

/** While calls are live; while none are; while the tab is hidden; and when calls aren't on for the business. */
const NOW_LIVE_MS = 4_000;
const NOW_IDLE_MS = 12_000;
const NOW_HIDDEN_MS = 45_000;
const NOW_OFF_MS = 10 * 60_000;

const sameCalls = (a: readonly LiveNowCall[], b: readonly LiveNowCall[]) =>
  a.length === b.length &&
  a.every((c, i) => {
    const d = b[i];
    return (
      c.jobId === d.jobId &&
      c.phase === d.phase &&
      c.last?.text === d.last?.text &&
      // The same moment the call was answered, give or take the trip to the server.
      Math.abs(c.receivedAt - (c.startedAgo ?? 0) - (d.receivedAt - (d.startedAgo ?? 0))) < 3_000
    );
  });

async function askNow(run: number) {
  let on = true;
  let next: readonly LiveNowCall[] | null = null;
  try {
    const res = await fetch("/api/design/calls/live", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; on?: boolean; calls?: LiveCallNow[] } | null;
    if (res.status === 401 || res.status === 403 || res.status === 404) on = false;
    else if (json?.ok) {
      on = json.on !== false;
      const at = Date.now();
      next = (json.calls ?? []).map((c) => ({ ...c, receivedAt: at }));
    }
  } catch {
    // Asked again in a moment.
  }
  if (run !== nowRun) return;
  if (!on) next = NONE;
  if (next && !sameCalls(nowCalls, next)) {
    nowCalls = next.length ? next : NONE;
    nowListeners.forEach((l) => l());
  }
  const wait = !on ? NOW_OFF_MS : document.hidden ? NOW_HIDDEN_MS : nowCalls.length ? NOW_LIVE_MS : NOW_IDLE_MS;
  nowTimer = window.setTimeout(() => void askNow(run), wait);
}

/** Asks now, e.g. as a call is handed over, so the tray doesn't wait out its idle gap. */
export function refreshLiveCalls() {
  if (nowListeners.size === 0) return;
  window.clearTimeout(nowTimer);
  void askNow(++nowRun);
}

function subscribeNow(l: () => void) {
  nowListeners.add(l);
  if (nowListeners.size === 1) void askNow(++nowRun);
  return () => {
    nowListeners.delete(l);
    if (nowListeners.size === 0) {
      nowRun++;
      window.clearTimeout(nowTimer);
    }
  };
}
const noSubscription = () => () => {};

/** The calls ringing or on right now, on the deals this person may see. Asks only while `on`. */
export function useLiveCallsNow(on = true): readonly LiveNowCall[] {
  return useSyncExternalStore(
    on ? subscribeNow : noSubscription,
    () => (on ? nowCalls : NONE),
    () => NONE,
  );
}

// The wall of every live call side by side: open or not, for the page.
let wallOpen = false;
const wallListeners = new Set<() => void>();
export const setCallWall = (open: boolean) => {
  wallOpen = open;
  wallListeners.forEach((l) => l());
};
export function useCallWall(): boolean {
  return useSyncExternalStore(
    (l) => {
      wallListeners.add(l);
      return () => wallListeners.delete(l);
    },
    () => wallOpen,
    () => false,
  );
}
