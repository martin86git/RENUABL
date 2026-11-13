"use client";

/**
 * The business's agents, as the screens ask for them (`/api/design/agents`): which it has made and what each needs,
 * asking RENUABL for a phone number, and the window that lists them and adds one, open or shut.
 */
import { useSyncExternalStore } from "react";
import type { AgentKind, AgentStatus } from "@/lib/domain/design/agents";
import type { CallerVoice } from "@/lib/domain/design/caller";
import { callerChanged, type CallerState } from "./caller";

export interface AgentLine {
  kind: AgentKind;
  name: string | null;
  made: boolean;
}

export interface AgentsState {
  status: AgentStatus;
  agents: AgentLine[];
  mayChange: boolean;
  staff: boolean;
}

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

export const loadAgents = () => ask<AgentsState>("/api/design/agents");
export const askForNumber = (kind: AgentKind) => ask<{ message: string }>("/api/design/agents", json("POST", { kind }));

/** Heard by the rail's rounds when an agent is added, so the new one shows without a reload. */
export const AGENTS_CHANGED = "renuabl:agents";

/**
 * Makes the agent: a phone assistant by its role (its name, then its voice when one was picked), the chief of staff by
 * its own settings. The server checks the name and voice as Settings does.
 */
export async function addAgent(kind: AgentKind, name: string, voice: CallerVoice | null): Promise<Answer<object>> {
  if (kind === "colleague") {
    const made = await ask<object>("/api/design/colleague", json("PUT", { name, voice }));
    if (made.ok) window.dispatchEvent(new Event(AGENTS_CHANGED));
    return made;
  }
  const named = await ask<{ caller: CallerState }>("/api/design/caller", json("PUT", { name, role: kind }));
  if (!named.ok) return named;
  let caller = named.caller;
  if (voice) {
    const voiced = await ask<{ caller: CallerState }>("/api/design/caller", json("PUT", { voice, role: kind }));
    // The agent is made either way: a voice that didn't take can be picked again in its settings.
    if (voiced.ok) caller = voiced.caller;
  }
  callerChanged(caller);
  window.dispatchEvent(new Event(AGENTS_CHANGED));
  return { ok: true };
}

// ── The window, open or shut ───────────────────────────────────────────────────────────────────────────────────
let open = false;
const listeners = new Set<() => void>();
const setOpen = (v: boolean) => {
  open = v;
  for (const l of listeners) l();
};
export const openAgents = () => setOpen(true);
export const closeAgents = () => setOpen(false);
export const useAgentsOpen = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
