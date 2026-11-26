"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowRight,
  BatteryCharging,
  CircleAlert,
  Eye,
  FileCheck2,
  FileText,
  HardHat,
  Lightbulb,
  Package,
  Phone,
  PhoneCall,
  Sparkles,
  SquareKanban,
  Stamp,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ISODate } from "@/lib/domain/types";
import type { NextItem } from "@/lib/domain/design/next-up";
import { ALL_GOOD, type Insight, type InsightsView, type MonthView } from "@/lib/domain/design/insights";
import type { SolFile } from "@/lib/domain/design/sol";
import { dollars, loadWeather, type JobLine } from "@/lib/services/crm";
import { loadInsights } from "@/lib/services/insights";
import { todayHeading } from "@/lib/domain/design/today-view";
import { SKY_EMOJI, type Sky } from "@/lib/domain/weather";
import { GoalLine, SunArc } from "./gauges";
import { loadFeed } from "@/lib/services/deal-feed";
import type { FeedDeal } from "@/lib/domain/design/deal-feed";
import { TrayNeeds, dealsNeedingYou } from "./tray-needs";
import { SolEtch } from "./sol-icon";
import { SolBox } from "./today-pad";
import { PerformancePanel } from "./performance-panel";
import { loadPerfRows } from "@/lib/services/performance";
import { listProposals } from "@/lib/services/after-sale";
import { loadCallLog } from "@/lib/services/call-log";
import { loadPrepared } from "@/lib/services/prepared";
import { CallLogPage } from "./call-log";
import { ProposalsPage } from "./design-proposals-list";
import { ReadyForYou, usePrepared } from "./ready-for-you";
import { NoticeBulb, StcNoticeCard, useStcNotice } from "./stc-period";
import { useDockSet } from "@/lib/services/dock-set";
import { DOCK_SET_WORDS, installingOn } from "@/lib/domain/design/dock-set";
import { INSTALLER_KEY } from "@/lib/domain/design/crm";
import { OrdersPage } from "./design-orders";
import { AfterInstallPage } from "./install-lists";
import { TrayTabs, type TrayTabItem } from "./tray-tabs";

/** The pipeline, a shortcut in the tray (24 Nov 2026, Martin). */
const PIPELINE_PATH = "/design/sales/pipelines";

/**
 * Today's Business and My month (21 Nov 2026, Martin: the Chat page wasn't a plus, chat is everywhere already; what
 * nobody answered was "how is my business going, and what should I change?"). Today's first view, beside Feed. For
 * anyone who may change settings it is the business: the month against its goal and up to three things worth changing,
 * read by rule from the business's own deals (domain/design/insights.ts). For a salesperson it is their own month and
 * coaching from their own deals, seen by them alone. An owner who also sells gets their own month under the business.
 * Sol's box under it takes questions about the business, and asking turns Today into the conversation.
 */

/** Today's views, read once a page. */
export function useInsights(): InsightsView[] | null | "failed" {
  const [views, setViews] = useState<InsightsView[] | null | "failed">(null);
  useEffect(() => {
    let on = true;
    void loadInsights().then((r) => on && setViews(r.ok ? r.views : "failed"));
    return () => {
      on = false;
    };
  }, []);
  return views;
}

