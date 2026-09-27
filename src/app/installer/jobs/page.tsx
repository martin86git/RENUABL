import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Panel, StageBadge } from "@/components/installer/bits";
import { buttonClass, cn } from "@/components/ui/primitives";
import { formatShortDate } from "@/lib/domain/format";
import { JOB_STAGES, primaryJobAction } from "@/lib/domain/job-status";
import { getWindow } from "@/lib/domain/scheduling";
import type { JobStage } from "@/lib/domain/types";
import { listJobs } from "@/lib/services/installer";

export const metadata = { title: "Jobs" };

function isStage(v: unknown): v is JobStage {
  return JOB_STAGES.some((s) => s.id === v);
}

export default async function JobsPage({ searchParams }: PageProps<"/installer/jobs">) {
  await connection();
  const { stage: raw } = await searchParams;
  const stage = isStage(raw) ? raw : undefined;
  const all = listJobs();
  const jobs = stage ? all.filter((j) => j.stage === stage) : all;
  const counts = Object.fromEntries(JOB_STAGES.map((s) => [s.id, all.filter((j) => j.stage === s.id).length]));

  const filters = [
    { id: undefined, label: "All", count: all.length },
    ...JOB_STAGES.map((s) => ({ id: s.id, label: s.label, count: counts[s.id] })),
  ];

  return (
    <>
      <PageHeader title="Jobs" subtitle={`${all.length} jobs · ${counts.new} new`} />

      <nav aria-label="Filter jobs" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {filters.map((f) => {
            const active = f.id === stage;
            return (
              <li key={f.label}>
                <Link
                  href={f.id ? `/installer/jobs?stage=${f.id}` : "/installer/jobs"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[14px] transition",
                    active ? "border-ink bg-ink font-medium text-canvas" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular-nums text-[12px]", active ? "text-canvas/70" : "text-muted")}>{f.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop table */}
      <Panel className="hidden lg:block">
        <table className="w-full text-left text-[14px]">
          <thead className="text-[12px] uppercase tracking-wider text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Suburb</th>
              <th className="px-5 py-3 font-medium">Package</th>
              <th className="px-5 py-3 font-medium">Preferred date</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-surface-2/40">
                <td className="px-5 py-4">
                  <Link href={`/installer/jobs/${j.id}`} className="font-medium hover:underline">
                    {j.customer.name}
                  </Link>
                  <p className="text-[12px] text-muted">{j.reference}</p>
                </td>
                <td className="px-5 py-4 text-ink-2">{j.address.suburb}</td>
                <td className="px-5 py-4 text-ink-2">{j.packageName}</td>
                <td className="px-5 py-4 tabular-nums text-ink-2">
                  {formatShortDate(j.preferredDate)}
                  <p className="text-[12px] text-muted">{getWindow(j.windowId)?.label}</p>
                </td>
                <td className="px-5 py-4">
                  <StageBadge stage={j.stage} />
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/installer/jobs/${j.id}`}
                    className={buttonClass(j.stage === "new" ? "primary" : "secondary", "sm", "rounded-lg")}
                  >
                    {primaryJobAction(j.stage)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="px-5 py-10 text-center text-muted">No jobs in this stage.</p>}
      </Panel>

      {/* Mobile list */}
      <ul className="space-y-2 lg:hidden">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link
              href={`/installer/jobs/${j.id}`}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[16px] font-semibold">{j.customer.name}</p>
                  <StageBadge stage={j.stage} />
                </div>
                <p className="truncate text-[13px] text-muted">
                  {j.address.suburb} · {formatShortDate(j.preferredDate)} · {j.packageName.split("·")[0].trim()}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
        {jobs.length === 0 && (
          <li className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">No jobs in this stage.</li>
        )}
      </ul>
    </>
  );
}
