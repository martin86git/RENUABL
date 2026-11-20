/**
 * The business's routines (domain/design/routines.ts) as the Routines page asks for them, and the changes it makes:
 * Sol's agents' settings through their own route, a voice agent's script and who it rings through its coach route.
 */
import type { CallSetup } from "@/lib/domain/design/call-setup";
import type { Routine } from "@/lib/domain/design/routines";
import type { AgentSettings } from "@/lib/domain/design/sol-agents";
import { ask } from "./crm";

export interface RoutinesView {
  routines: Routine[];
  settings: AgentSettings;
  voice: { key: string; setup: CallSetup; scripts: { id: string | null; name: string }[] }[];
  may: { settings: boolean; onOff: boolean; voice: boolean };
  readOnly: boolean;
}

/** Told when a routine changes, so the round on the bar can count again. */
export const ROUTINES_CHANGED = "renuabl:routines";

export const loadRoutines = () => ask<RoutinesView>("/api/design/routines");

const told = <T>(p: Promise<T>) =>
  p.then((r) => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(ROUTINES_CHANGED));
    return r;
  });

export const saveRoutineSettings = (settings: AgentSettings) =>
  told(ask<{ settings: AgentSettings }>("/api/design/sol-agents", { method: "PUT", body: { settings } }));

const coach = (key: string) => `/api/design/caller/coach?role=${encodeURIComponent(key)}`;

/** Who a voice agent rings (the rest of its setup kept as it is). */
export const saveVoiceSetup = (key: string, setup: CallSetup) =>
  told(ask<{ setup: CallSetup }>(coach(key), { method: "PUT", body: { setup } }));

/** The script a voice agent calls with, from those it keeps. */
export const chooseVoiceScript = (key: string, id: string) =>
  told(ask<object>(coach(key), { method: "PUT", body: { script: { do: "use", id } } }));