/** Today's date, and the weather now beside it as an emoji and a small temperature (left out when it can't be had). */
function TodayDate({ today }: { today: ISODate }) {
  const [weather, setWeather] = useState<{ degrees: number | null; sky: Sky | null } | null>(null);
  useEffect(() => {
    let on = true;
    void loadWeather().then((r) => on && r.ok && setWeather({ degrees: r.degrees, sky: r.sky ?? null }));
    return () => {
      on = false;
    };
  }, []);
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {/* The date opens the calendar, as the date tile does on a computer (23 Nov 2026, Martin). */}
      <h1 className="text-center text-[17px] sm:text-[clamp(17px,1.7vw,20px)] font-normal leading-[1.15] tracking-[-0.02em] text-ink">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(TODAY_CALENDAR))}
          title="Open the calendar"
          className="rounded-lg decoration-line underline-offset-4 hover:underline"
        >
          {todayHeading(today)}
        </button>
      </h1>
      <div className="flex items-center gap-2">
        {weather && (weather.sky || weather.degrees !== null) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[13px] tracking-normal text-white">
            {weather.sky && <span aria-hidden>{SKY_EMOJI[weather.sky]}</span>}
            {weather.degrees !== null && <span className="tabular-nums">{Math.round(weather.degrees)}°C</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/** Asks Today to open its calendar (the date heading). */
export const TODAY_CALENDAR = "renuabl:today-calendar";

/** The first view's name on the switch: Business for the owner and admins, My month for everyone else. */
export const firstViewLabel = (views: InsightsView[] | null | "failed") =>
  Array.isArray(views) && views[0]?.scope === "me" ? "My month" : "Business";

type TrayTab = "performance" | "pipeline" | "needs" | "proposals" | "calls" | "sol" | "changes" | "installs" | "orders" | "paperwork";

export function TodayChat(props: {
  name: string | null;
  views: InsightsView[] | null | "failed";
  asking: boolean;
  hidden: boolean;
  onAsk: (q: string, files: SolFile[]) => void;
  jobs: JobLine[] | null;
  today: ISODate;
  /** What needs the member now, most pressing first (next-up.ts). */
  items: NextItem[] | null;
}) {
  const views = Array.isArray(props.views) ? props.views : null;
  const first = views?.[0];
  const own = views?.[1];
  const mine = first?.scope === "me";
  const [tab, setTab] = useState<TrayTab | null>(null);
  // Today's notices (only STC changes for now): a card under the tray, or a lightbulb on Sol's box once minimised.
  const stc = useStcNotice();
  // The deals Sol has a suggestion on, for Needs you (the feed's own answer, read again as Sol's cards change).
  const [feed, setFeed] = useState<FeedDeal[] | null>(null);
  const readFeed = useCallback(async () => {
    const r = await loadFeed();
    if (r.ok) setFeed(r.deals);
  }, []);
  useEffect(() => {
    // Performance's own small rows first, so a press on it finds them ready (22 Nov 2026, Martin).
    void loadPerfRows();
    // Then every other tab's answer, kept for the page, so each opens on it at once.
    const t = window.setTimeout(() => {
      void readFeed();
      void listProposals();
      void loadCallLog();
      void loadPrepared();
    }, 0);
    return () => window.clearTimeout(t);
  }, [readFeed]);
  // Worked out once a feed, not on every press of a tab (it reads every deal's next move).
  const needsCount = useMemo(() => (feed ? dealsNeedingYou(feed).length : undefined), [feed]);
  // 21 Nov 2026, Martin: the tray holds what Sol or a voice agent can act on, with Performance first.
  // The tray follows the dock (23 Nov 2026, Martin: flipping the dock changes what Today shows by default, the page the
  // same): on the post-sale tools, today's installs, orders and the paperwork after install.
  const dock = useDockSet();
  const post = dock === "post";
  const installsToday = useMemo(() => (props.jobs ? installingOn(props.jobs, props.today).length : undefined), [props.jobs, props.today]);
  const postTabs: TrayTabItem<TrayTab>[] = [
    { key: "performance", label: mine ? "My month" : "Performance", icon: TrendingUp },
    { key: "pipeline", label: "Pipeline", icon: SquareKanban, href: PIPELINE_PATH },
    { key: "installs", label: "Installs", icon: HardHat, count: installsToday },
    { key: "orders", label: "Orders", icon: Package },
    { key: "paperwork", label: "Paperwork", icon: FileCheck2 },
  ];
  const salesTabs: TrayTabItem<TrayTab>[] = [
    { key: "performance", label: mine ? "My month" : "Performance", icon: TrendingUp },
    { key: "pipeline", label: "Pipeline", icon: SquareKanban, href: PIPELINE_PATH },
    { key: "needs", label: "Needs you", icon: CircleAlert, count: needsCount },
    { key: "proposals", label: "Proposals", icon: FileText },
    { key: "calls", label: "Calls", icon: Phone },
    { key: "sol", label: "Sol's work", icon: Sparkles },
    { key: "changes", label: mine ? "Next wins" : "Worth changing", icon: Lightbulb, count: first?.insights.length },
  ];
  const tabs = post ? postTabs : salesTabs;
  // A tab of the other set closes as the dock turns.
  const shown = tab && tabs.some((t) => t.key === tab) ? tab : null;
  // Whose panel isn't about the month: drawn wider than the box, as the pages they come from are.
  const wide = shown === "calls" || shown === "proposals" || shown === "orders" || shown === "paperwork";
  // As the screenshot Martin chose (21 Nov 2026): the greeting, Sol's box straight under it, and a tray tucked under the
  // box whose tabs open what was on the cards (the month, what is worth changing) below it, one at a time.
  return (
    <div
      className={clsx(
        "mx-auto flex w-full max-w-[54rem] flex-col items-center px-1 pb-16 pt-2",
        !shown && "min-h-[calc(100dvh-15rem)] justify-center",
      )}
      inert={props.hidden}
    >
      {/* 22 Nov 2026, Martin: no Sol round in the middle on a phone (he is in the foot bar), and the day with its weather
          in place of "How's the business going". */}
      {/* 22 Nov 2026, Martin: here Sol is only the etched brain (`SolEtch`), no colour or glow, a little higher, clear of
          the date; then "more like a white / grey… less dark", on phones too. */}
      {/* 26 Nov 2026, Martin: on a phone the brain, date, weather and box sit a line lower in the pad (mt-6, was -mt-2). */}
      {/* 23 Nov 2026, Martin: the brain takes the dock's colour, a pale navy on the post-sale tools. */}
      <span
        className={clsx(
          "relative mt-6 mb-3 inline-flex transition-colors duration-500 sm:-mt-6 sm:mb-5",
          post ? "text-[#b4cf5e]" : dock === "market" ? "text-[#a9c3ec]" : "text-[#c9ccd3]",
        )}
      >
        <SolEtch className="size-12 sm:size-16" />
      </span>
      <TodayDate today={props.today} />

      <div data-tour="today-sol" className="relative z-10 mt-6 w-full">
        <SolBox
          tall
          shortcuts
          corner={
            first && !mine ? (
              <NoticeBulb
                state={stc}
                onOpen={() =>
                  requestAnimationFrame(() =>
                    document.getElementById("stc-notice")?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                  )
                }
              />
            ) : null
          }
          onAsk={props.onAsk}
          asking={props.asking}
          placeholder={post ? DOCK_SET_WORDS.post.ask : mine ? "Ask Sol: how do I win a quiet deal back?" : DOCK_SET_WORDS.sales.ask}
        />
      </div>

      {/* The tray tucks under the box, inset the same on both sides; on a phone its tabs scroll inside it and fade at the
          right edge, so the last one is never cut off square (24 Nov 2026, Martin: it "finishes oddly at the right"). */}
      <div className="-mt-5 w-[calc(100%-2.5rem)] overflow-hidden rounded-b-[20px] bg-primary pb-2 pt-[28px] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)]">
        <TrayTabs set={post ? "post" : "sales"} tabs={tabs} shown={shown} onPick={(key) => setTab(shown === key ? null : key)} />
      </div>

      {/* STC changes (stc-change.ts): one card under the tray, only for who may change settings, only while there is something to say. */}
      {first && !mine && <StcNoticeCard state={stc} className="mt-5 w-full text-left" />}

      {shown && (
        <div role="tabpanel" className={clsx("mt-5 text-left", wide ? "w-[min(72rem,calc(100vw-3rem))]" : "w-full")}>
          {shown === "installs" ? (
            <TrayInstalls jobs={props.jobs} today={props.today} />
          ) : shown === "orders" ? (
            <OrdersPage />
          ) : shown === "paperwork" ? (
            <AfterInstallPage />
          ) : shown === "needs" ? (
            <TrayNeeds deals={feed} onChanged={() => void readFeed()} />
          ) : shown === "calls" ? (
            <CallLogPage />
          ) : shown === "proposals" ? (
            <ProposalsPage signed={false} bare />
          ) : shown === "sol" ? (
            <SolWorkPanel />
          ) : shown === "performance" ? (
            <PerformancePanel
              jobs={props.jobs}
              today={props.today}
              extra={
                first ? (
                  <>
                    <MonthPanel month={first.month} mine={mine} />
                    {own && (
                      <div className="pt-2">
                        <p className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">Your own month</p>
                        <ViewPart view={own} titled={false} />
                      </div>
                    )}
                  </>
                ) : null
              }
            />
          ) : props.views === "failed" ? (
            <p className="rounded-2xl bg-surface p-5 text-[13.5px] text-ink-2 ring-1 ring-line">
              The month couldn&rsquo;t be read just now. Feed has your deals.
            </p>
          ) : !first ? (
            <div className="h-56 animate-pulse rounded-[22px] bg-surface/70 ring-1 ring-line/70" />
          ) : (
            <Changes view={first} />
          )}
        </div>
      )}
    </div>
  );
}

/** What Sol has prepared and is waiting on a press to send. */
function SolWorkPanel() {
  const { items } = usePrepared();
  if (!items) return <div className="h-40 animate-pulse rounded-[22px] bg-surface/70 ring-1 ring-line/70" />;
  if (!items.length)
    return (
      <p className="rounded-2xl bg-surface px-5 py-4 text-[13.5px] text-ink-2 ring-1 ring-line/70">
        Nothing from Sol is waiting on you. What he sends by himself is on your Feed under Sol&rsquo;s work.
      </p>
    );
  return <ReadyForYou compact />;
}

function Changes({ view }: { view: InsightsView }) {
  return view.insights.length ? (
    <div className="space-y-2">
      {view.insights.map((x) => (
        <InsightRow key={x.key} insight={x} />
      ))}
    </div>
  ) : (
    <p className="rounded-2xl bg-surface px-5 py-4 text-[13.5px] text-ink-2 ring-1 ring-line/70">{ALL_GOOD}</p>
  );
}

function ViewPart({ view, titled }: { view: InsightsView; titled: boolean }) {
  const mine = view.scope === "me";
  return (
    <section aria-label={mine ? "Your month" : "The business"}>
      {titled && <h2 className="mb-3 ml-1 text-[15px] font-medium text-ink">Your own month</h2>}
      <MonthPanel month={view.month} mine={mine} />
      <p className="mb-2 ml-1 mt-5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted">
        {mine ? "Your next wins" : "Worth changing"}
      </p>
      {view.insights.length ? (
        <div className="space-y-2">
          {view.insights.map((x) => (
            <InsightRow key={x.key} insight={x} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-surface px-5 py-4 text-[13.5px] text-ink-2 ring-1 ring-line/70">{ALL_GOOD}</p>
      )}
    </section>
  );
}

const MONTH = new Intl.DateTimeFormat("en-AU", { month: "long", timeZone: "Australia/Melbourne" });
const k = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000).toLocaleString("en-AU")}k` : dollars(n));

function MonthPanel({ month, mine }: { month: MonthView; mine: boolean }) {
  const now = month.day / month.days;
  const share = month.goal ? (mine ? month.signed : month.sold) / month.goal : 0;
  const name = MONTH.format(new Date());
  const usual = month.goalIs === "target" ? "target" : mine ? "your usual" : "a usual month";
  const paceTone = month.pace === "ahead" ? "text-positive" : month.pace === "behind" ? "text-warning" : undefined;
  const figures: [string, string, string?][] = mine
    ? [
        [String(month.signed), month.goal ? `signed of ${Math.round(month.goal)}, ${usual}` : "signed so far"],
        [k(month.sold), "signed in dollars"],
        [String(month.likelyDeals), "likely to sign"],
        month.pace === "none" ? ["–", "no usual month yet"] : [month.pace === "ahead" ? "Ahead" : "Behind", "of the sun", paceTone],
      ]
    : [
        [k(month.sold), month.goal ? `sold of ${k(month.goal)}, ${usual}` : "sold so far"],
        [k(month.likely), "likely by month end"],
        month.needed === null
          ? ["–", "no goal yet: set one in Settings"]
          : month.needed === 0
            ? ["Reached", "the month's goal", "text-positive"]
            : [`${month.needed} more`, `signed to get there`, paceTone],
      ];
  return (
    <div className="rounded-[22px] bg-surface px-5 pb-5 pt-4 ring-1 ring-line/70">
      <div className="flex items-baseline justify-between text-[12px] text-ink-2">
        <span>{mine ? `Your ${name}` : `${name} so far`}</span>
        <span className="tabular-nums">
          Day {month.day} of {month.days}
        </span>
      </div>
      <div className="mx-auto mt-2 max-w-md">
        <SunArc now={now} tone="light" start="1st" end={`${month.days}th`} />
      </div>
      {month.goal ? (
        <div className="mt-1">
          <GoalLine share={share} now={now} tone="light" label={`${Math.round(share * 100)}% of the month's goal`} />
        </div>
      ) : null}
      <div className={clsx("mt-3 grid gap-3", figures.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
        {figures.map(([big, small, tone]) => (
          <div key={small} className="min-w-0">
            <div className={clsx("font-mono text-[22px] leading-none tracking-[-0.02em]", tone ?? "text-ink")}>{big}</div>
            <div className="mt-1.5 text-[12px] leading-snug text-ink-2">{small}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ICONS: Record<Insight["key"], LucideIcon> = { speed: PhoneCall, opened: Eye, battery: BatteryCharging, approvals: Stamp };

function InsightRow({ insight }: { insight: Insight }) {
  const Icon = ICONS[insight.key];
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-line/70 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <Icon
          className={clsx(
            "mt-0.5 size-5 shrink-0",
            insight.tone === "good" ? "text-positive" : insight.tone === "warn" ? "text-warning" : "text-sun-line",
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[14.5px] font-medium text-ink">{insight.title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{insight.why}</p>
        </div>
      </div>
      <Link
        href={insight.action.href}
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition hover:ring-sun-line sm:self-auto"
      >
        {insight.action.label} <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

/** Installs, on the dock's post-sale tools: today's installs, each opening its deal, then how many are booked this week. */
function TrayInstalls({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  if (!jobs) return <div className="h-32 animate-pulse rounded-[22px] bg-surface/70 ring-1 ring-line/70" />;
  const now = installingOn(jobs, today);
  const soon = jobs
    .filter((j) => j.stage !== "lost" && j.installDate && j.installDate > today)
    .sort((a, b) => (a.installDate! < b.installDate! ? -1 : 1));
  return (
    <div className="rounded-[22px] bg-surface px-4 py-3.5 ring-1 ring-line/70">
      <p className="text-[13px] font-semibold text-ink">Installing today</p>
      {now.length ? (
        <ul className="mt-2 divide-y divide-line">
          {now.map((j) => (
            <li key={j.id}>
              <Link href={`/design/deals/${j.id}`} className="flex items-center gap-3 py-2.5 text-[13.5px] text-ink hover:text-sun-ink">
                <HardHat className="size-4 shrink-0 text-sun-line" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {j.customerName}
                  {j.address ? <span className="text-ink-2"> · {j.address.split(",")[1]?.trim() || j.address}</span> : null}
                </span>
                {j.details?.[INSTALLER_KEY] ? (
                  <span className="shrink-0 text-[12px] text-ink-2">{String(j.details[INSTALLER_KEY])}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13px] text-ink-2">
          No installs today.
          {soon[0] ? ` The next is ${soon[0].customerName} on ${soon[0].installDate}.` : ""}
        </p>
      )}
      <Link
        href="/design/installations"
        className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:text-sun-ink"
      >
        The install calendar <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
