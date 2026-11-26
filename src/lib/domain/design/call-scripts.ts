/**
 * A voice agent's scripts (18 Nov 2026, Martin: "we need to be able to create new scripts and select which one to
 * use"). An agent had one script: its notes, the rules locked in, who it rings and why. Now it keeps several by name,
 * and one is in use: the one every call is given, the one its chat changes and the one shown in its settings.
 *
 * Choosing another swaps them whole: the one in use is filed away as it stands and the chosen one takes its place.
 * A script carries its notes (locked rules among them), who it rings and the reason for the call, so "Enquiries" and
 * "Cold calls" can be two scripts. The agent's name, how it is said, its voice and how it speaks stay the agent's.
 * No rule changes with a script: what every call keeps is fixed (coaching.ts FIXED_RULES). Pure, tested.
 */
import { cleanNotes, type CoachNote } from "./coaching";
import {
  CALL_AUDIENCES,
  DEFAULT_CALL_SETUP,
  cleanReason,
  withObjective,
  type CallAudience,
  type CallObjective,
  type CallSetup,
} from "./call-setup";

/** A script not in use, kept as it stood. */
export interface SavedScript {
  id: string;
  name: string;
  notes: CoachNote[];
  audience: CallAudience;
  reason: string;
  /** What its calls work towards (call-setup.ts); unset for scripts filed before 26 Nov 2026. */
  objective?: CallObjective;
  /** When it was last in use, or made. */
  at: string;
}

/** The script in use, as the agent's own columns hold it. */
export interface LiveScript {
  name: string;
  notes: CoachNote[];
  setup: CallSetup;
}

/** A script as the picker lists it: `id` null is the one in use. */
export interface ScriptLine {
  id: string | null;
  name: string;
  lines: number;
  locked: number;
  audience: CallAudience;
}

/** Scripts an agent may keep, the one in use among them. */
export const MAX_SCRIPTS = 12;
export const SCRIPT_NAME_MAX = 40;
/** What the one script every agent starts with is called until it is named. */
export const DEFAULT_SCRIPT_NAME = "Main script";

export const isScriptId = (raw: unknown): raw is string => typeof raw === "string" && /^sc_[0-9a-f]{8,32}$/.test(raw);

