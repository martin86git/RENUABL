/**
 * The business's phone assistant, as the screens ask for it: its name, its picture and whether calls are on
 * (`/api/design/caller`). `useCaller` reads it once a page and hears changes from Settings.
 */
"use client";

import type { StrayText, TextLine } from "@/lib/domain/design/texts";
import { useEffect, useState } from "react";
import { DEFAULT_CALLER, type CallerBrain, type CallerVoice } from "@/lib/domain/design/caller";
import type { CallerKey } from "@/lib/domain/install-call";
import type { AskDraft } from "@/lib/domain/design/call-consent";
import { PRACTICE_ID } from "@/lib/domain/design/practice-call";
import { watchAssistantCall } from "./assistant-call";

export interface CallerState {
  /** Which of the business's voice agents it is, by its key: the first sales agent when left out. */
  role?: CallerKey;
  name: string;
  photoAt: string | null;
  voice: CallerVoice | null;
  /** Whether the business has set it up in Settings (else it is Sol by default). */
  named: boolean;
  /** The colour chosen for its stand-in picture, or null to leave it to its name. */
  tint?: number | null;
  /** The model it thinks with on calls, or null for RENUABL's default. */
  brain?: CallerBrain | null;
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

export const loadCaller = () =>
  ask<{
    caller: CallerState;
    admin?: CallerState;
    more?: CallerState[];
    callsOn: boolean;
    textsOn?: boolean;
    mayChange: boolean;
    business: string;
  }>("/api/design/caller");

export async function saveCallerName(name: string, role: CallerKey = "sales") {
  const res = await ask<{ caller: CallerState }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, role }),
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** The colour of its stand-in picture (0 to 5); null leaves it to its name. */
export async function saveCallerTint(tint: number | null, role: CallerKey = "sales") {
  const res = await ask<{ caller: CallerState }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tint, role }),
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** The voice it speaks in; null goes back to the default. */
export async function saveCallerVoice(voice: CallerVoice | null, role: CallerKey = "sales") {
  const res = await ask<{ caller: CallerState }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voice, role }),
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** The model it thinks with on calls: quicker or more careful; null goes back to RENUABL's default. */
export async function saveCallerBrain(brain: CallerBrain | null, role: CallerKey = "sales") {
  const res = await ask<{ caller: CallerState }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brain, role }),
  });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** Tells every place showing the assistant that it changed (a name or voice changed in its chat). */
/** The voices the business has taken off its list, and taking one off or bringing it back (who may change settings). */
export const loadHiddenVoices = async (): Promise<string[]> => {
  const r = await loadCaller();
  if (!r.ok) return [];
  speakersNow = (r as { speakers?: string[] }).speakers ?? speakersNow;
  return (r as { hiddenVoices?: string[] }).hiddenVoices ?? [];
};

/** The makers whose voices speak the solar sample line on this site, as last told by the server (read with the hidden voices). */
let speakersNow: string[] = [];
export const voiceSpeakers = (): readonly string[] => speakersNow;
export const changeHiddenVoices = (voices: { hide: string } | { show: string } | { all: true }) =>
  ask<{ hiddenVoices: string[] }>("/api/design/caller", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voices }),
  });

export const callerChanged = (caller: CallerState) => window.dispatchEvent(new CustomEvent(CHANGED, { detail: caller }));

/** Rings the member's own mobile so they hear the voice. */
/**
 * A practice call (domain/design/practice-call.ts): the assistant rings the member's own mobile and talks to them as a
 * customer; the live call window opens on it, with its clock, transcript and Hang up.
 */
export async function ringMeToHear(role: CallerKey = "sales") {
  const res = await ask<{ message: string }>(`/api/design/caller/test?role=${role}`, { method: "POST" });
  if (res.ok) watchAssistantCall({ jobId: PRACTICE_ID, name: "you", message: res.message, role });
  return res;
}

/** Heard by the agent's chat window when a training call is placed, so it starts watching for what comes of it. */
export const TRAINING_PLACED = "renuabl:training";

/**
 * A training call (domain/design/training-call.ts): the agent rings the member's own mobile and talks to them as its
 * trainer, not a customer. What they ask for is written up afterwards in its chat, to keep or drop.
 */
export async function ringMeToTrain(role: CallerKey = "sales") {
  const res = await ask<{ message: string }>(`/api/design/caller/test?role=${role}&kind=training`, { method: "POST" });
  if (res.ok) {
    watchAssistantCall({ jobId: PRACTICE_ID, name: "you", message: res.message, role });
    window.dispatchEvent(new CustomEvent(TRAINING_PLACED));
  }
  return res;
}

