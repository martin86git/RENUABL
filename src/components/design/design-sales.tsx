"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PenTool, UserPlus } from "lucide-react";
import clsx from "clsx";
import { JOB_STAGES, STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import { dollars, listJobs, saveJob, type JobLine } from "@/lib/services/crm";
import { PATHS, PageHead, ui } from "./design-shell";

/**
 * /design/sales: every job, in a column for the stage it has reached, with
 * what each column is worth. A job moves by choosing its stage on its card
 * (or by being dragged to another column); the move is saved at once and
 * written to the customer's history.
 */
export function SalesPage() {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The job being dragged, and the column it is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<JobStage | null>(null);

  useEffect(() => {
    let gone = false;
    void listJobs().then((res) => {
      if (gone) return;
      if (res.ok) setJobs(res.jobs);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

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

  return (
    <div className="px-5 py-8 lg:px-10">
      <PageHead eyebrow="Sales" title="Your jobs, from lead to installed.">
        <Link href={`${PATHS.customers}?new=1`} className={ui.primary}>
          <UserPlus className="size-4" aria-hidden /> New customer
        </Link>
      </PageHead>

      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {JOB_STAGES.map((stage) => {
          const column = (jobs ?? []).filter((j) => j.stage === stage);
          const worth = column.reduce((n, j) => n + (j.value ?? 0), 0);
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
                "flex w-64 shrink-0 flex-col rounded-lg border bg-surface-2 p-2",
                over === stage ? "border-sun-line" : "border-transparent",
              )}
            >
              <header className="flex items-baseline justify-between gap-2 px-2 py-1.5">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink">
                  {STAGE_LABELS[stage]} <span className="tabular-nums text-muted">{jobs ? column.length : ""}</span>
                </h2>
                <p className="text-xs tabular-nums text-muted">{worth ? dollars(worth) : ""}</p>
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
                    className={clsx(
                      "cursor-grab rounded-md bg-surface p-3 shadow-[var(--shadow-soft)] ring-1 ring-line active:cursor-grabbing",
                      dragging === job.id && "opacity-60",
                    )}
                  >
                    <Link href={`${PATHS.customers}/${job.customerId}`} className="block text-sm font-medium text-ink hover:underline">
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
                          className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                        >
                          <PenTool className="size-3.5" aria-hidden /> {job.projectId ? "Design" : "Design it"}
                        </Link>
                      )}
                    </div>
                    <label className="mt-2 block">
                      <span className="sr-only">Stage of {job.customerName}&apos;s job</span>
                      <select
                        className="block h-8 w-full appearance-auto rounded-md border border-line bg-surface px-2 text-xs text-ink-2 outline-none focus:border-forest"
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
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
