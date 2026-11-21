"use client";

import { SAMPLE_DEAL_HINT } from "@/lib/domain/design/deal-tour";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List, PenTool, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { JOB_STAGES, STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import { DEFAULT_PIPELINE, cleanPipelineChoice, type PipelineChoice } from "@/lib/domain/design/deal";
import {
  STAGE_NAME_MAX,
  baseAt,
  columnOf,
  isJobStage,
  keyOfDeal,
  moveStage,
  moveTo,
  pipelinesFor,
  stageChoices,
  stageName,
  type KeptPipeline,
  type OwnStage,
  type ShownPipeline,
  type StageKey,
} from "@/lib/domain/design/pipeline-stages";
import {
  addStage,
  createPipeline,
  deletePipeline,
  deleteStage,
  loadOwnStages,
  renameStage,
  dollars,
  listJobs,
  listPipelines,
  saveJob,
  savePipeline,
  shortDate,
  type JobLine,
} from "@/lib/services/crm";
import { NewDeal } from "./design-customers";
import { useDesignAccount } from "./design-account";
import { PATHS, PageHead, ui } from "./design-shell";
import { PulseMarks } from "./deal-pulse";
import { loadPulses } from "@/lib/services/deal-pulse";
import type { DealPulse } from "@/lib/domain/design/deal-heat";

/** Where this person's last way of looking at their deals is kept, on their device. */
const CHOICE = "renuabl.design.pipeline";

/** The pipeline menu's last option: starts a new pipeline. */
const NEW_PIPELINE = "__new";

const stageSelect =
  "block h-8 w-full appearance-auto rounded-md border border-line bg-surface px-2 text-xs text-ink-2 outline-none focus:border-forest";

/**
 * /design/sales/pipelines: the business's deals (its jobs), seen through a
 * pipeline: a run of stages. The set pipelines and the business's own are
 * picked from one menu (kept on the server, shared by everyone in it). Any
 * pipeline can be renamed; a new one starts as a copy of the one on show; a
 * stage of the business's own can be added to any pipeline, counting as one
 * of the twelve for every rule (pipeline-stages.ts). The deals at a pipeline's
 * stages show as cards in a column for each stage, or as one list. A deal
 * moves by choosing its stage (or, as a card, by being dragged to another
 * column); the move is saved at once and written to the customer's history.
 * Which pipeline and view this person last used are remembered on their device.
 */
export function PipelinesPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  // Whose deals: everyone's (that this member sees), their own, or no one's yet.
  const [whose, setWhose] = useState<"all" | "mine" | "none">("all");
  const [account] = useDesignAccount();
  const me = account?.signedIn ? account.email.toLowerCase() : "";
  const [problem, setProblem] = useState<string | null>(null);
  const [choice, setChoice] = useState<PipelineChoice>(DEFAULT_PIPELINE);
  // The pipelines the business keeps and the stages it added; the name being typed for a new or renamed pipeline.
  const [kept, setKept] = useState<KeptPipeline[]>([]);
  const [own, setOwn] = useState<OwnStage[]>([]);
  const [naming, setNaming] = useState<{ mode: "new" | "rename"; name: string } | null>(null);
  // The deal being dragged, and the column it is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<StageKey | null>(null);
  // A column being dragged by its head to another place in the pipeline, and the column it is over.
  const [movingCol, setMovingCol] = useState<StageKey | null>(null);
  const [colOver, setColOver] = useState<StageKey | null>(null);
  // The new order shown at once while it saves (put back if the server says no).
  const [order, setOrder] = useState<{ pipeline: string; stages: StageKey[] } | null>(null);
  const [adding, setAdding] = useState(false);
  // Each open deal's clock and temperature: its marks on the card, and the order to ring in its column.
  const [pulses, setPulses] = useState<Record<string, DealPulse>>({});

  useEffect(() => {
    let gone = false;
    try {
      // What was chosen last time is only known once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChoice(cleanPipelineChoice(JSON.parse(window.localStorage.getItem(CHOICE) ?? "null")));
    } catch {
      // Nothing kept, or the browser won't say: the Sales pipeline, as cards.
    }
    void listJobs().then((res) => {
      if (gone) return;
      if (res.ok) setJobs(res.jobs);
      else setProblem(res.message);
    });
    void loadPulses().then((res) => !gone && res.ok && setPulses(res.pulses));
    void listPipelines().then((res) => {
      if (gone || !res.ok) return;
      setKept(res.pipelines);
      setOwn(res.stages);
    });
    return () => {
      gone = true;
    };
  }, []);

  const choose = (next: PipelineChoice) => {
    setChoice(next);
    try {
      window.localStorage.setItem(CHOICE, JSON.stringify(next));
    } catch {
      // It still shows as chosen for this visit.
    }
  };

  // Every pipeline the business sees (the set ones as it renamed or changed them, then its own), and the one on show.
  const all = pipelinesFor(kept, own);
  const named = all.find((p) => p.id === choice.pipeline) ?? all[0];
  const stages = order && order.pipeline === named.id ? order.stages : named.stages;

  const pick = (p: ShownPipeline) => {
    const fixed = p.stages.filter(isJobStage);
    choose({ ...choice, stages: fixed.length ? fixed : [...DEFAULT_PIPELINE.stages], pipeline: p.id });
    setNaming(null);
  };
  /** The pipeline kept as it now stands on the server, put in place of its old row (or added). */
  const keepRow = (row: KeptPipeline) => setKept((now) => [...now.filter((k) => k.id !== row.id), row]);

  /** Saves a pipeline's name and stages: its own row, or for a set one a stand-in for it. */
  const savePipelineAs = async (p: ShownPipeline, change: { name?: string; stages?: StageKey[] }) => {
    const body = { name: change.name ?? p.name, stages: change.stages ?? p.stages };
    const res = p.rowId && !p.set ? await savePipeline(p.rowId, body) : await createPipeline({ ...body, baseId: p.set ? p.id : null });
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    keepRow(res.pipeline);
    return true;
  };

  /** Saves the name being typed: a new pipeline (a copy of the stages on show), or the one on show renamed. */
  const keep = async () => {
    if (!naming?.name.trim()) return;
    if (naming.mode === "rename") {
      if (await savePipelineAs(named, { name: naming.name })) setNaming(null);
      return;
    }
    const res = await createPipeline({ name: naming.name, stages: [...stages] });
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    keepRow(res.pipeline);
    setNaming(null);
    choose({ ...choice, pipeline: res.pipeline.id });
  };
  const remove = async (p: ShownPipeline) => {
    if (!p.rowId) return;
    const question = p.set
      ? `Put "${p.name}" back as it came, for everyone in the business? Stages you added stay in the others.`
      : `Delete the pipeline "${p.name}" for everyone in the business? Its deals are untouched.`;
    if (!window.confirm(question)) return;
    const res = await deletePipeline(p.rowId);
    if (!res.ok) return setProblem(res.message);
    setKept(kept.filter((k) => k.id !== p.rowId));
  };

  /** Adds a stage of the business's own to the pipeline on show, after position `after`. */
  const addOwnStage = async (input: { name: string; base: JobStage; after: number }) => {
    const res = await addStage({ ...input, pipelineId: named.id });
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    setOwn((now) => [...now, res.stage]);
    if (res.pipeline) keepRow(res.pipeline);
    void loadOwnStages(true);
    return true;
  };
  const renameOwn = async (stage: OwnStage, name: string) => {
    const res = await renameStage(stage.id, name);
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    setOwn((now) => now.map((s) => (s.id === stage.id ? res.stage : s)));
    void loadOwnStages(true);
    return true;
  };
  /**
   * Takes a stage off the pipeline on show. A stage the business added that no other pipeline shows goes altogether
   * (asked first): its deals go back to the stage it counted as.
   */
  const takeOff = async (key: StageKey) => {
    const added = own.find((s) => s.id === key);
    const elsewhere = all.some((p) => p.id !== named.id && p.stages.includes(key));
    if (added && !elsewhere) {
      const base = STAGE_LABELS[added.base];
      if (!window.confirm(`Remove the stage "${added.name}" for everyone? Its deals go back to ${base}.`)) return;
      const res = await deleteStage(added.id);
      if (!res.ok) return setProblem(res.message);
      setOwn((now) => now.filter((s) => s.id !== added.id));
      setKept((now) => now.map((k) => ({ ...k, stages: k.stages.filter((x) => x !== added.id) })));
      setJobs((now) => (now ?? []).map((j) => (j.subStage === added.id ? { ...j, subStage: null } : j)));
      void loadOwnStages(true);
      return;
    }
    await savePipelineAs(named, { stages: stages.filter((k) => k !== key) });
  };

  /** Moves a column to another place in the pipeline on show: shown at once, saved for everyone in the business. */
  const reorder = async (key: StageKey, to: number) => {
    const from = stages.indexOf(key);
    if (from < 0 || from === to) return;
    const next = moveStage(stages, from, to);
    setOrder({ pipeline: named.id, stages: next });
    await savePipelineAs(named, { stages: next });
    setOrder(null);
  };

  const move = async (id: string, key: StageKey) => {
    const job = jobs?.find((j) => j.id === id);
    const to = moveTo(key, own);
    if (!jobs || !job || !to || keyOfDeal(job, own) === key) return;
    // Shown at once, and put back if the server says no.
    setJobs(jobs.map((j) => (j.id === id ? { ...j, ...to } : j)));
    const res = await saveJob(id, to);
    if (!res.ok) {
      setProblem(res.message);
      setJobs((now) => (now ?? []).map((j) => (j.id === id ? { ...j, stage: job.stage, subStage: job.subStage ?? null } : j)));
    } else setProblem(null);
  };

  const shown = (jobs ?? []).filter(
    (j) => columnOf(j, stages, own) !== null && (whose === "all" || (whose === "mine" ? j.owner === me : !j.owner)),
  );
  const worth = shown.reduce((n, j) => n + (j.value ?? 0), 0);
  const deal = (id: string) => `${PATHS.deals}/${id}`;
  // The sample deal a new business starts with opens on the tour of a deal (deal-tour.ts).
  const dealOf = (job: JobLine) => (job.sample ? `${deal(job.id)}?tour=1` : deal(job.id));
  const choices = stageChoices(own);
  const stagePicker = (job: JobLine, className: string) => (
    <select className={className} value={keyOfDeal(job, own)} onChange={(e) => void move(job.id, e.target.value)}>
      {choices.map((c) => (
        <option key={c.key} value={c.key}>
          {c.added ? `\u00a0\u00a0↳ ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="px-5 py-8 lg:px-10">
      <PageHead eyebrow="CRM · Deals" title={named.name}>
        <button className={ui.primary} onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="size-4" aria-hidden /> New deal
        </button>
      </PageHead>
      {adding && <NewDeal onClose={() => setAdding(false)} />}

      <div className={clsx(ui.card, "mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3")}>
        <label className="inline-flex items-center gap-2">
          <span className="sr-only">Whose deals</span>
          <select
            className={clsx(ui.input, "h-9 min-h-9 w-40 appearance-auto")}
            value={whose}
            onChange={(e) => setWhose(e.target.value as typeof whose)}
          >
            <option value="all">Everyone&apos;s deals</option>
            <option value="mine">My deals</option>
            <option value="none">No owner yet</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Pipeline">
          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Pipeline</span>
            <select
              className={clsx(ui.input, "h-9 min-h-9 w-64 appearance-auto font-medium")}
              value={named.id}
              onChange={(e) => {
                if (e.target.value === NEW_PIPELINE) return setNaming({ mode: "new", name: "" });
                const p = all.find((x) => x.id === e.target.value);
                if (p) pick(p);
              }}
            >
              {all
                .filter((p) => p.set)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              {all.some((p) => !p.set) && (
                <optgroup label="Your own">
                  {all
                    .filter((p) => !p.set)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              )}
              <option value={NEW_PIPELINE}>+ New pipeline…</option>
            </select>
          </label>
          {naming ? (
            <span className="ml-1 inline-flex flex-wrap items-center gap-1.5">
              <input
                autoFocus
                aria-label={naming.mode === "new" ? "New pipeline's name" : "Pipeline name"}
                className={clsx(ui.input, "h-9 min-h-9 w-48")}
                value={naming.name}
                maxLength={40}
                placeholder={naming.mode === "new" ? "New pipeline's name" : "Pipeline name"}
                onChange={(e) => setNaming({ ...naming, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void keep();
                  if (e.key === "Escape") setNaming(null);
                }}
              />
              <button className={clsx(ui.primary, "h-9 px-3 text-[13px]")} onClick={keep} disabled={!naming.name.trim()}>
                {naming.mode === "new" ? "Create" : "Save"}
              </button>
              <button className={clsx(ui.quiet, "h-9 px-3 text-[13px]")} onClick={() => setNaming(null)}>
                Cancel
              </button>
              {naming.mode === "new" && (
                <span className="text-xs text-muted">Starts with the stages of {named.name}; add or take off stages after.</span>
              )}
            </span>
          ) : (
            <span className="ml-1 inline-flex items-center gap-3 text-[13px] font-medium">
              <button
                className={clsx(ui.link, "inline-flex items-center gap-1")}
                onClick={() => setNaming({ mode: "rename", name: named.name })}
              >
                <Pencil className="size-3.5" aria-hidden /> Rename
              </button>
              {named.rowId && (
                <button className="inline-flex items-center gap-1 text-muted hover:text-danger" onClick={() => void remove(named)}>
                  {named.set ? (
                    <>
                      <RotateCcw className="size-3.5" aria-hidden /> Put back as it came
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-3.5" aria-hidden /> Delete
                    </>
                  )}
                </button>
              )}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs tabular-nums text-muted">
            {jobs ? `${shown.length} ${shown.length === 1 ? "deal" : "deals"}${worth ? ` · ${dollars(worth)}` : ""}` : ""}
          </p>
          <div className="flex items-center gap-1 rounded-md bg-surface-2 p-0.5" role="group" aria-label="View">
            {(
              [
                ["cards", "Cards", LayoutGrid],
                ["list", "List", List],
              ] as const
            ).map(([view, name, Icon]) => (
              <button
                key={view}
                aria-pressed={choice.view === view}
                onClick={() => choose({ ...choice, view })}
                className={clsx(
                  "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium",
                  choice.view === view ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden /> {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {choice.view === "cards" ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage, at) => {
            // Deals still being sold in the order to ring (as Primero's): the warmest and nearest their end first.
            const column = shown
              .filter((j) => columnOf(j, stages, own) === stage)
              .sort((a, b) => (pulses[b.id]?.priority ?? -Infinity) - (pulses[a.id]?.priority ?? -Infinity));
            const sum = column.reduce((n, j) => n + (j.value ?? 0), 0);
            return (
              <section
                key={stage}
                aria-label={stageName(stage, own)}
                onDragOver={(e) => {
                  if (movingCol) {
                    e.preventDefault();
                    setColOver(stage);
                    return;
                  }
                  if (!dragging) return;
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => {
                  setOver((now) => (now === stage ? null : now));
                  setColOver((now) => (now === stage ? null : now));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (movingCol) void reorder(movingCol, at);
                  else if (dragging) void move(dragging, stage);
                  setDragging(null);
                  setOver(null);
                  setMovingCol(null);
                  setColOver(null);
                }}
                className={clsx(
                  "relative flex min-w-72 flex-1 basis-72 snap-start flex-col rounded-lg border bg-surface-2 p-2",
                  over === stage ? "border-sun-line" : "border-transparent",
                  movingCol === stage && "opacity-50",
                )}
              >
                {movingCol && colOver === stage && movingCol !== stage && (
                  // Where the column will land: after this one when moving right, before it when moving left.
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute inset-y-1 w-1 rounded-full bg-sun-line",
                      stages.indexOf(movingCol) < at ? "-right-2" : "-left-2",
                    )}
                  />
                )}
                <StageHead
                  stage={stage}
                  own={own}
                  onGrab={() => setMovingCol(stage)}
                  onLetGo={() => {
                    setMovingCol(null);
                    setColOver(null);
                  }}
                  onStep={(by) => void reorder(stage, at + by)}
                  first={at === 0}
                  last={at === stages.length - 1}
                  count={jobs ? column.length : null}
                  sum={sum}
                  canRemove={stages.length > 1}
                  onRename={renameOwn}
                  onRemove={() => void takeOff(stage)}
                />
                <ul className="mt-1 flex min-h-24 flex-col gap-2">
                  {!jobs && !problem && <li className="px-2 py-3 text-xs text-muted">Loading…</li>}
                  {jobs && column.length === 0 && <li className="px-2 py-3 text-xs text-muted">Nothing here.</li>}
                  {column.map((job) => (
                    <li
                      key={job.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(job.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => router.push(dealOf(job))}
                      className={clsx(
                        "cursor-pointer rounded-md bg-surface p-3 shadow-[var(--shadow-soft)] ring-1 ring-line hover:ring-ink-2 active:cursor-grabbing",
                        dragging === job.id && "opacity-60",
                      )}
                    >
                      <Link
                        href={dealOf(job)}
                        className="block text-sm font-medium text-ink hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {job.customerName}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-2">
                        {job.title}
                        {job.address ? ` · ${job.address.split(",")[0]}` : ""}
                      </p>
                      {job.sample && (
                        <p className="mt-1.5 inline-flex h-6 items-center rounded-full bg-sun px-2.5 text-[11px] font-medium text-sun-ink ring-1 ring-sun-line/30">
                          {SAMPLE_DEAL_HINT}
                        </p>
                      )}
                      <PulseMarks pulse={pulses[job.id]} />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm tabular-nums text-ink">
                          <Owner email={job.owner} />
                          {dollars(job.value)}
                        </span>
                        {job.lat !== null && (
                          <Link
                            href={`${PATHS.designer}?job=${job.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                          >
                            <PenTool className="size-3.5" aria-hidden /> {job.projectId ? "Design" : "Design it"}
                          </Link>
                        )}
                      </div>
                      <label className="mt-2 block" onClick={(e) => e.stopPropagation()}>
                        <span className="sr-only">Stage of {job.customerName}&apos;s deal</span>
                        {stagePicker(job, stageSelect)}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <AddStageColumn stages={stages} own={own} pipelineName={named.name} onAdd={addOwnStage} />
        </div>
      ) : (
        <div className={clsx(ui.card, "mt-4 overflow-x-auto")}>
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                <th className="px-5 py-3 font-medium">Deal</th>
                <th className="px-3 py-3 font-medium">Address</th>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 text-right font-medium">Value</th>
                <th className="px-3 py-3 font-medium">Install</th>
                <th className="px-5 py-3 font-medium">Changed</th>
              </tr>
            </thead>
            <tbody>
              {!jobs && !problem && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {jobs && shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-ink-2">
                    No deals at {stages.length === 1 ? "this stage" : "these stages"}.
                  </td>
                </tr>
              )}
              {shown.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => router.push(dealOf(job))}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                >
                  <td className="px-5 py-3">
                    <Link href={dealOf(job)} className="font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                      {job.customerName}
                    </Link>
                    <span className="block text-xs text-muted">{job.title}</span>
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-3 text-ink-2">{job.address || "–"}</td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <label>
                      <span className="sr-only">Stage of {job.customerName}&apos;s deal</span>
                      {stagePicker(job, clsx(stageSelect, "w-40"))}
                    </label>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{dollars(job.value)}</td>
                  <td className="px-3 py-3 tabular-nums text-ink-2">{job.installDate ? shortDate(job.installDate) : "–"}</td>
                  <td className="px-5 py-3 tabular-nums text-ink-2">{shortDate(job.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * A column's head: the stage's name, its count and value. On hover, a stage the business added can be renamed, and
 * any stage taken off the pipeline (while it keeps one). An added stage says what it counts as.
 */
function StageHead({
  stage,
  own,
  count,
  sum,
  canRemove,
  onRename,
  onRemove,
  onGrab,
  onLetGo,
  onStep,
  first,
  last,
}: {
  stage: StageKey;
  own: readonly OwnStage[];
  /** Dragging the head starts moving the column; letting go ends it. */
  onGrab: () => void;
  onLetGo: () => void;
  /** Moves the column one place left (-1) or right (1), for keyboards and touch. */
  onStep: (by: -1 | 1) => void;
  first: boolean;
  last: boolean;
  count: number | null;
  sum: number;
  canRemove: boolean;
  onRename: (stage: OwnStage, name: string) => Promise<boolean>;
  onRemove: () => void;
}) {
  const added = own.find((s) => s.id === stage) ?? null;
  const [name, setName] = useState<string | null>(null);
  const save = async () => {
    if (!added || name === null) return;
    if (!name.trim() || name.trim() === added.name) return setName(null);
    if (await onRename(added, name)) setName(null);
  };
  return (
    <header
      className={clsx("group rounded-md px-2 py-1.5", name === null && "cursor-grab active:cursor-grabbing")}
      draggable={name === null}
      title={name === null ? "Drag to move this stage" : undefined}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers start a drag only once something is set.
        e.dataTransfer.setData("text/plain", stageName(stage, own));
        onGrab();
      }}
      onDragEnd={onLetGo}
    >
      <div className="flex items-baseline justify-between gap-2">
        {name !== null ? (
          <input
            autoFocus
            aria-label="Stage name"
            className={clsx(ui.input, "h-7 min-h-7 w-full text-[12px]")}
            value={name}
            maxLength={STAGE_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setName(null);
            }}
          />
        ) : (
          <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink">
            {stageName(stage, own)} <span className="tabular-nums text-muted">{count ?? ""}</span>
          </h2>
        )}
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-xs tabular-nums text-muted">{sum ? dollars(sum) : ""}</span>
          {added && name === null && (
            <button
              title="Rename this stage"
              aria-label={`Rename ${added.name}`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => setName(added.name)}
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}
          {name === null && !first && (
            <button
              title="Move left"
              aria-label={`Move ${stageName(stage, own)} left`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => onStep(-1)}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
          )}
          {name === null && !last && (
            <button
              title="Move right"
              aria-label={`Move ${stageName(stage, own)} right`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => onStep(1)}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          )}
          {canRemove && name === null && (
            <button
              title="Take this stage off the pipeline"
              aria-label={`Take ${stageName(stage, own)} off this pipeline`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"
              onClick={onRemove}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </span>
      </div>
      {added && <p className="mt-0.5 text-[11px] text-muted">Counts as {STAGE_LABELS[added.base]}</p>}
    </header>
  );
}

/**
 * The last column of a pipeline: add a stage of the business's own. Its name, where it goes, and which of the twelve
 * it counts as (for the figures, Sol and the approvals), set to the stage before it until changed.
 */
function AddStageColumn({
  stages,
  own,
  pipelineName,
  onAdd,
}: {
  stages: readonly StageKey[];
  own: readonly OwnStage[];
  pipelineName: string;
  onAdd: (input: { name: string; base: JobStage; after: number }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [after, setAfter] = useState(stages.length - 1);
  const [base, setBase] = useState<JobStage | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = base ?? baseAt(stages, after, own);
  const close = () => {
    setOpen(false);
    setName("");
    setBase(null);
  };
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd({ name, base: counts, after });
    setBusy(false);
    if (ok) close();
  };
  if (!open)
    return (
      <button
        onClick={() => {
          setAfter(stages.length - 1);
          setOpen(true);
        }}
        className="flex min-h-24 w-56 shrink-0 items-start justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-4 text-[13px] font-medium text-ink-2 hover:border-ink-2 hover:text-ink"
      >
        <Plus className="size-4" aria-hidden /> Add a stage
      </button>
    );
  return (
    <section aria-label="Add a stage" className="w-72 shrink-0 space-y-3 rounded-lg border border-line bg-surface p-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink">New stage in {pipelineName}</p>
      <label className="block text-xs text-muted">
        Name
        <input
          autoFocus
          className={clsx(ui.input, "mt-1")}
          value={name}
          maxLength={STAGE_NAME_MAX}
          placeholder="Site visit booked"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") close();
          }}
        />
      </label>
      <label className="block text-xs text-muted">
        Goes after
        <select className={clsx(ui.input, "mt-1 appearance-auto")} value={after} onChange={(e) => setAfter(Number(e.target.value))}>
          <option value={-1}>At the start</option>
          {stages.map((k, i) => (
            <option key={k} value={i}>
              {stageName(k, own)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        Counts as
        <select className={clsx(ui.input, "mt-1 appearance-auto")} value={counts} onChange={(e) => setBase(e.target.value as JobStage)}>
          {JOB_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px]">A deal here is {STAGE_LABELS[counts]} for your figures, Sol and approvals.</span>
      </label>
      <div className="flex gap-2">
        <button className={clsx(ui.primary, "h-9 px-3 text-[13px]")} onClick={() => void save()} disabled={!name.trim() || busy}>
          {busy ? "Adding…" : "Add stage"}
        </button>
        <button className={clsx(ui.quiet, "h-9 px-3 text-[13px]")} onClick={close}>
          Cancel
        </button>
      </div>
    </section>
  );
}

/** Whose a deal is, as their initials in a small round ("–" for no one yet), their email on hover. */
export function Owner({ email }: { email: string | null }) {
  const name = email?.split("@")[0] ?? "";
  const initials = name
    .split(/[._+-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      title={email ? `Owner: ${email}` : "No owner yet"}
      className={clsx(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
        email ? "bg-primary text-primary-ink" : "border border-dashed border-line text-muted",
      )}
    >
      {email ? initials || "?" : "–"}
    </span>
  );
}
