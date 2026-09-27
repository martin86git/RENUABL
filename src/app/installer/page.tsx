import { ArrowRight, ClipboardList, MapPin, Navigation, Phone, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Metric, PageHeader, Panel, StageBadge } from "@/components/installer/bits";
import { buttonClass, cn } from "@/components/ui/primitives";
import { formatCurrency, formatPercent, formatShortDate } from "@/lib/domain/format";
import { FIELD_STATUS_FLOW, currentFieldStatus } from "@/lib/domain/job-status";
import { getWindow } from "@/lib/domain/scheduling";
import type { Job } from "@/lib/domain/types";
import { getAlerts, getDashboardCounts, getPerformance, listCrews, listJobs, listTodaysJobs } from "@/lib/services/installer";

export const metadata = { title: "Dashboard" };

function fieldStatusLabel(job: Job) {
  const s = currentFieldStatus(job.statusHistory);
  return s ? FIELD_STATUS_FLOW.find((f) => f.id === s)!.label : "Not started";
}

function NextJobCard({ job }: { job: Job }) {
  const window = getWindow(job.windowId);
  const crew = listCrews().find((c) => c.id === job.crewId);
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(`${job.address.line}, ${job.address.suburb} ${job.address.state}`)}`;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">
            {job.reference} · arrive {window?.label}
          </p>
          <p className="mt-1 text-[20px] font-semibold">{job.customer.name}</p>
          <p className="flex items-center gap-1.5 text-[15px] text-ink-2">
            <MapPin className="h-4 w-4 text-muted" aria-hidden /> {job.address.line}, {job.address.suburb}
          </p>
        </div>
        <StageBadge stage={job.stage} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-[12px] text-muted">System</p>
          <p className="font-medium">{job.packageName.split("·")[1]?.trim() ?? job.packageName}</p>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-[12px] text-muted">Status</p>
          <p className="font-medium">{fieldStatusLabel(job)}</p>
        </div>
      </div>
      {crew && (
        <p className="mt-3 text-[13px] text-muted">
          {crew.name} · {crew.lead}
        </p>
      )}
      <div className="mt-4 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
        <a
          href={`tel:${job.customer.phone.replace(/\s/g, "")}`}
          className={buttonClass("secondary", "lg", "min-w-0 rounded-xl px-0")}
          aria-label={`Call ${job.customer.name}`}
        >
          <Phone className="h-5 w-5 shrink-0" /> <span className="hidden sm:inline lg:hidden">Call</span>
        </a>
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className={buttonClass("secondary", "lg", "min-w-0 rounded-xl px-0")}
          aria-label="Open route"
        >
          <Navigation className="h-5 w-5 shrink-0" /> <span className="hidden sm:inline lg:hidden">Route</span>
        </a>
        <Link href={`/installer/jobs/${job.id}`} className={buttonClass("primary", "lg", "min-w-0 rounded-xl px-0")}>
          <ClipboardList className="h-5 w-5 shrink-0" /> <span className="whitespace-nowrap">Site pack</span>
        </Link>
      </div>
    </div>
  );
}

function MobileToday({ jobs }: { jobs: Job[] }) {
  const [next, ...rest] = jobs;
  return (
    <div className="space-y-5 lg:hidden">
      <div>
        <p className="text-[14px] text-muted">
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-[26px] font-semibold tracking-tight">Today</h1>
      </div>
      {next ? (
        <>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Next job</p>
          <NextJobCard job={next} />
        </>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-[15px] text-muted">No jobs today.</p>
      )}
      {rest.length > 0 && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Later today</p>
          {rest.map((j) => (
            <Link
              key={j.id}
              href={`/installer/jobs/${j.id}`}
              className="flex min-h-16 items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <span>
                <span className="block text-[16px] font-medium">{j.customer.name}</span>
                <span className="block text-[13px] text-muted">
                  {j.address.suburb} · {getWindow(j.windowId)?.label} · {fieldStatusLabel(j)}
                </span>
              </span>
              <ArrowRight className="h-5 w-5 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function InstallerDashboard() {
  await connection(); // mock data is relative to "today"
  const counts = getDashboardCounts();
  const today = listTodaysJobs();
  const alerts = getAlerts();
  const perf = getPerformance();
  const todayIds = new Set(today.map((j) => j.id));
  const upcoming = listJobs("scheduled")
    .filter((j) => !todayIds.has(j.id))
    .slice(0, 4);

  return (
    <>
      <MobileToday jobs={today} />

      <div className="hidden lg:block">
        <PageHeader title="Good morning, Sam" subtitle={`${today.length} jobs on today · ${alerts.length} items need your attention`} />

        <div className="grid grid-cols-5 gap-4">
          <Metric label="New jobs" value={counts.newJobs} detail="Waiting for acceptance" />
          <Metric label="Upcoming installs" value={counts.upcoming} detail="Scheduled & confirmed" />
          <Metric label="Awaiting action" value={counts.awaitingAction} detail="Approvals, crews, reviews" />
          <Metric
            label="Completed this month"
            value={counts.completedThisMonth}
            detail={`+${perf.jobsCompletedThisMonth - perf.jobsCompletedLastMonth} vs last month`}
            positive
          />
          <Metric label="Customer rating" value={counts.rating.toFixed(1)} detail="Last 90 days" positive />
        </div>

        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-6">
            <Panel
              title="Today's installs"
              action={
                <Link href="/installer/schedule" className="text-[13px] text-muted hover:text-ink">
                  Schedule →
                </Link>
              }
            >
              <ul className="divide-y divide-line">
                {today.map((j) => (
                  <li key={j.id}>
                    <Link href={`/installer/jobs/${j.id}`} className="grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-surface-2/50">
                      <span className="col-span-2 text-[14px] font-medium tabular-nums">{getWindow(j.windowId)?.label}</span>
                      <span className="col-span-3">
                        <span className="block text-[15px] font-medium">{j.customer.name}</span>
                        <span className="block text-[13px] text-muted">
                          {j.address.line}, {j.address.suburb}
                        </span>
                      </span>
                      <span className="col-span-3 text-[13px] text-ink-2">{j.packageName}</span>
                      <span className="col-span-2 text-[13px] text-muted">{fieldStatusLabel(j)}</span>
                      <span className="col-span-2 text-right">
                        <StageBadge stage={j.stage} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Coming up">
              <ul className="divide-y divide-line">
                {upcoming.map((j) => (
                  <li key={j.id}>
                    <Link href={`/installer/jobs/${j.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/50">
                      <span className="text-[14px]">
                        <span className="font-medium">{formatShortDate(j.preferredDate)}</span>{" "}
                        <span className="text-muted">
                          · {j.customer.name}, {j.address.suburb}
                        </span>
                      </span>
                      <span className="text-[13px] text-muted">{j.packageName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="col-span-4 space-y-6">
            {today[0] && (
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Next job</p>
                <NextJobCard job={today[0]} />
              </div>
            )}

            <Panel title="Needs action">
              <ul className="divide-y divide-line">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/installer/jobs/${a.jobId}`} className="flex gap-3 px-5 py-3.5 hover:bg-surface-2/50">
                      <TriangleAlert
                        className={cn("mt-0.5 h-4 w-4 shrink-0", a.severity === "warning" ? "text-warning" : "text-info")}
                        aria-hidden
                      />
                      <span>
                        <span className="block text-[14px] font-medium">{a.title}</span>
                        <span className="block text-[12px] text-muted">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="Performance snapshot"
              action={
                <Link href="/installer/performance" className="text-[13px] text-muted hover:text-ink">
                  Details →
                </Link>
              }
            >
              <dl className="grid grid-cols-2 gap-4 p-5 text-[14px]">
                <div>
                  <dt className="text-muted">On time</dt>
                  <dd className="text-[20px] font-semibold text-positive">{formatPercent(perf.onTimeRate)}</dd>
                </div>
                <div>
                  <dt className="text-muted">First-time pass</dt>
                  <dd className="text-[20px] font-semibold text-positive">{formatPercent(perf.firstTimePassRate)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Response time</dt>
                  <dd className="text-[20px] font-semibold">{perf.medianResponseHours}h</dd>
                </div>
                <div>
                  <dt className="text-muted">Payouts this month</dt>
                  <dd className="text-[20px] font-semibold">{formatCurrency(perf.payoutsThisMonth)}</dd>
                </div>
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