/** A script's name: one plain line, or null when nothing is left of it. */
export function cleanScriptName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw
    .replace(/[^\p{L}\p{M}\p{N} ,.'&()/+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SCRIPT_NAME_MAX)
    .trim();
  return t || null;
}

/** The name of the script in use as kept, else the usual one. */
export const liveName = (raw: unknown): string => cleanScriptName(raw) ?? DEFAULT_SCRIPT_NAME;

/** The scripts filed away, as read from the database: only whole ones, no id twice. */
export function cleanScripts(raw: unknown): SavedScript[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedScript[] = [];
  for (const r of raw) {
    const v = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const name = cleanScriptName(v.name);
    if (!isScriptId(v.id) || !name || out.some((s) => s.id === v.id)) continue;
    out.push({
      id: v.id,
      name,
      notes: cleanNotes(v.notes),
      audience: CALL_AUDIENCES.find((a) => a === v.audience) ?? DEFAULT_CALL_SETUP.audience,
      reason: cleanReason(v.reason),
      ...withObjective(v.objective),
      at: typeof v.at === "string" ? v.at : "",
    });
    if (out.length >= MAX_SCRIPTS - 1) break;
  }
  return out;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether a script of that name is already there (any case); `except` is the one being renamed (null: the one in use). */
export function nameTaken(live: LiveScript, saved: readonly SavedScript[], name: string, except?: string | null): boolean {
  if (except !== null && same(live.name, name)) return true;
  return saved.some((s) => s.id !== except && same(s.name, name));
}

const fileAway = (live: LiveScript, id: string, at: string): SavedScript => ({
  id,
  name: live.name,
  notes: live.notes,
  audience: live.setup.audience,
  reason: live.setup.reason,
  ...withObjective(live.setup.objective),
  at,
});

export type ScriptChange = { ok: true; live: LiveScript; saved: SavedScript[] } | { ok: false; message: string };

export const SCRIPT_PROBLEMS = {
  name: "Give the script a name.",
  taken: "There's already a script with that name.",
  full: `An agent keeps up to ${MAX_SCRIPTS} scripts. Remove one first.`,
  gone: "That script isn't here any more.",
} as const;

/**
 * A new script, put in use at once: blank, or a copy of the one in use. The one in use is filed away as it stands.
 * How the agent's name is said stays.
 */
export function startScript(
  live: LiveScript,
  saved: readonly SavedScript[],
  o: { name: unknown; copy: boolean; audience?: unknown; fileId: string; at: string },
): ScriptChange {
  const name = cleanScriptName(o.name);
  if (!name) return { ok: false, message: SCRIPT_PROBLEMS.name };
  if (nameTaken(live, saved, name)) return { ok: false, message: SCRIPT_PROBLEMS.taken };
  if (saved.length + 1 >= MAX_SCRIPTS) return { ok: false, message: SCRIPT_PROBLEMS.full };
  return {
    ok: true,
    live: {
      name,
      notes: o.copy ? live.notes : [],
      // A blank one rings who it was made for (18 Nov 2026, Martin: a script named Cold calls opened as an enquiry call).
      setup: o.copy
        ? live.setup
        : { ...DEFAULT_CALL_SETUP, saidAs: live.setup.saidAs, audience: CALL_AUDIENCES.find((a) => a === o.audience) ?? "enquired" },
    },
    saved: [fileAway(live, o.fileId, o.at), ...saved],
  };
}

/** A filed script put in use; the one in use takes its place among the filed, newest first. */
export function chooseScript(
  live: LiveScript,
  saved: readonly SavedScript[],
  id: unknown,
  o: { fileId: string; at: string },
): ScriptChange {
  const chosen = saved.find((s) => s.id === id);
  if (!chosen) return { ok: false, message: SCRIPT_PROBLEMS.gone };
  return {
    ok: true,
    live: {
      name: chosen.name,
      notes: chosen.notes,
      setup: { saidAs: live.setup.saidAs, audience: chosen.audience, reason: chosen.reason, ...withObjective(chosen.objective) },
    },
    saved: [fileAway(live, o.fileId, o.at), ...saved.filter((s) => s.id !== chosen.id)],
  };
}

/** A script renamed: `id` null is the one in use. */
export function renameScript(live: LiveScript, saved: readonly SavedScript[], id: unknown, rawName: unknown): ScriptChange {
  const name = cleanScriptName(rawName);
  if (!name) return { ok: false, message: SCRIPT_PROBLEMS.name };
  const which = id === null || id === undefined ? null : isScriptId(id) ? id : "";
  if (which !== null && !saved.some((s) => s.id === which)) return { ok: false, message: SCRIPT_PROBLEMS.gone };
  if (nameTaken(live, saved, name, which)) return { ok: false, message: SCRIPT_PROBLEMS.taken };
  if (which === null) return { ok: true, live: { ...live, name }, saved: [...saved] };
  return { ok: true, live, saved: saved.map((s) => (s.id === which ? { ...s, name } : s)) };
}

/** A filed script removed for good. The one in use can't be: choose another first. */
export function forgetScript(live: LiveScript, saved: readonly SavedScript[], id: unknown): ScriptChange {
  if (!saved.some((s) => s.id === id)) return { ok: false, message: SCRIPT_PROBLEMS.gone };
  return { ok: true, live, saved: saved.filter((s) => s.id !== id) };
}

/** Whether a script's name says it is for cold calls, so the form can start on that choice. */
export const namedForColdCalls = (name: string) => /\bcold\b/i.test(name);

/** The scripts as the picker lists them: the one in use first. */
export function scriptLines(live: LiveScript, saved: readonly SavedScript[]): ScriptLine[] {
  const line = (id: string | null, name: string, notes: readonly CoachNote[], audience: CallAudience): ScriptLine => ({
    id,
    name,
    lines: notes.length,
    locked: notes.filter((n) => n.locked).length,
    audience,
  });
  return [line(null, live.name, live.notes, live.setup.audience), ...saved.map((s) => line(s.id, s.name, s.notes, s.audience))];
}

/** A script's line in a few words: "6 lines · 2 locked · cold calls". */
export function scriptWords(s: ScriptLine, sales = true): string {
  const parts = [s.lines === 0 ? "Empty" : `${s.lines} line${s.lines === 1 ? "" : "s"}`];
  if (s.locked > 0) parts.push(`${s.locked} locked`);
  if (sales && s.audience === "cold") parts.push("cold calls");
  return parts.join(" · ");
}

export const SCRIPTS_COPY = {
  inUse: "In use",
  use: "Use",
  add: "New script",
  blank: "Start blank",
  copy: "Copy this one",
  note: (name: string) =>
    `${name} uses one script at a time, from the next call. Choosing another keeps this one as it is. Every script keeps the rules no call can change.`,
  namePlaceholder: "e.g. Cold calls, Battery offer",
} as const;