export async function uploadCallerPhoto(file: File, role: CallerKey = "sales") {
  const form = new FormData();
  form.set("file", file);
  const res = await ask<{ caller: CallerState }>(`/api/design/caller/photo?role=${role}`, { method: "POST", body: form });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

export async function removeCallerPhoto(role: CallerKey = "sales") {
  const res = await ask<{ caller: CallerState }>(`/api/design/caller/photo?role=${role}`, { method: "DELETE" });
  if (res.ok) window.dispatchEvent(new CustomEvent(CHANGED, { detail: res.caller }));
  return res;
}

/** Where the picture is: its time in the address, since the browser keeps a picture for good. */
export const callerPhotoUrl = (c: CallerState) =>
  c.photoAt ? `/api/design/caller/photo?role=${c.role ?? "sales"}&v=${encodeURIComponent(c.photoAt)}` : null;

/** The assistant as a page needs it: who it is, whether its calls are on, and whether this member may set it up. */
export interface CallerInfo {
  caller: CallerState;
  /** The admin assistant, which rings sold customers to book their installation. */
  admin: CallerState;
  /** The sales agents past the first, in order. */
  more: CallerState[];
  callsOn: boolean;
  /** Whether a text can be sent to a customer from here. */
  textsOn: boolean;
  mayChange: boolean;
  /** False until the server has answered. */
  ready: boolean;
}

const START: CallerInfo = {
  caller: { name: DEFAULT_CALLER, photoAt: null, voice: null, named: false },
  admin: { role: "admin", name: DEFAULT_CALLER, photoAt: null, voice: null, named: false },
  more: [],
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
    shared ??= loadCaller().then((r) =>
      r.ok
        ? {
            caller: r.caller,
            admin: r.admin ?? START.admin,
            more: r.more ?? [],
            callsOn: r.callsOn,
            textsOn: r.textsOn === true,
            mayChange: r.mayChange,
            ready: true,
          }
        : null,
    );
    void shared.then((i) => {
      if (live && i) setInfo(i);
    });
    const heard = (e: Event) => {
      const caller = (e as CustomEvent<CallerState>).detail;
      setInfo((i) => {
        const key = caller.role ?? "sales";
        const next =
          key === "admin"
            ? { ...i, admin: caller }
            : key === "sales"
              ? { ...i, caller }
              : {
                  ...i,
                  more: [...i.more.filter((m) => m.role !== key), caller].sort((a, b) => (a.role ?? "").localeCompare(b.role ?? "")),
                };
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

/** One of the business's voice agents by its key (the first sales agent when it isn't known). */
export const callerFor = (info: CallerInfo, key: CallerKey | undefined | null): CallerState =>
  key === "admin" ? info.admin : (info.more.find((m) => m.role === key) ?? info.caller);

/** The business's sales agents that have been made, the first first. */
export const salesAgents = (info: CallerInfo): CallerState[] => [info.caller, ...info.more].filter((c) => c.named);

/** The assistant for this page, or Sol while it loads. */
export const useCaller = (): CallerState => useCallerInfo().caller;

/** Emails the deal's customer to ask whether they'd like the assistant's call; it rings after a yes (call-consent.ts). */
export const askByEmailFirst = (jobId: string, own?: { subject: string; opening: string }) =>
  ask<{ message: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(own ?? {}),
  });

/** The ask as a draft to read and change before it goes: who it goes to, and the lines that always go. Sends nothing. */
export const loadAskDraft = (jobId: string) =>
  ask<{ to: string; business: string; assistant: string; draft: AskDraft }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call/ask`);

/** The phone assistant rings this deal's customer (in calling hours). Answers what to tell the member. */
export const askAssistantToCall = (jobId: string, agent: CallerKey = "sales", about = "") =>
  ask<{ message: string; already?: boolean }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent, ...(about.trim() ? { about: about.trim() } : {}) }),
  });

/** The phone assistant rings this deal's customer back to ask or confirm one thing the team typed. */
export const askAssistantToCallBack = (jobId: string, what: string) =>
  ask<{ message: string; already?: boolean }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ask: what }),
  });

/** The admin assistant rings this deal's customer to book their installation. Answers what to tell the member. */
export const askAssistantToBook = (jobId: string) =>
  ask<{ message: string; already?: boolean }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ book: true }),
  });

/** The texts with this deal's customer, both ways, whether they replied STOP, and the sign-off a text ends with. */
export const loadDealTexts = (jobId: string) =>
  ask<{ lines: TextLine[]; stopped: boolean; signOff: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/text`);

/** The latest texts from numbers on no customer's record. */
export const loadStrayTexts = () => ask<{ texts: StrayText[] }>("/api/design/caller/texts");

/** A text to this deal's customer, on the mobile on their record. Answers what to tell the member. */
export const textCustomer = (jobId: string, text: string) =>
  ask<{ message: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/text`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
