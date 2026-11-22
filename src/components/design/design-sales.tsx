"use client";

import { SAMPLE_DEAL_HINT } from "@/lib/domain/design/deal-tour";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, LayoutGrid, List, PenTool, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { JOB_STAGES, OPEN_STAGES, STAGE_LABELS, WON_STAGES, type JobStage, type SavedPipeline } from "@/lib/domain/design/crm";
import { DEFAULT_PIPELINE, PIPELINES, cleanPipelineChoice, pipelineOf, type PipelineChoice } from "@/lib/domain/design/deal";
import {
  createPipeline,
  deletePipeline,
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

/** The fine bar over each column: being sold in the signal orange, won in green, lost in red. */
const stageBar = (stage: JobStage) =>
  OPEN_STAGES.includes(stage) ? "bg-sun-line" : WON_STAGES.includes(stage) ? "bg-positive" : "bg-danger";

/** "$48k" for a column's total on a phone, where "$48,120" crowds the stage's name. */
const shortDollars = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : dollars(n));

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
 * pipeline: a run of stages. One of the set pipelines or one the business has
 * saved (kept on the server, shared by everyone in it) can be picked, or any
 * stages ticked on and off, and the deals at those stages show as cards in a
 * column for each stage, or as one list. A deal moves by choosing its stage
 * (or, as a card, by being dragged to another column); the move is saved at
 * once and written to the customer's history. A set of ticked stages can be
 * saved as a pipeline of the business's own, and its own can be renamed,
 * given the stages now ticked, or deleted. Which pipeline and view this
 * person last used are remembered on their device.
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
  // The pipelines the business has saved, and the name being typed for a new one or a renamed one.
  const [saved, setSaved] = useState<SavedPipeline[]>([]);
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  // The deal being dragged, and the column it is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<JobStage | null>(null);
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
      if (!gone && res.ok) setSaved(res.pipelines);
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
  const pick = (p: { id: string; stages: readonly JobStage[] }) => {
    choose({ ...choice, stages: [...p.stages], pipeline: p.id });
    setNaming(null);
  };
  /** Saves the name being typed: a new pipeline of the stages ticked, or a new name for one of the business's own. */
  const keep = async () => {
    if (!naming?.name.trim()) return;
    const old = saved.find((s) => s.id === naming.id);
    const res = old
      ? await savePipeline(old.id, { name: naming.name, stages: old.stages })
      : await createPipeline({ name: naming.name, stages: choice.stages });
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setSaved(old ? saved.map((s) => (s.id === old.id ? res.pipeline : s)) : [...saved, res.pipeline]);
    setNaming(null);
    if (!old) pick(res.pipeline);
  };
  const remove = async (p: SavedPipeline) => {
    if (!window.confirm(`Delete the pipeline "${p.name}" for everyone in the business? Its deals are untouched.`)) return;
    const res = await deletePipeline(p.id);
    if (!res.ok) return setProblem(res.message);
    setSaved(saved.filter((s) => s.id !== p.id));
  };

  const move = async (id: string, stage: JobStage) => {
    const job = jobs?.find((j) => j.id === id);
    if (!jobs || !job || job.stage === stage) return;
    // Shown at once, and put back if the server says no.
    setJobs(jobs.map((j) => (j.id === id ? { ...j, stage } : j)));
    const res = await saveJob(id, { stage });
    if (!res.ok) {
      setProblem(res.message);
      setJobs((now) => (now ?? []).map((j) => (j.id === id ? { ...j, stage: job.stage } : j)));
    } else setProblem(null);
  };

  // The pipeline being looked at: the one picked, or the Sales pipeline when what was kept is no longer one of them.
  const named = pipelineOf(choice.stages, choice.pipeline, saved) ?? PIPELINES[0];
  const stages = named.stages;
  const own = saved.find((s) => s.id === named.id) ?? null;
  const shown = (jobs ?? []).filter((j) => stages.includes(j.stage) && (whose === "all" || (whose === "mine" ? j.owner === me : !j.owner)));
  const worth = shown.reduce((n, j) => n + (j.value ?? 0), 0);
  const deal = (id: string) => `${PATHS.deals}/${id}`;
  // The sample deal a new business starts with opens on the tour of a deal (deal-tour.ts).
  const dealOf = (job: JobLine) => (job.sample ? `${deal(job.id)}?tour=1` : deal(job.id));

  const pipelineSelect = (className: string) => (
    <select
      className={className}
      value={named.id}
      onChange={(e) => {
        const p = [...PIPELINES, ...saved].find((x) => x.id === e.target.value);
        if (p) pick(p);
      }}
    >
      {PIPELINES.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      {saved.length > 0 && (
        <optgroup label="Your own">
          {saved.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
  const views = (
    [
      ["cards", "Cards", LayoutGrid],
      ["list", "List", List],
    ] as const
  ).map(([view, name, Icon]) => ({ view, name, Icon }));

  return (
    <div className="px-1.5 py-2 sm:px-5 sm:py-8 lg:px-10">
      {/* On a phone: one graphite card. The pipeline is the title (pressed to pick another), New deal beside it,
          and under them whose deals, how many and what they are worth, and cards or list as two icons. */}
      <div className="rounded-2xl bg-primary p-4 text-primary-ink sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <label className="relative flex min-w-0 items-center">
              <span className="sr-only">Pipeline</span>
              {pipelineSelect(
                "min-w-0 max-w-full appearance-none truncate bg-transparent pr-6 text-[21px] font-semibold tracking-[-0.02em] text-primary-ink outline-none [field-sizing:content] [&>*]:text-ink",
              )}
              <ChevronDown className="pointer-events-none absolute right-0 size-4 opacity-80" aria-hidden />
            </label>
            <p className="mt-0.5 text-[12px] tabular-nums opacity-70">
              {jobs ? `${shown.length} ${shown.length === 1 ? "deal" : "deals"}${worth ? ` · ${dollars(worth)}` : ""}` : "\u00a0"}
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            disabled={adding}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white/12 px-3.5 text-[14px] font-medium ring-1 ring-white/15 active:bg-white/20"
          >
            <Plus className="size-4" aria-hidden /> New deal
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="relative flex min-w-0 items-center">
            <span className="sr-only">Whose deals</span>
            <select
              className="h-9 min-w-0 appearance-none truncate rounded-lg bg-transparent pl-3 pr-8 text-[14px] text-primary-ink outline-none ring-1 ring-white/25 [&>*]:text-ink"
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
          <button className={ui.primary} onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="size-4" aria-hidden /> New deal
          </button>
        </PageHead>

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
              {pipelineSelect(clsx(ui.input, "h-9 min-h-9 w-64 appearance-auto font-medium"))}
            </label>
            {naming ? (
              <span className="ml-1 inline-flex items-center gap-1.5">
                <input
                  autoFocus
                  aria-label="Pipeline name"
                  className={clsx(ui.input, "h-9 min-h-9 w-44")}
                  value={naming.name}
                  maxLength={40}
                  placeholder="Pipeline name"
                  onChange={(e) => setNaming({ ...naming, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void keep();
                    if (e.key === "Escape") setNaming(null);
                  }}
                />
                <button className={clsx(ui.primary, "h-9 px-3 text-[13px]")} onClick={keep} disabled={!naming.name.trim()}>
                  Save
                </button>
                <button className={clsx(ui.quiet, "h-9 px-3 text-[13px]")} onClick={() => setNaming(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center gap-3 text-[13px] font-medium">
                {own && (
                  <>
                    <button className={ui.link} onClick={() => setNaming({ id: own.id, name: own.name })}>
                      Rename
                    </button>
                    <button className="inline-flex items-center gap-1 text-muted hover:text-danger" onClick={() => void remove(own)}>
                      <Trash2 className="size-3.5" aria-hidden /> Delete
                    </button>
                  </>
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
        <div className="no-scrollbar -mx-1.5 mt-3 flex snap-x snap-mandatory scroll-px-1.5 gap-2.5 overflow-x-auto px-1.5 pb-4 sm:mt-4 sm:gap-3 sm:mx-0 sm:snap-none sm:px-0">
          {stages.map((stage) => {
            // Deals still being sold in the order to ring (as Primero's): the warmest and nearest their end first.
            const column = shown
              .filter((j) => j.stage === stage)
              .sort((a, b) => (pulses[b.id]?.priority ?? -Infinity) - (pulses[a.id]?.priority ?? -Infinity));
            const sum = column.reduce((n, j) => n + (j.value ?? 0), 0);
            return (
              <section
                key={stage}
                aria-label={STAGE_LABELS[stage]}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => setOver((now) => (now === stage ? null : now))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) void move(dragging, stage);
                  setDragging(null);
                  setOver(null);
                }}
                className={clsx(
                  "relative flex w-[86%] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-surface-2 p-2 pt-2.5 sm:w-auto sm:min-w-72 sm:flex-1 sm:shrink sm:basis-72 sm:rounded-lg",
                  over === stage ? "border-sun-line" : "border-transparent",
                )}
              >
                <span className={clsx("absolute inset-x-0 top-0 h-[3px]", stageBar(stage))} aria-hidden />
                <header className="flex items-baseline justify-between gap-2 px-2 py-1.5">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">
                    {STAGE_LABELS[stage]}{" "}
                    <span className="font-normal tabular-nums text-muted">
                      {jobs ? `· ${column.length}` : ""}
                      {sum ? <span className="normal-case sm:hidden"> · {shortDollars(sum)}</span> : null}
                    </span>
                  </h2>
                  <p className="hidden text-xs tabular-nums text-muted sm:block">{sum ? dollars(sum) : ""}</p>
                </header>
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
                      <p className="mt-0.5 truncate text-[13px] text-ink-2 sm:text-xs">
                        {job.address ? job.address.split(",")[0] : job.title}
                        {job.address && job.title ? <span className="text-muted"> · {job.title}</span> : null}
                      </p>
                      <PulseMarks pulse={pulses[job.id]} />
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Owner email={job.owner} />
                          {job.sample ? (
                            <span className="truncate rounded-full bg-sun px-2.5 py-1 text-[11px] font-medium text-sun-ink ring-1 ring-sun-line/30">
                              {SAMPLE_DEAL_HINT}
                            </span>
                          ) : (
                            <span className="truncate text-[12px] text-muted" title={`Changed ${shortDate(job.updatedAt)}`}>
                              {agoWords(job.updatedAt)}
                            </span>
                          )}
                        </span>
                        {job.lat !== null && (
                          <Link
                            href={`${PATHS.designer}?job=${job.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="tap-area inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-sun-ink hover:text-ink sm:text-xs sm:text-ink-2"
                          >
                            <PenTool className="hidden size-3.5 sm:block" aria-hidden />
                            {job.projectId ? "Open design" : "Design it"}
                            <ArrowRight className="size-3.5 sm:hidden" aria-hidden />
                          </Link>
                        )}
                      </div>
                      <label className="mt-2 hidden sm:block" onClick={(e) => e.stopPropagation()}>
                        <span className="sr-only">Stage of {job.customerName}&apos;s deal</span>
                        <select className={stageSelect} value={job.stage} onChange={(e) => void move(job.id, e.target.value as JobStage)}>
                          {JOB_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {STAGE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
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
                      <select
                        className={clsx(stageSelect, "w-36")}
                        value={job.stage}
                        onChange={(e) => void move(job.id, e.target.value as JobStage)}
                      >
                        {JOB_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
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
