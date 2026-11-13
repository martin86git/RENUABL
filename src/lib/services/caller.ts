/**
 * The business's phone assistant, as the screens ask for it: its name, its picture and whether calls are on
 * (`/api/design/caller`). `useCaller` reads it once a page and hears changes from Settings.
 */
"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CALLER, type CallerVoice } from "@/lib/domain/design/caller";

export interface CallerState {
  name: string;
  photoAt: string | null;
  voice: CallerVoice | null;
  /** Whether the business has set it up in Settings (else it is Sol by default). */
  named: boolean;
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

/** Heard by every `useCaller` on the page when Settings changes the assistant. */
const CHANGED = "renuabl:caller";

export const loadCaller = () => ask<{ caller: CallerState; callsOn: boolean; textsOn?: boolean; mayChange: boolean; business: string }>("/api/design/caller");

export async function saveCallerName(name: string) {
  const res = await ask<{ caller: CallerState }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** The voice it speaks in; null goes back to the default. */
export async function saveCallerVoice(voice: CallerVoice | null) {
  const res = await ask<{ caller: CallerState }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voice }),
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** Tells every place showing the assistant that it changed (a name or voice changed in its chat). */
export const callerChanged = (caller: CallerState) => window.dispatchEvent(new CustomEvent(CHANGED, { detail: caller }));

/** Rings the member's own mobile so they hear the voice. */
export const ringMeToHear = () => ask<object>("/api/design/caller/test", { method: "POST" });

export async function uploadCallerPhoto(file: File) {
  const form = new FormData();
  form.set("file", file);
  const res = await ask<{ caller: CallerState }>("/api/design/caller/photo", { method: "POST", body: form });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

export async function removeCallerPhoto() {
  const res = await ask<{ caller: CallerState }>("/api/design/caller/photo", { method: "DELETE" });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** Where the picture is: its time in the address, since the browser keeps a picture for good. */
export const callerPhotoUrl = (c: CallerState) => (c.photoAt ? `/api/design/caller/photo?v=${encodeURIComponent(c.photoAt)}` : null);

/** The assistant as a page needs it: who it is, whether its calls are on, and whether this member may set it up. */
export interface CallerInfo {
  caller: CallerState;
  callsOn: boolean;
  /** Whether a text can be sent to a customer from here. */
  textsOn: boolean;
  mayChange: boolean;
  /** False until the server has answered. */
  ready: boolean;
}

const START: CallerInfo = {
  caller: { name: DEFAULT_CALLER, photoAt: null, voice: null, named: false },
  callsOn: false,
  textsOn: false,
  mayChange: false,
  ready: false,
};

let shared: Promise<CallerInfo | null> | null = null;

/** The assistant for this page (read once, shared by every place that shows it; Sol while it loads), kept up to date with Settings. */
export function useCallerInfo(): CallerInfo {
  const [info, setInfo] = useState<CallerInfo>(START);
  useEffect(() => {
    let live = true;
    shared ??= loadCaller().then((r) => (r.ok ? { caller: r.caller, callsOn: r.callsOn, textsOn: r.textsOn === true, mayChange: r.mayChange, ready: true } : null));
    void shared.then((i) => {
      if (live && i) setInfo(i);
    });
    const heard = (e: Event) => {
      const caller = (e as CustomEvent<CallerState>).detail;
      setInfo((i) => {
        const next = { ...i, caller };
        shared = Promise.resolve(next);
        return next;
      });
    };
    window.addEventListener(CHANGED, heard);
    return () => {
      live = false;
      window.removeEventListener(CHANGED, heard);
    };
  }, []);
  return info;
}

/** The assistant for this page, or Sol while it loads. */
export const useCaller = (): CallerState => useCallerInfo().caller;

/** The phone assistant rings this deal's customer (in calling hours). Answers what to tell the member. */
export const askAssistantToCall = (jobId: string) =>
  ask<{ message: string; already?: boolean }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call`, { method: "POST" });

/** A text to this deal's customer, on the mobile on their record. Answers what to tell the member. */
export const textCustomer = (jobId: string, text: string) =>
  ask<{ message: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/text`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
