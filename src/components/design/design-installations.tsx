"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { daysUntil, inTheWorks, installOrder } from "@/lib/domain/design/deal";
import { todayInMarket } from "@/lib/domain/market";
import { dollars, listJobs, saveJob, type JobLine } from "@/lib/services/crm";
import { PATHS, PageHead, ui } from "./design-shell";

/** "In 9 days", "Tomorrow", "Today", "3 days overdue". */
function when(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return `${-days} ${days === -1 ? "day" : "days"} overdue`;
}

/**
 * /design/installations: every installation in the works, which is every job
 * that is won and not yet installed. Those with a date come first, soonest
 * first, so one whose date has passed leads; then those still to be booked.
 * A date is set here, and a job marked installed leaves the list (the move is
 * written to the customer's history like any other).
 */
export function InstallationsPage() {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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

  const patch = async (id: string, change: Parameters<typeof saveJob>[1]) => {
    const res = await saveJob(id, change);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setJobs((now) => (now ?? []).map((j) => (j.id === id ? { ...j, ...res.job } : j)));
  };

  const today = todayInMarket();
  const works = inTheWorks(jobs ?? []);
  const { booked, toBook } = installOrder(works);
  const overdue = booked.filter((j) => daysUntil(j.installDate!, today) < 0).length;
  const worth = works.reduce((n, j) => n + (j.value ?? 0), 0);

  const row = (job: JobLine) => {
    const days = job.installDate ? daysUntil(job.installDate, today) : null;
    return (
      <tr key={job.id} className="border-b border-line last:border-0">
        <td className="px-5 py-3">
          <Link href={`${PATHS.deals}/${job.id}`} className="font-medium text-ink hover:underline">
            {job.customerName}
          </Link>
          <span className="block text-xs text-muted">{job.title}</span>
        </td>
        <td className="max-w-[18rem] truncate px-3 py-3 text-ink-2">{job.address || "–"}</td>
        <td className="px-3 py-3">
          <label>
            <span className="sr-only">Install date for {job.customerName}</span>
            <input
              type="date"
              className={clsx(ui.input, "w-40 tabular-nums")}
              value={job.installDate ?? ""}
              onChange={(e) => void patch(job.id, { installDate: e.target.value || null })}
            />
          </label>
        </td>
        <td className="px-3 py-3 text-sm tabular-nums">
          {days === null ? (
            <span className="rounded bg-sun px-2 py-1 text-xs font-medium text-sun-ink">To book</span>
          ) : (
            <span className={days < 0 ? "font-medium text-danger" : "text-ink-2"}>{when(days)}</span>
          )}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-ink">{dollars(job.value)}</td>
        <td className="px-5 py-3 text-right">
          <button
            className={clsx(ui.quiet, "h-9 px-3 text-[13px]")}
            onClick={() => window.confirm(`Mark ${job.customerName}'s installation as done?`) && void patch(job.id, { stage: "installed" })}
          >
            <Check className="size-4" aria-hidden /> Installed
          </button>
        </td>
      </tr>
    );
  };

  const table = (title: string, rows: JobLine[], empty: string) => (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink">
        {title} <span className="tabular-nums text-muted">{jobs ? rows.length : ""}</span>
      </h2>
      <div className={clsx(ui.card, "mt-3 overflow-x-auto")}>
        <table className="w-full min-w-[50rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              <th className="px-5 py-3 font-medium">Job</th>
              <th className="px-3 py-3 font-medium">Address</th>
              <th className="px-3 py-3 font-medium">Install date</th>
              <th className="px-3 py-3 font-medium">When</th>
              <th className="px-3 py-3 text-right font-medium">Value</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-ink-2">
                  {jobs ? empty : problem ? "" : "Loading…"}
                </td>
              </tr>
            )}
            {rows.map(row)}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Installations" title="Installations in the works." />
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["In the works", jobs ? String(works.length) : "–"],
          ["Booked", jobs ? String(booked.length) : "–"],
          ["To book", jobs ? String(toBook.length) : "–"],
          ["Worth", jobs ? dollars(worth) : "–"],
        ].map(([k, v]) => (
          <div key={k} className={clsx(ui.card, "px-4 py-3.5")}>
            <dt className={ui.eyebrow}>{k}</dt>
            <dd className="mt-1.5 text-[22px] tabular-nums tracking-tight text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {overdue > 0 && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          {overdue} {overdue === 1 ? "installation has" : "installations have"} a date that has passed. Mark {overdue === 1 ? "it" : "them"}{" "}
          installed, or set a new date.
        </p>
      )}
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {table("Booked", booked, "Nothing booked yet.")}
      {table("To book", toBook, "Nothing waiting for a date.")}
      <p className="mt-4 text-xs text-muted">
        A job appears here once it is moved to Won, and leaves when it is marked Installed. Open one to see everything the installation
        needs.
      </p>
    </div>
  );
}
