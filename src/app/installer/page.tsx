import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Clock,
  Hourglass,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Star,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Chip, Panel, StageBadge } from "@/components/installer/bits";
import { HomePhoto, Mascot, homeBannerFor, homePhotoFor } from "@/components/ui/brand-art";
import { buttonClass, cn } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatPercent } from "@/lib/domain/format";
import { greeting, todayInMarket } from "@/lib/domain/market";
import { FIELD_STATUS_FLOW, currentFieldStatus } from "@/lib/domain/job-status";
import { packageLabel, panelsToKw } from "@/lib/domain/recommendation";
import { getWindow } from "@/lib/domain/scheduling";
import type { Job } from "@/lib/domain/types";
import { getAlerts, getCurrentUser, getDashboardCounts, getPerformance, listTodaysJobs } from "@/lib/services/installer";

export const metadata = { title: "Dashboard" };

function fieldStatusLabel(job: Job) {
  const s = currentFieldStatus(job.statusHistory);
  return s ? FIELD_STATUS_FLOW.find((f) => f.id === s)!.label : "Not started";
}

const tel = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
const maps = (job: Job) =>
  `https://maps.google.com/?q=${encodeURIComponent(`${job.address.line}, ${job.address.suburb} ${job.address.state}`)}`;

function StatCard({
  icon: Icon,
  value,
  label,
  star = false,
}: {
  icon: typeof CalendarCheck;
  value: string | number;
  label: string;
  star?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      {star ? (
        <p className="flex items-center gap-3 text-[28px] font-normal tracking-tight">
          <Star className="h-6 w-6 fill-[#e8a93a] text-[#e8a93a]" strokeWidth={0} aria-hidden /> {value}
        </p>
      ) : (
        <>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f7f6f2] text-forest">
            <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </span>
          <p className="mt-3 text-[28px] font-normal leading-none tracking-tight tabular-nums">{value}</p>
        </>
      )}
      <p className="mt-1.5 text-[13px] text-ink-2">{label}</p>
    </div>
  );
}

function InstallRow({ job }: { job: Job }) {
  return (
    <li>
      <Link
        href={`/installer/jobs/${job.id}`}
        className="grid grid-cols-[minmax(0,1.3fr)_auto_minmax(0,0.8fr)_auto_auto] items-center gap-4 rounded-xl border border-line border-l-2 border-l-leaf/70 bg-surface-2/40 px-5 py-4 hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] text-ink">{job.customer.name}</span>
          <span className="block truncate text-[13px] text-muted">
            {job.address.suburb} {job.address.state}
          </span>
        </span>
        <Chip>{packageLabel(job.system)}</Chip>
        <span className="flex items-center gap-2 text-[14px] text-ink-2">
          <Clock className="h-4 w-4 text-muted" strokeWidth={1.6} aria-hidden /> {getWindow(job.windowId)?.label}
        </span>
        <StageBadge stage={job.stage} />
        <ArrowRight className="h-4 w-4 text-muted" strokeWidth={1.6} aria-hidden />
      </Link>
    </li>
  );
}

