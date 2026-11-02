"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SharedJobLine } from "@/lib/domain/design/job-shares";
import { answerInstallerJob, loadInstallerJobs, openInstallerJob } from "@/lib/services/job-shares";
import { PageHead, ui } from "./design-shell";
import { NominateInspector } from "./inspections";
import { InstallerJobCard } from "./job-card";

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * An installer's Jobs (domain/design/job-shares.ts): the jobs connected retailers have sent it. One waiting shows only
 * the suburb, the day and the system, with Accept and Decline; once accepted it opens its job card here, in the login.
 */
export function InstallerJobsPage() {
  const [jobs, setJobs] = useState<SharedJobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadInstallerJobs().then((res) => (res.ok ? setJobs(res.jobs) : setProblem(res.message)));
  }, []);
  const act = async (id: string, action: "accept" | "decline") => {
    const res = await answerInstallerJob(id, action);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setJobs(res.jobs);
    window.dispatchEvent(new Event("renuabl:installer-jobs"));
  };
  const waiting = jobs?.filter((j) => j.state === "sent") ?? [];
  const accepted = jobs?.filter((j) => j.state === "accepted") ?? [];
  return (
    <div className={clsx(ui.page, "space-y-6")}>
      <PageHead title="Jobs" />
      <p className="-mt-3 max-w-2xl text-sm text-ink-2">
        Installations the retailers you&apos;re connected with send you. Accept one to open its job card: the day, the address, who to call,
        the drawings and the notes and photos you share with the retailer.
      </p>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!jobs ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !jobs.length ? (
        <div className={clsx(ui.card, "max-w-2xl p-6")}>
          <p className="text-[15px] text-ink">No jobs yet.</p>
          <p className="mt-1 text-sm text-ink-2">
            When a retailer you&apos;re connected with sends you an installation, it lands here.{" "}
            <Link href="/design/connections" className={ui.link}>
              Connect with the retailers you work with
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {waiting.length > 0 && (
            <section className={clsx(ui.card, "p-5")}>
              <p className={ui.eyebrow}>Waiting for your answer</p>
              <ul className="mt-3 divide-y divide-line">
                {waiting.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Line job={j} />
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => void act(j.id, "accept")} className={clsx(ui.primary, "h-9")}>
                        <Check className="size-4" aria-hidden /> Accept
                      </button>
                      <button type="button" onClick={() => void act(j.id, "decline")} className={clsx(ui.quiet, "h-9")}>
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">The address and the customer&apos;s details open once you accept.</p>
            </section>
          )}
          <section className={clsx(ui.card, "p-5")}>
            <p className={ui.eyebrow}>Your jobs</p>
            {!accepted.length ? (
              <p className="mt-2 text-sm text-ink-2">None accepted yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {accepted.map((j) => (
                  <li key={j.id}>
                    <Link href={`/design/jobs/${encodeURIComponent(j.id)}`} className="group flex flex-wrap items-center gap-3 py-3">
                      <Line job={j} />
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-ink">
                        Job card <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Line({ job: j }: { job: SharedJobLine }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-2 py-1.5 text-center">
        <span className="text-[10px] uppercase tracking-wide text-muted">{j.installDate ? weekday(j.installDate) : "Day"}</span>
        <span className="text-[13px] font-semibold tabular-nums text-ink">{j.installDate ? dayMonth(j.installDate) : "TBC"}</span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 truncate text-[15px] font-medium text-ink">
          <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden /> {j.suburb}
        </span>
        <span className="block truncate text-xs text-muted">
          {j.system} · from {j.from}
        </span>
      </span>
    </span>
  );
}

/** One accepted job's card, inside the installer's login (the same card as their private link). */
export function InstallerJobPage({ id }: { id: string }) {
  const [open, setOpen] = useState<{ token: string; from: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void openInstallerJob(id).then((res) => (res.ok ? setOpen(res) : setProblem(res.message)));
  }, [id]);
  return (
    <div className={clsx(ui.page, "space-y-4")}>
      <Link href="/design/jobs" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Jobs
      </Link>
      {problem ? (
        <p className={clsx(ui.card, "p-6 text-sm text-ink-2")}>{problem}</p>
      ) : !open ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <InstallerJobCard token={open.token} framed />
          <NominateInspector shareId={id} />
        </>
      )}
    </div>
  );
}
