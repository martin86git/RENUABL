"use client";

import { SAMPLE_DEAL_HINT } from "@/lib/domain/design/deal-tour";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, PenTool, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { JOB_STAGES, OPEN_STAGES, STAGE_LABELS, WON_STAGES, type JobStage } from "@/lib/domain/design/crm";
import { DEFAULT_PIPELINE, cleanPipelineChoice, type PipelineChoice } from "@/lib/domain/design/deal";
import {
  STAGE_NAME_MAX,
  baseAt,
  columnOf,
  isJobStage,
  keyOfDeal,
  labelOf,
  moveStage,
  moveTo,
  pipelinesFor,
  stageChoices,
  stageName,
  type KeptPipeline,
  type OwnStage,
  type ShownPipeline,
  type StageKey,
  type StageNames,
} from "@/lib/domain/design/pipeline-stages";
import {
  addStage,
  createPipeline,
  deletePipeline,
  deleteStage,
  renameBuiltinStage,
  stageBookChanged,
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
import { BatteryIcon, ChargerIcon, PanelIcon } from "./deal-banner";
import { jobHas } from "@/lib/domain/design/customers";
import { loadPulses } from "@/lib/services/deal-pulse";
import type { DealPulse } from "@/lib/domain/design/deal-heat";

/** Where this person's last way of looking at their deals is kept, on their device. */
const CHOICE = "renuabl.design.pipeline";

/** The pipeline menu's last option: starts a new pipeline. */
const NEW_PIPELINE = "__new";

/** The fine bar over each column: being sold in the signal orange, won in green, lost in red. */
const stageBar = (stage: JobStage) =>
  OPEN_STAGES.includes(stage) ? "bg-sun-line" : WON_STAGES.includes(stage) ? "bg-positive" : "bg-danger";

/** "$48k" for a column's total on a phone, where "$48,120" crowds the stage's name. */
const shortDollars = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : dollars(n));

/**
 * What a deal is, as icons after its street: a panel, a battery, a charger, only those it has. A deal that is none of
 * them keeps its name in words.
 */
function KitMarks({ job }: { job: JobLine }) {
  const has = jobHas(job);
  if (!has.solar && !has.battery && !has.ev) {
    return job.title ? <span className="min-w-0 shrink truncate text-muted">{job.title}</span> : null;
  }
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-ink-2" title={job.title} aria-label={job.title} role="img">
      {has.solar && <PanelIcon className="size-4" />}
      {has.battery && <BatteryIcon className="size-4" />}
      {has.ev && <ChargerIcon className="size-4" />}
    </span>
  );
}

