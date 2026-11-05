"use client";

import { cleanKind } from "@/lib/domain/design/business-kind";
import { KindToday } from "./kind-home";
import { MyJobsPage } from "./my-jobs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { STAGE_LABELS, WON_STAGES, type JobStage } from "@/lib/domain/design/crm";
import { OVERVIEW_VIEWS, PIPELINES, VIEW_PIPELINE, dashboard, inTheWorks, power, type OverviewView } from "@/lib/domain/design/deal";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import { journey, type JourneyStop } from "@/lib/domain/design/journey";
import { dayCleared, dayList, orderDueSoon, sunNow, sunTimes, type DayCounts, type DayItem } from "@/lib/domain/design/today";
import { dueFollowUp } from "@/lib/domain/design/proposal-lists";
import { listOrders, listProposals } from "@/lib/services/after-sale";
import { loadUnreadCount } from "@/lib/services/chat";
import type { ISODate } from "@/lib/domain/types";
import {
  dollars,
  listJobs,
  loadOverview,
  loadTargets,
  notificationCount,
  serviceCount,
  shortDate,
  type JobLine,
  type Overview,
} from "@/lib/services/crm";
import { NO_TARGETS, monthPace, monthRings, monthlyHistory, pipelineByStage, type SalesTargets } from "@/lib/domain/design/sales-rings";
import { GoalLine, MonthCard, MonthBars, Tally, PipelineBar, SunArc } from "./gauges";
import { newDealPanels } from "@/lib/domain/design/gauges";
import { useDesignAccount } from "./design-account";
import { DesignShell, PATHS, PageHead, ui } from "./design-shell";
import { SalesPage } from "./sales-page";
import { CompletedInstallsView, UpcomingInstallsView } from "./install-lists";
import { TodayPad } from "./today-pad";

