/**
 * A business's own pipelines and stages (21 Nov 2026, Martin: "allow the
 * ability to add stages to the pipelines, add a pipeline, rename the
 * pipelines"). Pure.
 *
 * The twelve stages in `crm.ts` stay what every rule reads (won, installed,
 * approvals, the overview). A stage a business adds is its own, with a name,
 * and sits inside one of those twelve: its `base`. A deal at an added stage
 * is at its base stage for every rule, and at the added stage on the board.
 * So "Site visit booked" counting as Designed keeps the overview, Sol and the
 * approvals right whatever the business calls its columns.
 *
 * A pipeline is a run of stage keys in the business's order: one of the
 * twelve, or an added stage's id. The set pipelines (`PIPELINES` in deal.ts)
 * can be renamed and given other stages too: that is kept as a saved row that
 * stands in for the set one (`baseId`), and removing it puts the set one back.
 */
import { JOB_STAGES, STAGE_LABELS, type JobStage } from "./crm";
import { PIPELINES, type Pipeline } from "./deal";

/** A stage a business added: its name, and the stage it counts as. */
export interface OwnStage {
  id: string;
  name: string;
  base: JobStage;
}

/**
 * The business's own names for the twelve stages (21 Nov 2026, Martin: "allow renaming the built-in stages too").
 * Only the words change: every rule still reads the stage itself. A stage not here reads as ours (`STAGE_LABELS`).
 */
export type StageNames = Partial<Record<JobStage, string>>;

/** One of the twelve stages, or the id of one the business added. */
export type StageKey = string;

/** A pipeline the business keeps: one of its own, or one standing in for a set pipeline (`baseId`). */
export interface KeptPipeline {
  id: string;
  name: string;
  stages: StageKey[];
  baseId: string | null;
}

/** A pipeline as shown: `rowId` is its row on the server when the business has one (null for a set one as it came). */
export interface ShownPipeline {
  id: string;
  name: string;
  stages: StageKey[];
  rowId: string | null;
  /** One of the set pipelines (renamed or changed, or as it came). */
  set: boolean;
  /** A set pipeline the business has changed: it can be put back. */
  changed: boolean;
}

export const MAX_OWN_STAGES = 40;
export const MAX_PIPELINE_STAGES = 20;
export const STAGE_NAME_MAX = 40;
export const OWN_STAGES_FULL = `A business can add up to ${MAX_OWN_STAGES} stages for now.`;
export const STAGE_NAME_MISSING = `Give the stage a name (up to ${STAGE_NAME_MAX} characters).`;
export const STAGE_NAME_TAKEN = "There's already a stage of that name.";
export const STAGE_BASE_WRONG = "Choose which stage it counts as.";
export const PIPELINE_TOO_LONG = `A pipeline shows up to ${MAX_PIPELINE_STAGES} stages.`;

const OWN_ID = /^st_[a-f0-9]{8,64}$/;
export const isOwnStageId = (key: unknown): key is string => typeof key === "string" && OWN_ID.test(key);
export const isJobStage = (key: unknown): key is JobStage => typeof key === "string" && (JOB_STAGES as readonly string[]).includes(key);
const SET_IDS = new Set(PIPELINES.map((p) => p.id));
export const isSetPipelineId = (id: unknown): id is string => typeof id === "string" && SET_IDS.has(id);

/** One plain line, as a name: spaces closed up, nothing that isn't printable. */
export function cleanStageName(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, STAGE_NAME_MAX)
    : "";
}

/** One of the twelve by the business's name for it, else ours. */
export function labelOf(stage: JobStage, names: StageNames = {}): string {
  return names[stage] || STAGE_LABELS[stage];
}

/** Names read back from the server or the browser: only the twelve, each a clean name, none the same as ours. */
export function cleanStageNames(raw: unknown): StageNames {
  const out: StageNames = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const name = cleanStageName(v);
    if (isJobStage(k) && name && name !== STAGE_LABELS[k]) out[k] = name;
  }
  return out;
}

/** The name a stage key is shown by: an added stage's own name, else the twelve's (the business's or ours). Unknown keys read as nothing. */
export function stageName(key: StageKey, own: readonly OwnStage[], names: StageNames = {}): string {
  if (isJobStage(key)) return labelOf(key, names);
  return own.find((s) => s.id === key)?.name ?? "";
}

