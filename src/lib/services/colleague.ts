"use client";

/**
 * The team's own voice assistant, its chief of staff (domain/design/colleague.ts), from the browser: its window open or
 * shut, what it is and the member's own calls (`/api/design/colleague`), the member's PIN, and a call through the
 * browser's microphone with Vapi's web SDK (loaded only when a call starts). The browser holds only Vapi's public key
 * and the id of the assistant the server made for this one call.
 */
import { useSyncExternalStore } from "react";
import type { CallerVoice } from "@/lib/domain/design/caller";
import type { ColleagueLine } from "@/lib/domain/design/colleague";

export interface ColleagueCall {
  id: string;
  channel: "web" | "phone";
  at: string;
  minutes: number | null;
  summary: string | null;
  lines: ColleagueLine[];
}

export interface ColleagueState {
  name: string | null;
  voice: CallerVoice | null;
  ready: { on: boolean; web: boolean; teamNumber: string | null };
  pinSet: boolean;
  hasMobile: boolean;
  calls: ColleagueCall[];
  mayChange: boolean;
}

// ── The window, open or shut ───────────────────────────────────────────────────────────────────────────────────
let open = false;
const openListeners = new Set<() => void>();
const setOpen = (v: boolean) => {
  open = v;
  for (const l of openListeners) l();
};
export const openColleague = () => setOpen(true);
export const closeColleague = () => setOpen(false);
export const useColleagueOpen = () =>
  useSyncExternalStore(
    (l) => {
      openListeners.add(l);
      return () => openListeners.delete(l);
    },
    () => open,
    () => false,
  );

// ── The server ─────────────────────────────────────────────────────────────────────────────────────────────────
type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };
const UNREACHABLE = "We couldn't reach the server just now. Try again in a moment.";
async function ask<T>(url: string, init?: RequestInit): Promise<Answer<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string }) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return { ok: false, message: json?.message ?? UNREACHABLE };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const loadColleague = () => ask<ColleagueState>("/api/design/colleague");
export const saveColleague = (name: string, voice: CallerVoice | null) =>
  ask<{ name: string | null; voice: CallerVoice | null }>("/api/design/colleague", json("PUT", { name, voice }));
export const savePin = (pin: string) => ask<object>("/api/design/colleague/pin", json("PUT", { pin }));
export const removePin = () => ask<object>("/api/design/colleague/pin", { method: "DELETE" });

// ── A call in the browser ──────────────────────────────────────────────────────────────────────────────────────
export type CallPhase = "idle" | "connecting" | "on" | "ended" | "failed";

export interface LiveTalk {
  phase: CallPhase;
  startedAt: number | null;
  muted: boolean;
  /** Said in full, as the call goes. */
  lines: ColleagueLine[];
  /** A line still being said. */
  partial: ColleagueLine | null;
  problem: string | null;
}

let talk: LiveTalk = { phase: "idle", startedAt: null, muted: false, lines: [], partial: null, problem: null };
const talkListeners = new Set<() => void>();
const setTalk = (next: Partial<LiveTalk>) => {
  talk = { ...talk, ...next };
  for (const l of talkListeners) l();
};
export const useTalk = () =>
  useSyncExternalStore(
    (l) => {
      talkListeners.add(l);
      return () => talkListeners.delete(l);
    },
    () => talk,
    () => talk,
  );

interface VapiLike {
  start(assistant: string): Promise<unknown>;
  stop(): Promise<void> | void;
  setMuted(m: boolean): void;
  on(event: string, fn: (arg?: unknown) => void): void;
}
let vapi: VapiLike | null = null;

/** Starts a call with it through the microphone. */
export async function callColleague(): Promise<void> {
  if (talk.phase === "connecting" || talk.phase === "on") return;
  setTalk({ phase: "connecting", startedAt: null, muted: false, lines: [], partial: null, problem: null });
  const got = await ask<{ publicKey: string; assistantId: string }>("/api/design/colleague/call", { method: "POST" });
  if (!got.ok) return setTalk({ phase: "failed", problem: got.message });
  try {
    const { default: Vapi } = await import("@vapi-ai/web");
    const v = new Vapi(got.publicKey) as unknown as VapiLike;
    vapi = v;
    v.on("call-start", () => setTalk({ phase: "on", startedAt: Date.now() }));
    v.on("call-end", () => {
      setTalk({ phase: "ended", partial: null });
      vapi = null;
    });
    v.on("error", () => setTalk({ phase: talk.phase === "on" ? "ended" : "failed", problem: "The call dropped. Try again in a moment." }));
    v.on("message", (raw) => {
      const m = (raw ?? {}) as { type?: string; role?: string; transcriptType?: string; transcript?: string };
      if (m.type !== "transcript" || typeof m.transcript !== "string") return;
      const line: ColleagueLine = { role: m.role === "assistant" ? "assistant" : "you", text: m.transcript.trim() };
      if (!line.text) return;
      if (m.transcriptType === "final") setTalk({ lines: [...talk.lines, line].slice(-200), partial: null });
      else setTalk({ partial: line });
    });
    await v.start(got.assistantId);
  } catch {
    vapi = null;
    setTalk({ phase: "failed", problem: "The call couldn't start. Check the browser may use your microphone." });
  }
}

export function hangUpColleague(): void {
  void vapi?.stop();
  setTalk({ phase: "ended", partial: null });
}

export function muteColleague(): void {
  const next = !talk.muted;
  vapi?.setMuted(next);
  setTalk({ muted: next });
}

export const resetTalk = () => {
  if (talk.phase !== "connecting" && talk.phase !== "on")
    setTalk({ phase: "idle", lines: [], partial: null, problem: null, startedAt: null });
};