/** How long since a deal last changed, short: "Today", "2d ago", "3w ago", else the date. */
function agoWords(at: string): string {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return "Today";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return shortDate(at);
}

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
  // The business's own names for the twelve stages (only those it changed).
  const [names, setNames] = useState<StageNames>({});
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
      setNames(res.names ?? {});
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
  // New deals start as leads, so the lead column takes "+ Add new deal" in place of a button up top.
  const leadAt = stages.findIndex((_, i) => baseAt(stages, i, own) === "lead");

  // The board scrolls inside itself, down to the foot of the window, so each column's head stays in view.
  const board = useRef<HTMLDivElement>(null);
  const [boardTop, setBoardTop] = useState<number | null>(null);
  const showingCards = choice.view === "cards";
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const measure = () => setBoardTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [showingCards, problem]);

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
    stageBookChanged();
    return true;
  };
  /** Renames a stage on the board: one the business added, or one of the twelve (a blank name puts ours back). */
  const renameAny = async (key: StageKey, name: string) => {
    if (isJobStage(key)) {
      const res = await renameBuiltinStage(key, name);
      if (!res.ok) {
        setProblem(res.message);
        return false;
      }
      setProblem(null);
      setNames(res.names);
      stageBookChanged();
      return true;
    }
    const stage = own.find((s) => s.id === key);
    if (!stage) return false;
    const res = await renameStage(stage.id, name);
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    setOwn((now) => now.map((s) => (s.id === stage.id ? res.stage : s)));
    stageBookChanged();
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
      const base = labelOf(added.base, names);
      if (!window.confirm(`Remove the stage "${added.name}" for everyone? Its deals go back to ${base}.`)) return;
      const res = await deleteStage(added.id);
      if (!res.ok) return setProblem(res.message);
      setOwn((now) => now.filter((s) => s.id !== added.id));
      setKept((now) => now.map((k) => ({ ...k, stages: k.stages.filter((x) => x !== added.id) })));
      setJobs((now) => (now ?? []).map((j) => (j.subStage === added.id ? { ...j, subStage: null } : j)));
      stageBookChanged();
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
  const choices = stageChoices(own, names);
  const stagePicker = (job: JobLine, className: string) => (
    <select className={className} value={keyOfDeal(job, own)} onChange={(e) => void move(job.id, e.target.value)}>
      {choices.map((c) => (
        <option key={c.key} value={c.key}>
          {c.added ? `\u00a0\u00a0↳ ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );

  const pipelineSelect = (className: string, withNew: boolean) => (
    <select
      className={className}
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
      {withNew && <option value={NEW_PIPELINE}>+ New pipeline…</option>}
    </select>
  );
  const views = (
    [
      ["cards", "Cards", LayoutGrid],
      ["list", "List", List],
    ] as const
  ).map(([view, name, Icon]) => ({ view, name, Icon }));

  return (
    <div className="px-1.5 py-2 sm:px-5 sm:py-5 lg:px-10">
      {/* On a phone: one graphite card. The pipeline is the title (pressed to pick another), with how many deals and
          what they are worth under it and New deal beside it; under them whose deals, and cards or list as two icons. */}
      <div className="rounded-2xl bg-primary p-4 text-primary-ink sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <label className="relative flex min-w-0 items-center">
              <span className="sr-only">Pipeline</span>
              {pipelineSelect(
                "min-w-0 max-w-full appearance-none truncate bg-transparent pr-6 text-[21px] font-semibold tracking-[-0.02em] text-primary-ink outline-none [field-sizing:content] [&_option]:text-ink",
                false,
              )}
              <ChevronDown className="pointer-events-none absolute right-0 size-4 opacity-80" aria-hidden />
            </label>
            <p className="mt-0.5 text-[12px] tabular-nums opacity-70">
              {jobs ? `${shown.length} ${shown.length === 1 ? "deal" : "deals"}${worth ? ` · ${dollars(worth)}` : ""}` : "\u00a0"}
            </p>
          </div>
          {leadAt < 0 && (
            <button
              onClick={() => setAdding(true)}
              disabled={adding}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white/12 px-3.5 text-[14px] font-medium ring-1 ring-white/15 active:bg-white/20"
            >
              <Plus className="size-4" aria-hidden /> New deal
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="relative flex min-w-0 items-center">
            <span className="sr-only">Whose deals</span>
            <select
              className="h-9 min-w-0 appearance-none truncate rounded-lg bg-transparent pl-3 pr-8 text-[14px] text-primary-ink outline-none ring-1 ring-white/25 [&_option]:text-ink"
              value={whose}
              onChange={(e) => setWhose(e.target.value as typeof whose)}
            >
              <option value="all">Everyone&apos;s deals</option>
              <option value="mine">My deals</option>
              <option value="none">No owner yet</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 size-4 opacity-80" aria-hidden />
          </label>
          <div className="flex shrink-0 items-center rounded-lg bg-white/8 p-0.5 ring-1 ring-white/15" role="group" aria-label="View">
            {views.map(({ view, name, Icon }) => (
              <button
                key={view}
                aria-pressed={choice.view === view}
                aria-label={name}
                title={name}
                onClick={() => choose({ ...choice, view })}
                className={clsx(
                  "inline-flex size-9 items-center justify-center rounded-md",
                  choice.view === view ? "bg-white/18" : "opacity-70",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <PageHead eyebrow="CRM · Deals" title={named.name}>
          {leadAt < 0 && (
            <button className={ui.primary} onClick={() => setAdding(true)} disabled={adding}>
              <Plus className="size-4" aria-hidden /> New deal
            </button>
          )}
        </PageHead>

        <div className={clsx(ui.card, "mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2")}>
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
              {pipelineSelect(clsx(ui.input, "h-9 min-h-9 w-64 appearance-auto font-medium"), true)}
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
              {views.map(({ view, name, Icon }) => (
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
      </div>
      {adding && <NewDeal onClose={() => setAdding(false)} />}

      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {choice.view === "cards" ? (
        <div
          ref={board}
          style={boardTop === null ? undefined : ({ "--board-top": `${boardTop}px` } as React.CSSProperties)}
          className="no-scrollbar -mx-1.5 mt-3 flex max-h-[calc(100dvh-var(--board-top)-6rem)] snap-x snap-mandatory scroll-px-1.5 gap-2.5 overflow-auto px-1.5 pb-4 sm:mx-0 sm:max-h-[calc(100dvh-var(--board-top)-1rem)] sm:snap-none sm:gap-3 sm:px-0"
        >
          {stages.map((stage, at) => {
            // Deals still being sold in the order to ring (as Primero's): the warmest and nearest their end first.
            const column = shown
              .filter((j) => columnOf(j, stages, own) === stage)
              .sort((a, b) => (pulses[b.id]?.priority ?? -Infinity) - (pulses[a.id]?.priority ?? -Infinity));
            const sum = column.reduce((n, j) => n + (j.value ?? 0), 0);
            return (
              <section
                key={stage}
                aria-label={stageName(stage, own, names)}
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
                  "relative flex w-[86%] shrink-0 snap-start flex-col rounded-xl border bg-surface-2 p-2 pt-2.5 sm:w-auto sm:min-w-72 sm:flex-1 sm:shrink sm:basis-72 sm:rounded-lg",
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
                <span
                  className={clsx("absolute inset-x-0 top-0 h-[3px] rounded-t-[inherit]", stageBar(baseAt(stages, at, own)))}
                  aria-hidden
                />
                <div className="sticky top-0 z-10 -mx-2 -mt-2.5 rounded-t-[inherit] bg-surface-2 px-2 pt-2.5 pb-1">
                  <StageHead
                    stage={stage}
                    own={own}
                    names={names}
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
                    onRename={renameAny}
                    onRemove={() => void takeOff(stage)}
                  />
                  {at === leadAt && (
                    <button
                      onClick={() => setAdding(true)}
                      disabled={adding}
                      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong bg-surface/60 py-1.5 text-[13px] font-medium text-ink-2 hover:border-ink-2 hover:text-ink"
                    >
                      <Plus className="size-3.5" aria-hidden /> Add new deal
                    </button>
                  )}
                </div>
                <ul className="flex min-h-24 flex-col gap-2">
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
                        "cursor-pointer rounded-md bg-surface p-2.5 shadow-[var(--shadow-soft)] ring-1 ring-line hover:ring-ink-2 active:cursor-grabbing",
                        dragging === job.id && "opacity-60",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={dealOf(job)}
                          className="min-w-0 truncate text-[15px] font-medium text-ink hover:underline sm:text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {job.customerName}
                        </Link>
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink sm:text-sm">
                          {job.value ? dollars(job.value) : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-2 sm:text-xs">
                        <span className="min-w-0 truncate">{job.address ? job.address.split(",")[0] : job.title}</span>
                        {job.address ? <KitMarks job={job} /> : null}
                      </p>
                      <PulseMarks
                        pulse={pulses[job.id]}
                        end={
                          <span className="flex items-center gap-1.5">
                            {job.lat === null && (
                              <span className="sm:hidden">
                                <Owner email={job.owner} />
                              </span>
                            )}
                            {!job.sample && (
                              <span className="text-muted" title={`Changed ${shortDate(job.updatedAt)}`}>
                                {agoWords(job.updatedAt)}
                              </span>
                            )}
                          </span>
                        }
                      />
                      {job.sample && (
                        <p className="mt-1.5 truncate rounded-full bg-sun px-2.5 py-1 text-[11px] font-medium text-sun-ink ring-1 ring-sun-line/30">
                          {SAMPLE_DEAL_HINT}
                        </p>
                      )}
                      {/* One row: who owns it, its stage (changed here on a computer) and the designer's round. */}
                      <div className={clsx("mt-2 items-center gap-1.5", job.lat === null ? "hidden sm:flex" : "flex")}>
                        <Owner email={job.owner} />
                        <label className="hidden min-w-0 flex-1 sm:block" onClick={(e) => e.stopPropagation()}>
                          <span className="sr-only">Stage of {job.customerName}&apos;s deal</span>
                          {stagePicker(
                            job,
                            stageSelect
                              .replace("h-8", "h-6")
                              .replace("px-2", "px-1.5")
                              .replace("text-xs", "text-[11px]")
                              .replace("rounded-md", "rounded"),
                          )}
                        </label>
                        <span className="flex-1 sm:hidden" />
                        {job.lat !== null && (
                          <Link
                            href={`${PATHS.designer}?job=${job.id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={job.projectId ? `Open ${job.customerName}'s design` : `Design ${job.customerName}'s roof`}
                            title={job.projectId ? "Open design" : "Design it"}
                            className="tap-area inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sun-line/12 text-sun-line hover:bg-sun-line hover:text-white"
                          >
                            <PenTool className="size-3.5" aria-hidden />
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <AddStageColumn stages={stages} own={own} names={names} pipelineName={named.name} onAdd={addOwnStage} />
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
 * A column's head: the stage's name, its count and value. On hover, any stage can be renamed (one of the twelve for
 * the whole business, a blank name putting ours back), moved, or taken off the pipeline (while it keeps one). An
 * added stage says what it counts as; a renamed one of the twelve, what it was.
 */
function StageHead({
  stage,
  own,
  names,
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
  names: StageNames;
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
  onRename: (stage: StageKey, name: string) => Promise<boolean>;
  onRemove: () => void;
}) {
  const added = own.find((s) => s.id === stage) ?? null;
  // One of the twelve the business has renamed: ours is said under it, and a blank name puts it back.
  const renamedBuiltin = isJobStage(stage) && names[stage] ? STAGE_LABELS[stage] : null;
  const shownName = stageName(stage, own, names);
  const [name, setName] = useState<string | null>(null);
  const save = async () => {
    if (name === null) return;
    const typed = name.trim();
    // An added stage can't be left nameless; one of the twelve goes back to ours.
    if (typed === shownName || (!typed && !isJobStage(stage))) return setName(null);
    if (await onRename(stage, typed)) setName(null);
  };
  return (
    <header
      className={clsx("group rounded-md px-2 py-1.5", name === null && "cursor-grab active:cursor-grabbing")}
      draggable={name === null}
      title={name === null ? "Drag to move this stage" : undefined}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers start a drag only once something is set.
        e.dataTransfer.setData("text/plain", shownName);
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
            {shownName}{" "}
            <span className="tabular-nums text-muted">
              {count ?? ""}
              {sum ? <span className="normal-case sm:hidden"> · {shortDollars(sum)}</span> : null}
            </span>
          </h2>
        )}
        <span className="flex shrink-0 items-center gap-1">
          <span className="hidden text-xs tabular-nums text-muted sm:inline">{sum ? dollars(sum) : ""}</span>
          {name === null && (
            <button
              title="Rename this stage"
              aria-label={`Rename ${shownName}`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => setName(shownName)}
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}
          {name === null && !first && (
            <button
              title="Move left"
              aria-label={`Move ${shownName} left`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => onStep(-1)}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
          )}
          {name === null && !last && (
            <button
              title="Move right"
              aria-label={`Move ${shownName} right`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => onStep(1)}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          )}
          {canRemove && name === null && (
            <button
              title="Take this stage off the pipeline"
              aria-label={`Take ${shownName} off this pipeline`}
              className="rounded p-0.5 text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"
              onClick={onRemove}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </span>
      </div>
      {added && <p className="mt-0.5 text-[11px] text-muted">Counts as {labelOf(added.base, names)}</p>}
      {renamedBuiltin && name === null && <p className="mt-0.5 text-[11px] text-muted">Was {renamedBuiltin}</p>}
      {name !== null && isJobStage(stage) && (
        <p className="mt-1 text-[11px] text-muted">Renamed for everyone. Clear it to go back to {STAGE_LABELS[stage]}.</p>
      )}
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
  names,
  pipelineName,
  onAdd,
}: {
  stages: readonly StageKey[];
  own: readonly OwnStage[];
  names: StageNames;
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
              {stageName(k, own, names)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        Counts as
        <select className={clsx(ui.input, "mt-1 appearance-auto")} value={counts} onChange={(e) => setBase(e.target.value as JobStage)}>
          {JOB_STAGES.map((s) => (
            <option key={s} value={s}>
              {labelOf(s, names)}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px]">A deal here is {labelOf(counts, names)} for your figures, Sol and approvals.</span>
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