/** A name already used by one of the twelve (as the business names it) or another added stage (any case). `except` is the stage being renamed. */
export function nameTaken(name: string, own: readonly OwnStage[], except: StageKey | null = null, names: StageNames = {}): boolean {
  const n = name.toLowerCase();
  return (
    JOB_STAGES.some((s) => s !== except && labelOf(s, names).toLowerCase() === n) ||
    own.some((s) => s.id !== except && s.name.toLowerCase() === n)
  );
}

type Cleaned<T> = { ok: true; value: T } | { ok: false; message: string };

/** A new stage as sent: a name not already used, and one of the twelve it counts as. */
export function cleanOwnStageInput(
  raw: unknown,
  own: readonly OwnStage[],
  names: StageNames = {},
): Cleaned<Pick<OwnStage, "name" | "base">> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { name?: unknown; base?: unknown };
  const name = cleanStageName(r.name);
  if (!name) return { ok: false, message: STAGE_NAME_MISSING };
  if (nameTaken(name, own, null, names)) return { ok: false, message: STAGE_NAME_TAKEN };
  if (!isJobStage(r.base)) return { ok: false, message: STAGE_BASE_WRONG };
  return { ok: true, value: { name, base: r.base } };
}

/**
 * A pipeline's stages as sent, in the order sent: the twelve and the
 * business's own stages only, each once. Order matters now, since an added
 * stage sits wherever the business puts it.
 */
export function cleanStageKeys(raw: unknown, own: readonly OwnStage[]): StageKey[] {
  const ids = new Set(own.map((s) => s.id));
  const out: StageKey[] = [];
  for (const k of Array.isArray(raw) ? raw : []) {
    if ((isJobStage(k) || (isOwnStageId(k) && ids.has(k))) && !out.includes(k)) out.push(k);
  }
  return out;
}

/**
 * The stage a new stage counts as, from where it is put: the stage before it
 * (or that stage's own base), else the first of the twelve after it, else Lead.
 */
export function baseAt(stages: readonly StageKey[], after: number, own: readonly OwnStage[]): JobStage {
  const of = (k: StageKey | undefined): JobStage | null =>
    k === undefined ? null : isJobStage(k) ? k : (own.find((s) => s.id === k)?.base ?? null);
  for (let i = after; i >= 0; i--) {
    const b = of(stages[i]);
    if (b) return b;
  }
  for (let i = after + 1; i < stages.length; i++) {
    const b = of(stages[i]);
    if (b) return b;
  }
  return "lead";
}

/** Puts `key` into a run of stages just after position `after` (-1: first). */
export function insertStage(stages: readonly StageKey[], key: StageKey, after: number): StageKey[] {
  const rest = stages.filter((k) => k !== key);
  const at = Math.max(0, Math.min(rest.length, after + 1));
  return [...rest.slice(0, at), key, ...rest.slice(at)];
}

/**
 * Every pipeline the business sees, in order: the set ones (a saved stand-in
 * in place of one the business changed), then its own. Stages it no longer
 * has are left out; a pipeline left with none shows the stages it came with
 * (set) or is left out (its own).
 */
export function pipelinesFor(kept: readonly KeptPipeline[], own: readonly OwnStage[]): ShownPipeline[] {
  const tidy = (s: readonly StageKey[]) => cleanStageKeys(s, own);
  const set = PIPELINES.map((p: Pipeline): ShownPipeline => {
    const row = kept.find((k) => k.baseId === p.id);
    const stages = row ? tidy(row.stages) : [...p.stages];
    return {
      id: p.id,
      name: row?.name || p.name,
      stages: stages.length ? stages : [...p.stages],
      rowId: row?.id ?? null,
      set: true,
      changed: !!row,
    };
  });
  const mine = kept
    .filter((k) => !k.baseId || !isSetPipelineId(k.baseId))
    .map((k): ShownPipeline => ({ id: k.id, name: k.name, stages: tidy(k.stages), rowId: k.id, set: false, changed: false }))
    .filter((p) => p.stages.length > 0);
  return [...set, ...mine];
}

/** Where a deal sits on the board: its added stage when it has one that counts as its stage, else its stage. */
export function keyOfDeal(job: { stage: JobStage; subStage?: string | null }, own: readonly OwnStage[]): StageKey {
  const sub = job.subStage ? own.find((s) => s.id === job.subStage) : undefined;
  return sub && sub.base === job.stage ? sub.id : job.stage;
}

/**
 * The column a deal shows in on a pipeline: its own place when the pipeline
 * has it; a deal at an added stage this pipeline doesn't show goes in its
 * base stage's column; else none (not on this pipeline).
 */