/** The design's light "Next job" card, sitting on the dark dashboard. */
function NextJob({ job }: { job: Job }) {
  return (
    <section className="theme-light rounded-2xl bg-canvas p-6 text-ink">
      <h2 className="text-[17px]">Next job</h2>
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-6">
        <HomePhoto src={homePhotoFor(job.id)} className="h-32 w-32 rounded-xl" sizes="128px" />
        <div className="min-w-0">
          <p className="text-[16px]">{job.customer.name}</p>
          <p className="text-[13px] text-muted">
            {job.address.line}, {job.address.suburb} {job.address.state}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip className="bg-sage text-forest">{packageLabel(job.system)}</Chip>
            <Chip className="bg-surface ring-1 ring-line">{panelsToKw(job.system.panelCount)} kW</Chip>
            {job.system.batteryKwh > 0 && <Chip className="bg-surface ring-1 ring-line">{job.system.batteryKwh} kWh</Chip>}
          </div>
          <Link
            href={`/installer/jobs/${job.id}`}
            className="mt-4 inline-flex items-center gap-2 text-[14px] text-positive hover:underline"
          >
            Install pack <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        </div>
        <div className="border-l border-line pl-6">
          <p className="text-[13px] text-ink">Site access notes</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{job.site.accessNotes}</p>
          <p className="mt-3 text-[12px] text-muted">
            {formatDate(job.preferredDate, { weekday: "short", day: "numeric", month: "short" })} · arrive {getWindow(job.windowId)?.label}
          </p>
        </div>
        <div className="border-l border-line pl-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-ink">Contact</p>
              <p className="mt-1 text-[13px] text-muted">{job.customer.name}</p>
              <p className="text-[13px] text-muted">{job.customer.phone}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={tel(job.customer.phone)}
                aria-label={`Call ${job.customer.name}`}
                className="grid h-11 w-11 place-items-center rounded-xl bg-surface shadow-[var(--shadow-soft)]"
              >
                <Phone className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </a>
              <a
                href={`mailto:${job.customer.email}`}
                aria-label={`Email ${job.customer.name}`}
                className="grid h-11 w-11 place-items-center rounded-xl bg-surface shadow-[var(--shadow-soft)]"
              >
                <Mail className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </a>
            </div>
          </div>
          <Link href={`/installer/jobs/${job.id}`} className={buttonClass("secondary", "md", "mt-4 w-full border-line")}>
            View details <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Field app "Today": next job first, big tap targets. */
function MobileToday({ jobs, firstName }: { jobs: Job[]; firstName: string }) {
  const [next, ...rest] = jobs;
  return (
    <div className="space-y-5 lg:hidden">
      <div>
        <p className="text-[13px] text-muted">{formatDate(todayInMarket())}</p>
        <h1 className="text-[28px] font-normal tracking-[-0.03em]">
          {greeting()}, {firstName}.
        </h1>
      </div>
      {next ? (
        <section className="theme-light overflow-hidden rounded-2xl bg-canvas text-ink">
          <HomePhoto src={homeBannerFor(next.id)} className="h-36 w-full" sizes="100vw" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] text-muted">Next job · arrive {getWindow(next.windowId)?.label}</p>
                <p className="text-[20px]">{next.customer.name}</p>
                <p className="flex items-center gap-1.5 text-[14px] text-ink-2">
                  <MapPin className="h-4 w-4 text-muted" strokeWidth={1.6} /> {next.address.line}, {next.address.suburb}
                </p>
              </div>
              <StageBadge stage={next.stage} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip className="bg-sage text-forest">{packageLabel(next.system)}</Chip>
              <Chip className="bg-surface ring-1 ring-line">{fieldStatusLabel(next)}</Chip>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_1fr_1.5fr] gap-2">
              <a
                href={tel(next.customer.phone)}
                aria-label={`Call ${next.customer.name}`}
                className={buttonClass("secondary", "lg", "min-w-0 rounded-xl px-0")}
              >
                <Phone className="h-5 w-5 shrink-0" strokeWidth={1.6} />
              </a>
              <a
                href={maps(next)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open route"
                className={buttonClass("secondary", "lg", "min-w-0 rounded-xl px-0")}
              >
                <Navigation className="h-5 w-5 shrink-0" strokeWidth={1.6} />
              </a>
              <Link href={`/installer/jobs/${next.id}`} className={buttonClass("primary", "lg", "min-w-0 rounded-xl px-0")}>
                Site pack <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-[15px] text-muted">No jobs today.</p>
      )}
      {rest.length > 0 && (
        <div className="space-y-2">
          <p className="text-[13px] text-muted">Later today</p>
          {rest.map((j) => (
            <Link
              key={j.id}
              href={`/installer/jobs/${j.id}`}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <HomePhoto src={homePhotoFor(j.id)} className="h-12 w-12 shrink-0 rounded-lg" sizes="48px" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px]">{j.customer.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {j.address.suburb} · {getWindow(j.windowId)?.label} · {fieldStatusLabel(j)}
                </span>
              </span>
              <ArrowRight className="h-5 w-5 text-muted" strokeWidth={1.6} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function InstallerDashboard() {
  await connection(); // mock data and greeting are relative to "today"
  const user = getCurrentUser();
  const counts = getDashboardCounts();
  const today = listTodaysJobs();
  const alerts = getAlerts();
  const perf = getPerformance();
  const next = today.find((j) => j.stage === "scheduled") ?? today[0];

  return (
    <>
      <MobileToday jobs={today} firstName={user.firstName} />

      <div className="hidden space-y-6 rounded-3xl bg-surface/40 p-7 lg:block">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-normal leading-tight tracking-[-0.03em]">
              {greeting()}, {user.firstName}.
            </h1>
            <p className="text-[22px] font-light tracking-[-0.02em] text-ink-2">Here&apos;s what&apos;s happening today.</p>
          </div>
          <p className="flex items-center gap-2.5 rounded-xl border border-line px-4 py-2.5 text-[13px] text-ink-2">
            <CalendarDays className="h-4 w-4" strokeWidth={1.6} />
            {formatDate(todayInMarket(), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={CalendarCheck} value={counts.upcoming} label="Upcoming installs" />
          <StatCard icon={Hourglass} value={counts.awaitingConfirmation} label="Awaiting confirmation" />
          <StatCard icon={CircleCheck} value={counts.completedThisMonth} label="Completed this month" />
          <StatCard icon={Star} value={counts.rating.toFixed(1)} label="Average rating" star />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <Panel
            className="col-span-8"
            title="Today's installs"
            action={
              <Link href="/installer/schedule" className="text-[13px] text-ink-2 hover:text-ink">
                View all →
              </Link>
            }
          >
            <ul className="space-y-3 p-5">
              {today.map((j) => (
                <InstallRow key={j.id} job={j} />
              ))}
              {today.length === 0 && <li className="py-6 text-center text-muted">No installs today.</li>}
            </ul>
          </Panel>
          <section className="col-span-4 overflow-hidden rounded-2xl border border-line bg-surface">
            <Mascot pose="dark" className="h-auto w-40" />
            <div className="px-6 pb-6">
              <p className="text-[20px] leading-snug">Everything you need. Less admin. A better way to work.</p>
              <ul className="mt-4 space-y-2.5 text-[14px] text-ink-2">
                {["Quality pre-vetted leads", "Clear job details", "Real-time updates", "Fast payments"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <CircleCheck className="h-[18px] w-[18px] fill-leaf text-surface" strokeWidth={2} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {next && <NextJob job={next} />}

        <div className="grid grid-cols-12 gap-6">
          <Panel className="col-span-7" title="Needs action">
            <ul className="divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/installer/jobs/${a.jobId}`} className="flex gap-3 px-5 py-3.5 hover:bg-surface-2/50">
                    <TriangleAlert
                      className={cn("mt-0.5 h-4 w-4 shrink-0", a.severity === "warning" ? "text-warning" : "text-ink-2")}
                      strokeWidth={1.6}
                      aria-hidden
                    />
                    <span>
                      <span className="block text-[14px]">{a.title}</span>
                      <span className="block text-[12px] text-muted">{a.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            className="col-span-5"
            title="Performance snapshot"
            action={
              <Link href="/installer/performance" className="text-[13px] text-ink-2 hover:text-ink">
                Details →
              </Link>
            }
          >
            <dl className="grid grid-cols-2 gap-4 p-5 text-[13px]">
              <div>
                <dt className="text-muted">On time</dt>
                <dd className="text-[22px] text-positive">{formatPercent(perf.onTimeRate)}</dd>
              </div>
              <div>
                <dt className="text-muted">First-time pass</dt>
                <dd className="text-[22px] text-positive">{formatPercent(perf.firstTimePassRate)}</dd>
              </div>
              <div>
                <dt className="text-muted">Response time</dt>
                <dd className="text-[22px]">{perf.medianResponseHours}h</dd>
              </div>
              <div>
                <dt className="text-muted">Payouts this month</dt>
                <dd className="text-[22px]">{formatCurrency(perf.payoutsThisMonth)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
