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

export const loadCaller = () => ask<{ caller: CallerState; callsOn: boolean; business: string }>("/api/design/caller");

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

let shared: Promise<CallerState | null> | null = null;

/** The assistant for this page (read once, shared by every place that shows it), or Sol while it loads. */
export function useCaller(): CallerState {
  const [caller, setCaller] = useState<CallerState>({ name: DEFAULT_CALLER, photoAt: null, voice: null });
  useEffect(() => {
    let live = true;
    shared ??= loadCaller().then((r) => (r.ok ? r.caller : null));
    void shared.then((c) => {
      if (live && c) setCaller(c);
    });
    const heard = (e: Event) => {
      const c = (e as CustomEvent<CallerState>).detail;
      shared = Promise.resolve(c);
      setCaller(c);
    };
    window.addEventListener(CHANGED, heard);
    return () => {
      live = false;
      window.removeEventListener(CHANGED, heard);
    };
  }, []);
  return caller;
}