export function columnOf(
  job: { stage: JobStage; subStage?: string | null },
  stages: readonly StageKey[],
  own: readonly OwnStage[],
): StageKey | null {
  const key = keyOfDeal(job, own);
  if (stages.includes(key)) return key;
  return stages.includes(job.stage) ? job.stage : null;
}

/** What a deal is saved as when moved to a stage key: the stage every rule reads, and the added stage on top (or none). */
export function moveTo(key: StageKey, own: readonly OwnStage[]): { stage: JobStage; subStage: string | null } | null {
  if (isJobStage(key)) return { stage: key, subStage: null };
  const s = own.find((o) => o.id === key);
  return s ? { stage: s.base, subStage: s.id } : null;
}

/** Every stage a deal can be put at, for a picker: each of the twelve, then the stages added under it. */
export function stageChoices(own: readonly OwnStage[], names: StageNames = {}): { key: StageKey; name: string; added: boolean }[] {
  return JOB_STAGES.flatMap((s) => [
    { key: s, name: labelOf(s, names), added: false },
    ...own.filter((o) => o.base === s).map((o) => ({ key: o.id, name: o.name, added: true })),
  ]);
}

/** What a move is written on the deal as: "Moved to Site visit booked". */
export function moveText(stage: JobStage, subStage: string | null, own: readonly OwnStage[], names: StageNames = {}): string {
  const sub = subStage ? own.find((s) => s.id === subStage) : undefined;
  return `Moved to ${sub?.name ?? labelOf(stage, names)}`;
}

export const PIPELINE_NAME_MISSING = "Give the pipeline a name (up to 40 characters).";
export const PIPELINE_STAGES_MISSING = "A pipeline shows at least one stage.";

/**
 * A pipeline as sent: a name, its stages in the order sent (the twelve and the
 * business's own), and for a stand-in, which set pipeline it stands in for.
 */
export function cleanPipelineSave(raw: unknown, own: readonly OwnStage[]): Cleaned<Pick<KeptPipeline, "name" | "stages" | "baseId">> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { name?: unknown; stages?: unknown; baseId?: unknown };
  const name = cleanStageName(r.name);
  if (!name) return { ok: false, message: PIPELINE_NAME_MISSING };
  const stages = cleanStageKeys(r.stages, own);
  if (!stages.length) return { ok: false, message: PIPELINE_STAGES_MISSING };
  if (stages.length > MAX_PIPELINE_STAGES) return { ok: false, message: PIPELINE_TOO_LONG };
  return { ok: true, value: { name, stages, baseId: isSetPipelineId(r.baseId) ? r.baseId : null } };
}

/**
 * The business's pipelines as runs of the twelve stages, for places that read deals by stage only (Today's feed):
 * an added stage stands as the stage it counts as, each once, in the pipeline's order. Names as the business set them.
 */
export function pipelinesByStage(kept: readonly KeptPipeline[], own: readonly OwnStage[]): Pipeline[] {
  return pipelinesFor(kept, own).map((p) => {
    const stages: JobStage[] = [];
    for (const k of p.stages) {
      const b = isJobStage(k) ? k : own.find((s) => s.id === k)?.base;
      if (b && !stages.includes(b)) stages.push(b);
    }
    return { id: p.id, name: p.name, stages };
  });
}

/** A pipeline's stages with the one at `from` moved to position `to` (both kept within the run). */
export function moveStage(stages: readonly StageKey[], from: number, to: number): StageKey[] {
  const out = [...stages];
  if (from < 0 || from >= out.length) return out;
  const [key] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, key);
  return out;
}

/**
 * A built-in stage renamed: the name cleaned and not another stage's, or blank to put ours back.
 * Answers the names as they now stand, or why not.
 */
export function renameBuiltin(stage: unknown, raw: unknown, own: readonly OwnStage[], names: StageNames): Cleaned<StageNames> {
  if (!isJobStage(stage)) return { ok: false, message: STAGE_BASE_WRONG };
  const name = cleanStageName(raw);
  const next: StageNames = { ...names };
  if (!name || name === STAGE_LABELS[stage]) {
    delete next[stage];
    return { ok: true, value: next };
  }
  if (nameTaken(name, own, stage, names)) return { ok: false, message: STAGE_NAME_TAKEN };
  next[stage] = name;
  return { ok: true, value: next };
}