/** A stage as a small tag. Won and installed are the good news; lost is quiet. */
export function StageTag({ stage }: { stage: JobStage }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center whitespace-nowrap rounded px-2 text-[11px] font-medium uppercase tracking-[0.08em]",
        WON_STAGES.includes(stage)
          ? "bg-positive-soft text-positive"
          : stage === "lost"
            ? "bg-surface-2 text-muted"
            : stage === "proposal"
              ? "bg-sun text-sun-ink"
              : "bg-surface-2 text-ink-2",
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

/** What someone did, in a word. */
export const ACTIVITY_WORD = {
  note: "Note",
  call: "Call",
  email: "Email",
  stage: "Stage",
  proposal: "Proposal",
  message: "Message",
  order: "Order",
  invoice: "Invoice",
  reminder: "Reminder",
  service: "Service",
} as const;

/**
 * /design. Signed out, the product's front page: what it is, and the way in
 * (a one-time link by email, the same whether it is someone's first time or
 * not). Signed in, the business's overview inside the app's frame.
 */
export function DesignHome() {
  const [account] = useDesignAccount();
  if (!account) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  if (account.signedIn) {
    // An installer's or inspector's Today is their own (business-kind.ts): no CRM to read.
    const kind = cleanKind(account.business?.kind);
    return (
      <DesignShell needsAccount>
        {kind === "retailer" ? (
          <OverviewPage
            business={account.business?.name ?? ""}
            email={account.email}
            firstName={account.firstName ?? null}
            welcome={Boolean(account.welcome)}
            owner={account.business?.role === "owner"}
          />
        ) : kind === "installer" ? (
          // An installer's home is My Jobs (my-jobs.ts, 2 Nov 2026, Martin).
          <MyJobsPage />
        ) : (
          <KindToday kind={kind} business={account.business?.name ?? ""} />
        )}
      </DesignShell>
    );
  }
  return <FrontPage unreachable={Boolean(account.unreachable)} />;
}

/**
 * The page for a visitor who isn't signed in: the sign-up page that sells RENUABL (`SalesPage`; Martin, 1 Nov 2026).
 * Signing in is in its top bar, and on /design/sign-in.
 */
function FrontPage({ unreachable }: { unreachable: boolean }) {
  return <SalesPage notice={unreachable ? "We couldn't reach your account just now. Try again in a moment." : null} />;
}

/** A change against an earlier period, as a small signed percentage: green up, red down, quiet when there is nothing to compare. */
function Delta({ value, against, nothing, dark }: { value: number | null; against: string; nothing: string; dark?: boolean }) {
  if (value === null)
    return (
      <span className={clsx("text-xs", dark ? "text-white/45" : "text-muted")}>
        {nothing} {against} to compare
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={clsx(
          "rounded px-1.5 py-0.5 font-medium tabular-nums",
          value > 0
            ? "bg-positive-soft text-positive"
            : value < 0
              ? "bg-warning-soft text-danger"
              : dark
                ? "bg-white/10 text-white"
                : "bg-surface-2 text-ink-2",
        )}
      >
        {value > 0 ? "+" : value < 0 ? "−" : ""}
        {Math.abs(value)}%
      </span>
      <span className={dark ? "text-white/60" : "text-muted"}>{against}</span>
    </span>
  );
}

/**
 * The business at a glance, three ways, chosen at the top: **Sales** (what
 * has been sold this financial year and this month, new deals, conversion,
 * kilowatts, what is still being sold), **Upcoming installs** (what is sold
 * and waiting to go on a roof: this week, to book, overdue, to order) and
 * **Completed installs** (what has gone on a roof, and the paperwork after
 * it). Each shows its own figures, its own pipeline and its own list. Until
 * one is picked it opens on a greeting with a line for each. Every figure is
 * worked out from the deals as they stand (`deal.ts`).
 */
function OverviewPage({
  business,
  email,
  firstName,
  welcome,
  owner,
}: {
  business: string;
  email: string;
  firstName: string | null;
  welcome: boolean;
  owner: boolean;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState<number | null>(null);
  // The view picked is in the address (?view=sales), so Overview in the nav (plain /design) always comes back to the greeting.
  const router = useRouter();
  const asked = useSearchParams().get("view");
  const view = OVERVIEW_VIEWS.find((v) => v.id === asked)?.id ?? null;
  const setView = (next: OverviewView | null) => router.push(next ? `${PATHS.home}?view=${next}` : PATHS.home, { scroll: false });
  useEffect(() => {
    let gone = false;
    void loadOverview().then((res) => {
      if (gone) return;
      if (res.ok) setData(res);
      else setProblem(res.message);
    });
    void listJobs().then((res) => {
      if (!gone && res.ok) setJobs(res.jobs);
    });
    void serviceCount().then((res) => {
      if (!gone) setServiceOpen(res.ok ? res.open : 0);
    });
    return () => {
      gone = true;
    };
  }, []);

  const today = todayInMarket();
  // The name they gave in About you (profile.ts), never one guessed from their email.
  const name = firstName;
  /** A job changed from one of the lists (its installer or its paperwork), put back in place. */
  const changed = (job: JobLine) => setJobs((all) => (all ?? []).map((j) => (j.id === job.id ? job : j)));

  if (view !== null) {
    const label = OVERVIEW_VIEWS.find((v) => v.id === view)?.label ?? "";
    return (
      <div className={ui.page}>
        <Link href={PATHS.home} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> Overview
        </Link>
        <div className="mt-3">
          <PageHead eyebrow={business || "Your business"} title={label} />
        </div>
        {/* The other closer looks, a press away. */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {OVERVIEW_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-current={view === v.id ? "page" : undefined}
              onClick={() => setView(v.id)}
              className={clsx(
                "tap-area font-medium",
                view === v.id ? "text-ink underline underline-offset-[6px]" : "text-ink-2 hover:text-ink",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {problem && (
          <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
            {problem}
          </p>
        )}
        {view === "sales" && <SalesView jobs={jobs} data={data} today={today} />}
        {view === "upcoming" && <UpcomingInstallsView jobs={jobs} today={today} onJob={changed} />}
        {view === "completed" && <CompletedInstallsView jobs={jobs} today={today} onJob={changed} />}
      </div>
    );
  }

  return (
    <TodayPad
      jobs={jobs}
      today={today}
      business={business}
      name={name}
      email={email}
      welcome={welcome}
      owner={owner}
      mine={data?.mine ?? (problem ? [] : null)}
      problem={problem}
      day={
        <div className="space-y-6">
          <YourDay jobs={jobs} today={today} serviceOpen={serviceOpen} />
          <JourneyLine jobs={jobs} serviceOpen={serviceOpen} />
        </div>
      }
    />
  );
}

const JOURNEY_PATHS: Record<JourneyStop, string> = {
  enquiries: PATHS.pipelines,
  design: PATHS.pipelines,
  sale: PATHS.proposalsSent,
  approvals: PATHS.installations,
  procure: PATHS.orders,
  install: PATHS.scheduler,
  after: PATHS.underway,
  running: PATHS.completed,
  service: PATHS.service,
};

/** The journey's three parts, over the stops they hold. */
const PHASES = [
  { name: "Win the work", stops: 3 },
  { name: "Deliver it", stops: 4 },
  { name: "Look after it", stops: 2 },
];
const PHASE_STARTS = PHASES.flatMap((p) => Array.from({ length: p.stops }, (_, i) => (i === 0 ? p.name : null)));

/**
 * The business as one line (25 Oct 2026, Martin: RENUABL is the end to end tool, and the overview should show that
 * simply): every stop from an enquiry to a system running and looked after, how many jobs are at each, lit where there
 * are some, each a way to where that work is done. Across the page on a wide screen, down it on a phone.
 */
function JourneyLine({ jobs, serviceOpen }: { jobs: JobLine[] | null; serviceOpen: number | null }) {
  const stops = journey(jobs ?? [], serviceOpen ?? 0, JOURNEY_PATHS);
  const ready = jobs !== null && serviceOpen !== null;
  return (
    <section className="mt-12" aria-labelledby="journey">
      <h2 id="journey" className="sr-only">
        Every job, from enquiry to service
      </h2>
      {/* The three parts, over their stops (wide screens). */}
      <div className="hidden grid-cols-9 gap-x-2 lg:grid" aria-hidden>
        {PHASES.map((p, i) => (
          <div
            key={p.name}
            style={{ gridColumn: `${PHASES.slice(0, i).reduce((n, q) => n + q.stops, 0) + 1} / span ${p.stops}` }}
            className="border-b border-line pb-2"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{p.name}</span>
          </div>
        ))}
      </div>
      <ol className="lg:mt-6 lg:grid lg:grid-cols-9 lg:gap-x-2">
        {stops.map((s, i) => {
          const lit = ready && s.count > 0;
          return (
            <li key={s.stop} className="relative">
              {PHASE_STARTS[i] && (
                <p className="mb-1 mt-6 pl-9 text-[11px] font-medium uppercase tracking-[0.14em] text-muted lg:hidden">{PHASE_STARTS[i]}</p>
              )}
              <Link
                href={s.href}
                className="group relative flex items-center gap-4 rounded-md py-2.5 lg:flex-col lg:gap-0 lg:px-1 lg:py-0 lg:text-center"
              >
                {/* The line through the stops: down the page on a phone, across it on a wide screen. */}
                <span
                  aria-hidden
                  className="absolute left-[9px] w-px bg-line-strong lg:hidden"
                  style={{ top: i === 0 ? "50%" : 0, bottom: i === stops.length - 1 ? "50%" : 0 }}
                />
                <span
                  aria-hidden
                  className="absolute top-[3.6rem] hidden h-px bg-line-strong lg:block"
                  style={{ left: i === 0 ? "50%" : "-0.25rem", right: i === stops.length - 1 ? "50%" : "-0.25rem" }}
                />
                <span
                  className={clsx(
                    "order-3 ml-auto text-[22px] font-light leading-none tabular-nums lg:order-none lg:ml-0 lg:flex lg:h-8 lg:items-end lg:text-[30px]",
                    lit ? "text-ink" : "text-muted",
                  )}
                >
                  {ready ? s.count : "–"}
                </span>
                <span
                  aria-hidden
                  className={clsx(
                    "relative z-10 grid size-[19px] shrink-0 place-items-center rounded-full lg:mt-4",
                    lit ? "bg-[#ffb347] shadow-[0_0_10px_2px_rgb(255_138_61_/_0.5)]" : "border border-line-strong bg-canvas",
                  )}
                >
                  {lit && <span className="size-[7px] rounded-full bg-[#fff4e0]" />}
                </span>
                <span className="min-w-0 lg:mt-3">
                  <span className="block text-[14px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                    {s.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">
                    {s.stop === "running" ? "Monitoring coming soon" : s.what}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const DAY_PATHS: Record<keyof DayCounts, string> = {
  installsToday: PATHS.scheduler,
  followUpsDue: PATHS.proposalsSent,
  messages: PATHS.messages,
  mentions: PATHS.notifications,
  ordersToPlace: PATHS.orders,
  needDate: PATHS.installations,
  serviceOpen: PATHS.service,
};

const clock = (d: Date) =>
  d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: LAUNCH_MARKET.timeZone }).replace(/\s/g, " ");

/**
 * The day (24 Oct 2026, Martin: the sun tracker showing what needs doing today): the sun on its arc from today's sunrise
 * to sunset in the market, where it is now, and under it one hairline for how much of the day's list is clear, set
 * against the sun's line (clear ahead of the sun is a good day). Then the list itself, each thing waiting lit, each
 * clear thing a quiet tick, each a way to go and do it.
 */
function YourDay({ jobs, today, serviceOpen }: { jobs: JobLine[] | null; today: ISODate; serviceOpen: number | null }) {
  const [now, setNow] = useState(() => new Date());
  const [counts, setCounts] = useState<Omit<DayCounts, "installsToday" | "needDate" | "serviceOpen"> | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    let gone = false;
    void Promise.all([listProposals(), listOrders(), loadUnreadCount(), notificationCount()]).then(
      ([proposals, orders, messages, mentions]) => {
        if (gone) return;
        const at = new Date();
        setCounts({
          followUpsDue: proposals.ok
            ? proposals.proposals.filter(
                (p) =>
                  p.state === "live" &&
                  dueFollowUp({ sentAt: p.publishedAt, now: at, done: p.followUps.map((f) => f.day), lastWord: p.lastWord }),
              ).length
            : 0,
          ordersToPlace: orders.ok ? orders.orders.filter((o) => orderDueSoon(o.status, o.installDate, today)).length : 0,
          messages: messages.ok ? messages.unread : 0,
          mentions: mentions.ok ? mentions.unread : 0,
        });
      },
    );
    return () => {
      gone = true;
    };
  }, [today]);

  const sun = sunTimes(today, LAUNCH_MARKET.capitalPlace.lat, LAUNCH_MARKET.capitalPlace.lng);
  const where = sun ? sunNow(now, sun) : null;
  const items =
    counts && jobs && serviceOpen !== null
      ? dayList(
          {
            ...counts,
            serviceOpen,
            installsToday: jobs.filter((j) => j.installDate === today && j.stage !== "lost").length,
            needDate: inTheWorks(jobs).filter((j) => !j.installDate).length,
          },
          DAY_PATHS,
        )
      : null;
  const clear = items ? dayCleared(items) : null;
  const ahead = clear && where ? clear.share >= where.share : null;

  return (
    <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="rounded-xl bg-primary p-6 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Today</p>
          <p className="text-[13px] tabular-nums text-white/70">{clock(now)}</p>
        </div>
        <div className="mt-5">
          {sun && where ? (
            <SunArc now={where.share} start={`Sunrise ${clock(sun.rise)}`} end={`Sunset ${clock(sun.set)}`} />
          ) : (
            <div className="h-14" />
          )}
        </div>
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-white/70">Today&apos;s list</p>
            <p className="text-[26px] font-light leading-none tabular-nums text-[#ffb347]">
              {clear ? `${clear.cleared}/${clear.of}` : "–"}
              <span className="ml-1.5 text-[12px] text-white/50">clear</span>
            </p>
          </div>
          <div className="mt-2">
            <GoalLine
              share={clear?.share ?? 0}
              now={where?.share ?? null}
              label={clear ? `${clear.cleared} of ${clear.of} clear` : undefined}
            />
          </div>
          <p className="mt-2 text-[12px] text-white/50">
            {!clear || !where
              ? "Working out the day…"
              : clear.cleared === clear.of
                ? "Everything's clear. Nothing is waiting on you."
                : where.phase === "set"
                  ? `The sun has set. ${clear.of - clear.cleared} still to clear.`
                  : ahead
                    ? "Ahead of the sun."
                    : `${clear.of - clear.cleared} to clear before the sun sets.`}
          </p>
        </div>
      </div>

      <ul className={clsx(ui.card, "divide-y divide-line p-1")} aria-label="What needs doing today">
        {(items ?? Array.from({ length: 7 }, () => null as DayItem | null)).map((item, i) =>
          item ? (
            <li key={item.key}>
              <Link href={item.href} className="group flex items-center gap-3 rounded-md px-4 py-2.5 hover:bg-surface-2">
                <DayMark item={item} />
                <span className={clsx("flex-1 text-[13.5px]", item.count ? "text-ink" : "text-ink-2")}>{item.label}</span>
                <ArrowRight className="size-3.5 text-muted opacity-0 group-hover:opacity-100" aria-hidden />
              </Link>
            </li>
          ) : (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="size-[18px] rounded-full border border-line" />
              <span className="h-3 w-40 rounded bg-surface-2" />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** Something waiting: a small glowing sun with its count. Clear: a quiet tick in a fine ring. Today's installs: the day's work, lit. */
function DayMark({ item }: { item: DayItem }) {
  if (!item.count)
    return (
      <span className="grid size-[18px] place-items-center rounded-full border border-line-strong text-muted" aria-hidden>
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  return (
    <span
      className="grid size-[18px] place-items-center rounded-full bg-[#ffb347] text-[10px] font-semibold tabular-nums text-[#3a1d00] shadow-[0_0_8px_1px_rgb(255_138_61_/_0.45)]"
      aria-hidden
    >
      {item.count > 9 ? "9+" : item.count}
    </span>
  );
}

type ViewProps = { jobs: JobLine[] | null; data: Overview | null; today: ISODate };

/** The stages of one pipeline with how many deals are at each. */
function PipelineCard({ id, data }: { id: string; data: Overview | null }) {
  const p = PIPELINES.find((x) => x.id === id) ?? PIPELINES[0];
  return (
    <section className="mt-8" aria-labelledby={`pipe-${p.id}`}>
      <div className="flex items-baseline justify-between">
        <h2 id={`pipe-${p.id}`} className="text-[15px] font-medium tracking-tight text-ink">
          {p.name}
        </h2>
        <Link href={PATHS.sales} className={clsx(ui.link, "text-[13px]")}>
          Open pipelines <ArrowRight className="inline size-3.5" aria-hidden />
        </Link>
      </div>
      <ol className={clsx(ui.card, "mt-3 flex flex-wrap gap-x-2 gap-y-3 p-4")}>
        {p.stages.map((stage, i) => (
          <li key={stage} className="flex min-w-[7.5rem] flex-1 items-center gap-2">
            <div className="min-w-0 flex-1 rounded-md bg-surface-2 px-3 py-2.5">
              <p className="text-[17px] font-medium leading-none tabular-nums text-ink">{data ? (data.counts[stage] ?? 0) : "–"}</p>
              <p className="mt-1.5 truncate text-xs text-ink-2">{STAGE_LABELS[stage]}</p>
            </div>
            {i < p.stages.length - 1 && <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />}
          </li>
        ))}
      </ol>
    </section>
  );
}

const monthOf = (today: ISODate) => new Date(`${today}T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Sales in RENUABL's own visual language (24 Oct 2026, Martin: restraint, as Apple and Tesla would; the sun keeping time):
 * the month as the sun on its arc over three hairlines (sales, deals sold, kW sold), each grown to its share of the
 * business's target or else its own 3-month average, the sun's line showing whether each is ahead; the financial year
 * beside it with six months as fine bars; then tiles: the month's new deals as ticks, the open pipeline as one fine line
 * split by stage, proposals out as ticks.
 */
function SalesView({ jobs, data, today }: ViewProps) {
  const d = jobs ? dashboard(jobs, today) : null;
  const monthName = monthOf(today);
  const proposals = jobs?.filter((j) => j.stage === "proposal").length;
  const [targets, setTargets] = useState<SalesTargets>(NO_TARGETS);
  const [account] = useDesignAccount();
  const canSetTargets = Boolean(account?.signedIn && (!account.may || account.may.prices));
  useEffect(() => {
    void loadTargets().then((res) => res.ok && setTargets(res.targets));
  }, []);
  const history = jobs ? monthlyHistory(jobs, today) : null;
  const rings = history ? monthRings(history, targets) : null;
  const pace = d ? monthPace(d.salesMonth, today) : null;
  const tile = clsx(ui.card, "flex flex-col justify-between gap-3 px-4 py-3.5");
  return (
    <>
      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MonthCard goals={rings} month={monthName} pace={pace} canSetTargets={canSetTargets} />
        <section className={clsx(ui.card, "flex flex-col justify-between gap-4 p-5")} aria-label="The financial year">
          <div>
            <p className={ui.eyebrow}>Sales · {d?.yearLabel ?? "financial year"}</p>
            <p className="mt-2 text-[26px] font-medium leading-none tabular-nums tracking-tight text-ink">
              {d ? dollars(d.salesYear) : "–"}
            </p>
            <p className="mt-1.5 text-[11.5px] text-muted">
              {d ? `${count(d.soldYear, "deal", "deals")} sold since 1 July · ${power(d.kwYear)}` : ""}
            </p>
          </div>
          <MonthBars history={history} />
          {d && (
            <span className="flex flex-wrap gap-x-4 gap-y-1.5">
              <Delta value={d.vsLastMonth} against="on the same days last month" nothing="No sales" />
              <Delta value={d.vsLastYear} against="on the same days last year" nothing="No sales" />
            </span>
          )}
        </section>
      </div>
      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Figures">
        <div className={tile}>
          <div>
            <p className={ui.eyebrow}>New deals</p>
            <p className="mt-1.5 text-[20px] font-medium leading-none tabular-nums tracking-tight text-ink">{d ? d.newDeals : "–"}</p>
          </div>
          <div>
            <Tally
              states={jobs ? newDealPanels(jobs, today, WON_STAGES) : null}
              label={`${monthName}'s new deals: lit when sold, half-lit with a proposal out`}
            />
            <p className="mt-1.5 text-[11.5px] text-muted">
              {d && d.conversion !== null ? `${Math.round(d.conversion * 100)}% became sales` : `None started in ${monthName}`}
            </p>
          </div>
        </div>
        <div className={tile}>
          <div>
            <p className={ui.eyebrow}>Open pipeline</p>
            <p className="mt-1.5 text-[20px] font-medium leading-none tabular-nums tracking-tight text-ink">
              {d ? dollars(d.openValue) : "–"}
            </p>
            <p className="mt-1 text-[11.5px] text-muted">{d ? `${count(d.openDeals, "deal", "deals")} still being sold` : ""}</p>
          </div>
          <PipelineBar stages={jobs ? pipelineByStage(jobs) : null} />
        </div>
        <div className={tile}>
          <div>
            <p className={ui.eyebrow}>Proposals out</p>
            <p className="mt-1.5 text-[20px] font-medium leading-none tabular-nums tracking-tight text-ink">{proposals ?? "–"}</p>
            <p className="mt-1 text-[11.5px] text-muted">With customers, waiting on an answer</p>
          </div>
          <Tally
            states={proposals === undefined ? null : Array.from({ length: proposals }, () => "part" as const)}
            label={`${proposals ?? 0} proposals out`}
          />
        </div>
        <div className={tile}>
          <div>
            <p className={ui.eyebrow}>Customers</p>
            <p className="mt-1.5 text-[20px] font-medium leading-none tabular-nums tracking-tight text-ink">
              {data ? data.customers : "–"}
            </p>
            <p className="mt-1 text-[11.5px] text-muted">Everyone in your list</p>
          </div>
          <Link href={PATHS.customers} className={clsx(ui.link, "text-[12px]")}>
            Open customers <ArrowRight className="inline size-3" aria-hidden />
          </Link>
        </div>
      </section>
      <PipelineCard id={VIEW_PIPELINE.sales} data={data} />
      <p className="mt-2 text-xs text-muted">
        Sales count from when a deal is moved to Won, at its quoted price. Kilowatts count for deals whose design has been saved.
        {data ? ` Lost: ${data.counts.lost ?? 0}.` : ""}
      </p>
      <Latest data={data} problem={null} />
    </>
  );
}

/** What happened last, across every customer. */
function Latest({ data, problem }: { data: Overview | null; problem: string | null }) {
  return (
    <section className="mt-8" aria-labelledby="recent">
      <h2 id="recent" className="text-[15px] font-medium tracking-tight text-ink">
        Latest
      </h2>
      <div className={clsx(ui.card, "mt-3")}>
        {!data ? (
          <p className="p-5 text-sm text-muted">{problem ? "Nothing to show." : "Loading…"}</p>
        ) : data.recent.length === 0 ? (
          <p className="p-5 text-sm text-ink-2">
            Nothing yet.{" "}
            <Link href={`${PATHS.customers}?new=1`} className={ui.link}>
              Add your first customer
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 w-12 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  {ACTIVITY_WORD[a.kind]}
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  <Link href={`${PATHS.customers}/${a.customerId}`} className="font-medium hover:underline">
                    {a.customerName}
                  </Link>
                  <span className="text-ink-2"> · {a.text}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{shortDate(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
