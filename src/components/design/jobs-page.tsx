"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { todayInMarket } from "@/lib/domain/market";
import { suburbOfAddress } from "@/lib/domain/design/deal-feed";
import {
  JOB_PHASES,
  filterOf,
  filtersFor,
  jobsAt,
  nextStepOf,
  phaseCounts,
  phaseNote,
  stageWords,
  type JobPhase,
} from "@/lib/domain/design/jobs-view";
import { listJobs, type JobLine } from "@/lib/services/crm";
import { PATHS } from "./design-shell";
import { NewDeal } from "./design-customers";
import { SchedulerPage } from "./design-scheduler";
import { JobMapPage } from "./design-job-map";

type JobsView = "list" | "board" | "calendar" | "map";
const VIEWS: { id: JobsView; label: string }[] = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
  { id: "calendar", label: "Calendar" },
  { id: "map", label: "Map" },
];
const VIEW_KEY = "renuabl.design.jobs-view";

const pill = (on: boolean) =>
  clsx("rounded-full px-3 py-1 text-[13px] transition", on ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink");

/**
 * Jobs (10 Nov 2026, Martin: CRM, Procurement and Installation folded into one): every job by where it is in its life,
 * Selling, Getting ready, Installing, Finishing and Done (jobs-view.ts), each stage's quick filters (what were the
 * Pre-approvals, Solar Victoria, Book an installation and After install pages), and the same jobs as a list, a board,
 * the install calendar or the map.
 */
export function JobsPage({ initialPhase }: { initialPhase?: JobPhase }) {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [phase, setPhase] = useState<JobPhase>(initialPhase ?? "selling");
  const [filter, setFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<JobsView>(() => {
    try {
      const v = typeof window !== "undefined" ? localStorage.getItem(VIEW_KEY) : null;
      return VIEWS.some((x) => x.id === v) ? (v as JobsView) : "list";
    } catch {
      return "list";
    }
  });
  const pickView = (v: JobsView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private window: it resets next time.
    }
  };
  useEffect(() => {
    let gone = false;
    void listJobs().then((r) => {
      if (gone) return;
      if (r.ok) setJobs(r.jobs);
      else setProblem(r.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  const today = todayInMarket();
  const counts = useMemo(() => (jobs ? phaseCounts(jobs, today) : null), [jobs, today]);
  const filters = filtersFor(phase);
  const atPhase = useMemo(() => (jobs ? jobsAt(jobs, phase, null, today) : []), [jobs, phase, today]);
  const shown = filter ? atPhase.filter((j) => filterOf(j, phase, today) === filter) : atPhase;
  const choosePhase = (p: JobPhase) => {
    setPhase(p);
    setFilter(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          aria-label="New deal"
          title="New deal"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-ink-2"
        >
          <Plus className={clsx("size-5 transition", adding && "rotate-45")} strokeWidth={2.25} aria-hidden />
        </button>
        <h1 className="text-[20px] font-semibold text-ink">Jobs</h1>
        <div
          role="tablist"
          aria-label="How to see them"
          className="ml-auto inline-flex gap-0.5 rounded-full bg-surface p-1 ring-1 ring-line"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => pickView(v.id)}
              className={pill(view === v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {adding && (
        <div className="mt-4">
          <NewDeal onClose={() => setAdding(false)} />
        </div>
      )}
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {view === "calendar" ? (
        <div className="mt-6">
          <SchedulerPage />
        </div>
      ) : view === "map" ? (
        <div className="mt-6">
          <JobMapPage />
        </div>
      ) : (
        <>
          {/* The five stages of a job's life, each with how many and its one figure. */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="Where the job is">
            {JOB_PHASES.map((p) => {
              const on = phase === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  title={p.what}
                  onClick={() => choosePhase(p.id)}
                  className={clsx(
                    "rounded-2xl bg-surface px-4 py-3 text-left transition",
                    on ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink-2",
                  )}
                >
                  <span className="block text-[13px] text-ink-2">{p.label}</span>
                  <span className="block text-[24px] font-semibold tabular-nums text-ink">{counts ? counts[p.id] : "–"}</span>
                  <span className="block truncate text-[12px] text-muted">{jobs ? phaseNote(jobs, p.id, today) : " "}</span>
                </button>
              );
            })}
          </div>

          {filters.length > 0 && view === "list" && (
            <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Narrow it down">
              <button type="button" role="tab" aria-selected={!filter} onClick={() => setFilter(null)} className={chip(!filter)}>
                All {atPhase.length}
              </button>
              {filters.map((f) => {
                const n = atPhase.filter((j) => filterOf(j, phase, today) === f.id).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(filter === f.id ? null : f.id)}
                    className={chip(filter === f.id)}
                  >
                    {f.label} {n}
                  </button>
                );
              })}
            </div>
          )}

          {!jobs ? (
            <p className="mt-6 animate-pulse text-center text-sm text-muted">Looking over your jobs…</p>
          ) : view === "board" ? (
            <Board jobs={atPhase} phase={phase} today={today} />
          ) : (
            <JobList jobs={shown} phase={phase} today={today} />
          )}
        </>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  clsx(
    "rounded-full px-3 py-1 text-[12.5px] font-medium transition",
    on ? "bg-primary text-primary-ink" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink",
  );

const money = (v: number | null) => (v ? `$${Math.round(v).toLocaleString("en-AU")}` : null);
const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : null;

/** The date worth showing for a job at this stage. */
function whenOf(j: JobLine, phase: JobPhase): string {
  if (phase === "installing" || phase === "ready")
    return j.installDate ? `Installs ${dayWords(j.installDate)}` : `Sold ${dayWords(j.wonAt) ?? ""}`;
  if (phase === "finishing" || phase === "done") return `Installed ${dayWords(j.installedAt ?? j.installDate) ?? ""}`;
  return `Updated ${dayWords(j.updatedAt)}`;
}

function NextChip({ job, phase, today }: { job: JobLine; phase: JobPhase; today: string }) {
  const next = nextStepOf(job, phase, today);
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        next.tone === "you" ? "bg-sun text-sun-ink" : "bg-positive-soft text-positive",
      )}
    >
      {next.words}
    </span>
  );
}

function JobList({ jobs, phase, today }: { jobs: JobLine[]; phase: JobPhase; today: string }) {
  if (jobs.length === 0)
    return <p className="mt-6 rounded-2xl bg-surface px-5 py-8 text-center text-[14px] text-ink-2 ring-1 ring-line">No jobs here.</p>;
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {jobs.map((j) => (
        <li key={j.id}>
          <Link
            href={`${PATHS.deals}/${j.id}`}
            className="grid grid-cols-1 items-center gap-1 px-4 py-3 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_8rem] sm:gap-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-ink">{j.customerName}</span>
              <span className="block truncate text-[12.5px] text-muted">{suburbOfAddress(j.address) || j.address || "No address yet"}</span>
            </span>
            <span className="truncate text-[13px] text-ink-2">
              {[j.kw ? `${j.kw.toFixed(1)} kW` : j.title, money(j.value), stageWords(j.stage)].filter(Boolean).join(" · ")}
            </span>
            <span>
              <NextChip job={j} phase={phase} today={today} />
            </span>
            <span className="text-[12.5px] text-muted sm:text-right">{whenOf(j, phase)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The stage's jobs as columns by its quick filters (one column where it has none). */
function Board({ jobs, phase, today }: { jobs: JobLine[]; phase: JobPhase; today: string }) {
  const cols = filtersFor(phase);
  const columns = cols.length
    ? cols.map((c) => ({ ...c, jobs: jobs.filter((j) => filterOf(j, phase, today) === c.id) }))
    : [{ id: "all", label: "All", jobs }];
  return (
    <div
      className={clsx(
        "mt-4 grid gap-3",
        columns.length >= 4 ? "md:grid-cols-4" : columns.length === 3 ? "md:grid-cols-3" : columns.length === 2 ? "md:grid-cols-2" : "",
      )}
    >
      {columns.map((c) => (
        <div key={c.id} className="rounded-2xl bg-canvas p-3 ring-1 ring-line">
          <p className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-ink">
            {c.label} <span className="tabular-nums text-muted">{c.jobs.length}</span>
          </p>
          <div className="space-y-2">
            {c.jobs.map((j) => (
              <Link
                key={j.id}
                href={`${PATHS.deals}/${j.id}`}
                className="block rounded-xl bg-surface p-3 ring-1 ring-line transition hover:ring-ink-2"
              >
                <span className="block truncate text-[13.5px] font-medium text-ink">{j.customerName}</span>
                <span className="block truncate text-[12px] text-muted">
                  {[suburbOfAddress(j.address), j.kw ? `${j.kw.toFixed(1)} kW` : null, money(j.value)].filter(Boolean).join(" · ")}
                </span>
                <span className="mt-1.5 block">
                  <NextChip job={j} phase={phase} today={today} />
                </span>
              </Link>
            ))}
            {c.jobs.length === 0 && <p className="py-3 text-center text-[12px] text-muted">None</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
