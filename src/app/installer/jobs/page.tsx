import { ArrowRight, ChevronRight, EllipsisVertical } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Chip, PageHeader, StageBadge } from "@/components/installer/bits";
import { JobPhoto } from "@/components/installer/job-photo";
import { buttonClass, cn } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { JOB_STAGES, primaryJobAction } from "@/lib/domain/job-status";
import { packageLabel } from "@/lib/domain/recommendation";
import { getWindow } from "@/lib/domain/scheduling";
import type { JobStage } from "@/lib/domain/types";
import { isDemo, listJobs } from "@/lib/services/installer";

export const metadata = { title: "Jobs" };

function isStage(v: unknown): v is JobStage {
  return JOB_STAGES.some((s) => s.id === v);
}

export default async function JobsPage({ searchParams }: PageProps<"/installer/jobs">) {
  await connection();
  const { stage: raw } = await searchParams;
  const stage = isStage(raw) ? raw : undefined;
  const all = await listJobs();
  const live = !(await isDemo());
  // Work still to do first; completed jobs sink to the bottom.
  const jobs = (stage ? all.filter((j) => j.stage === stage) : all).sort(
    (a, b) => Number(a.stage === "completed") - Number(b.stage === "completed"),
  );
  const counts = Object.fromEntries(JOB_STAGES.map((s) => [s.id, all.filter((j) => j.stage === s.id).length]));
  const tabs = [
    { id: undefined, label: "All", count: all.length },
    ...JOB_STAGES.map((s) => ({ id: s.id, label: s.label, count: counts[s.id] })),
  ];

  return (
    <div className="lg:rounded-3xl lg:bg-surface/40 lg:p-7">
      <PageHeader title="My jobs" subtitle="Everything you need to keep the clean energy transition moving." />

      <nav aria-label="Filter jobs" className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-6">
          {tabs.map((t) => {
            const active = t.id === stage;
            return (
              <li key={t.label}>
                <Link
                  href={t.id ? `/installer/jobs?stage=${t.id}` : "/installer/jobs"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative block whitespace-nowrap pb-3 text-[13.5px] transition",
                    active ? "text-ink" : "text-muted hover:text-ink-2",
                  )}
                >
                  {t.label} ({t.count}){active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ul className="space-y-3">
        {jobs.map((j) => (
          <li key={j.id}>
            {/* Desktop row */}
            <div className="hidden grid-cols-[64px_minmax(0,1.6fr)_190px_170px_110px_180px_36px] items-center gap-5 rounded-2xl border border-line bg-surface px-5 py-4 lg:grid">
              <JobPhoto job={j} live={live} className="h-14 w-16 rounded-lg" sizes="64px" />
              <div className="min-w-0">
                <p className="truncate text-[15px]">{j.customer.name}</p>
                <p className="truncate text-[12.5px] text-muted">
                  {j.address.line}, {j.address.suburb} {j.address.state}
                </p>
              </div>
              <div>
                <Chip>{packageLabel(j.system)}</Chip>
              </div>
              <StageBadge stage={j.stage} />
              <p className="text-[13.5px] leading-snug text-ink-2">
                {formatDate(j.preferredDate, { weekday: "short", day: "numeric", month: "short" })}
                <br />
                <span className="text-muted">{getWindow(j.windowId)?.label}</span>
              </p>
              <Link href={`/installer/jobs/${j.id}`} className={buttonClass("primary", "md", "justify-self-end px-5")}>
                {j.stage === "scheduled" || j.stage === "in-progress" ? "View job" : primaryJobAction(j.stage)}{" "}
                <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
              </Link>
              <button
                type="button"
                aria-label={`More actions for ${j.customer.name}`}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <EllipsisVertical className="h-5 w-5" strokeWidth={1.6} />
              </button>
            </div>

            {/* Mobile card */}
            <Link
              href={`/installer/jobs/${j.id}`}
              className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-line bg-surface p-3 lg:hidden"
            >
              <JobPhoto job={j} live={live} className="h-14 w-14 shrink-0 rounded-lg" sizes="56px" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[16px]">{j.customer.name}</p>
                  <StageBadge stage={j.stage} />
                </div>
                <p className="truncate text-[13px] text-muted">
                  {j.address.suburb} · {formatDate(j.preferredDate, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                  {getWindow(j.windowId)?.label}
                </p>
                <p className="truncate text-[12px] text-ink-2">{packageLabel(j.system)}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
        {jobs.length === 0 && (
          <li className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">No jobs in this stage.</li>
        )}
      </ul>
    </div>
  );
}
