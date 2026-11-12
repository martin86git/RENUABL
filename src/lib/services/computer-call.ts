/**
 * Calling a customer from the computer (12 Nov 2026, Martin: ring from the browser, like VoIP): the browser's side of
 * Twilio's Voice SDK. One call at a time for the whole page, kept in a small store that the call bar
 * (`ComputerCallBar`) and the Call menus read. The number rung is the one on the customer's record: the browser only
 * ever holds a one-off ticket for the deal (`/api/design/jobs/[id]/dial`), which Twilio brings back to our server.
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Call, Device } from "@twilio/voice-sdk";

export type CallPhase = "starting" | "ringing" | "live" | "ended" | "failed";

export interface ComputerCall {
  phase: CallPhase;
  jobId: string;
  /** The customer's first name, for the bar. */
  name: string;
  /** When the call was connected (ms), for the timer. */
  liveAt: number | null;
  muted: boolean;
  /** Why it failed, in plain words. */
  message: string | null;
}

let current: ComputerCall | null = null;
const listeners = new Set<() => void>();
const set = (next: ComputerCall | null) => {
  current = next;
  listeners.forEach((l) => l());
};
const patch = (p: Partial<ComputerCall>) => current && set({ ...current, ...p });

/** The call on now (or just ended), for the bar and the menus. */
export function useComputerCall(): ComputerCall | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

// --- Whether calls from the computer are on, and Twilio's token ---------------------------------------------------

let token: { value: string; at: number } | null = null;
let onAsk: Promise<boolean> | null = null;
const TOKEN_FRESH_MS = 50 * 60 * 1000;

async function askToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/design/voice", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; on?: boolean; token?: string } | null;
    if (json?.ok && json.on && json.token) {
      token = { value: json.token, at: Date.now() };
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Whether this member may call from the computer: asked once a page. */
export function useComputerCallsOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    onAsk ??= askToken();
    void onAsk.then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

async function freshToken(): Promise<string | null> {
  if (token && Date.now() - token.at < TOKEN_FRESH_MS) return token.value;
  return (await askToken()) ? token!.value : null;
}

// --- The call -----------------------------------------------------------------------------------------------------

let device: Device | null = null;
let call: Call | null = null;
let clearTimer: number | undefined;

async function deviceReady(): Promise<Device | null> {
  const value = await freshToken();
  if (!value) return null;
  if (device) {
    device.updateToken(value);
    return device;
  }
  const { Device: TwilioDevice } = await import("@twilio/voice-sdk");
  device = new TwilioDevice(value, {
    codecPreferences: ["opus", "pcmu"] as never,
    closeProtection: "You're on a call. Leave the page and hang up?",
  });
  device.on("tokenWillExpire", () => {
    void askToken().then((ok) => ok && device?.updateToken(token!.value));
  });
  return device;
}

/** Twilio's error, in words someone on a call can act on. */
function errorWords(e: unknown): string {
  const err = e as { code?: number; message?: string; name?: string } | null;
  const code = err?.code ?? 0;
  if (code === 31401 || code === 31208 || err?.name === "NotAllowedError")
    return "Your browser didn't let RENUABL use the microphone. Allow it in the address bar, then try again.";
  if (code === 31402 || err?.name === "NotFoundError") return "No microphone was found on this computer.";
  if (code >= 20101 && code <= 20160) return "The call couldn't be set up. Reload the page and try again.";
  return "The call didn't go through. Try again in a moment.";
}

function finish(phase: "ended" | "failed", message: string | null = null) {
  call = null;
  patch({ phase, message });
  window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => set(null), phase === "failed" ? 9000 : 5000);
}

/** Rings this deal's customer from the computer. Says why when it can't. */
export async function callFromComputer(jobId: string, name: string): Promise<void> {
  if (current && current.phase !== "ended" && current.phase !== "failed") return;
  window.clearTimeout(clearTimer);
  set({ phase: "starting", jobId, name, liveAt: null, muted: false, message: null });
  try {
    const res = await fetch(`/api/design/jobs/${encodeURIComponent(jobId)}/dial`, { method: "POST", cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: string; message?: string } | null;
    if (!json?.ok || !json.ticket) return finish("failed", json?.message ?? "The call couldn't be started. Try again in a moment.");
    const d = await deviceReady();
    if (!d) return finish("failed", "Calling from the computer isn't set up for your business.");
    const c = await d.connect({ params: { ticket: json.ticket } });
    call = c;
    patch({ phase: "ringing" });
    c.on("accept", () => patch({ phase: "live", liveAt: Date.now() }));
    c.on("mute", (muted: boolean) => patch({ muted }));
    c.on("disconnect", () => finish("ended"));
    c.on("cancel", () => finish("ended"));
    c.on("reject", () => finish("ended"));
    c.on("error", (e: unknown) => finish("failed", errorWords(e)));
  } catch (e) {
    finish("failed", errorWords(e));
  }
}

export function toggleMute() {
  if (call) call.mute(!call.isMuted());
}

export function hangUp() {
  if (call) call.disconnect();
  else if (current && current.phase !== "ended" && current.phase !== "failed") finish("ended");
}

/** Closes the bar of a call that has ended. */
export function dismissCall() {
  window.clearTimeout(clearTimer);
  if (current && (current.phase === "ended" || current.phase === "failed")) set(null);
}
