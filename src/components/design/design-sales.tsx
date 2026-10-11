"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, List, PenTool, Trash2, UserPlus } from "lucide-react";
import clsx from "clsx";
import { JOB_STAGES, STAGE_LABELS, type JobStage, type SavedPipeline } from "@/lib/domain/design/crm";
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
import { PATHS, PageHead, ui } from "./design-shell";

/** Where this person's last way of looking at their deals is kept, on their device. */
const CHOICE = "renuabl.design.pipeline";

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
  const [problem, setProblem] = useState<string | null>(null);
  const [choice, setChoice] = useState<PipelineChoice>(DEFAULT_PIPELINE);
  // The pipelines the business has saved, and the name being typed for a new one or a renamed one.
  const [saved, setSaved] = useState<SavedPipeline[]>([]);
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  // The deal being dragged, and the column it is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<JobStage | null>(null);

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
  const shown = (jobs ?? []).filter((j) => stages.includes(j.stage));
  const worth = shown.reduce((n, j) => n + (j.value ?? 0), 0);
  const deal = (id: string) => `${PATHS.deals}/${id}`;

  return (
    <div className="px-5 py-8 lg:px-10">
      <PageHead eyebrow="Sales · Pipelines" title={named.name}>
        <Link href={`${PATHS.customers}?new=1`} className={ui.primary}>
          <UserPlus className="size-4" aria-hidden /> New customer
        </Link>
      </PageHead>

      <div className={clsx(ui.card, "mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3")}>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Pipeline">
          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Pipeline</span>
            <select
              className={clsx(ui.input, "h-9 min-h-9 w-64 appearance-auto font-medium")}
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
          {stages.map((stage) => {
            const column = shown.filter((j) => j.stage === stage);
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
                  "flex min-w-72 flex-1 basis-72 snap-start flex-col rounded-lg border bg-surface-2 p-2",
                  over === stage ? "border-sun-line" : "border-transparent",
                )}
              >
                <header className="flex items-baseline justify-between gap-2 px-2 py-1.5">
                  <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink">
                    {STAGE_LABELS[stage]} <span className="tabular-nums text-muted">{jobs ? column.length : ""}</span>
                  </h2>
                  <p className="text-xs tabular-nums text-muted">{sum ? dollars(sum) : ""}</p>
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
                      onClick={() => router.push(deal(job.id))}
                      className={clsx(
                        "cursor-pointer rounded-md bg-surface p-3 shadow-[var(--shadow-soft)] ring-1 ring-line hover:ring-ink-2 active:cursor-grabbing",
                        dragging === job.id && "opacity-60",
                      )}
                    >
                      <Link
                        href={deal(job.id)}
                        className="block text-sm font-medium text-ink hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {job.customerName}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-2">
                        {job.title}
                        {job.address ? ` · ${job.address.split(",")[0]}` : ""}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm tabular-nums text-ink">{dollars(job.value)}</span>
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
                  onClick={() => router.push(deal(job.id))}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                >
                  <td className="px-5 py-3">
                    <Link href={deal(job.id)} className="font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
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
