"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, BatteryCharging, Eye, PhoneCall, Stamp, type LucideIcon } from "lucide-react";
import { ALL_GOOD, type Insight, type InsightsView, type MonthView } from "@/lib/domain/design/insights";
import type { SolFile } from "@/lib/domain/design/sol";
import type { TodayView } from "@/lib/domain/design/today-view";
import { dollars } from "@/lib/services/crm";
import { loadInsights } from "@/lib/services/insights";
import { GoalLine, SunArc } from "./gauges";
import { SolMark, SolStars } from "./sol-icon";
import { SolBox } from "./today-pad";

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

/** The first view's name on the switch: Business for the owner and admins, My month for everyone else. */
export const firstViewLabel = (views: InsightsView[] | null | "failed") =>
  Array.isArray(views) && views[0]?.scope === "me" ? "My month" : "Business";

export function TodayChat(props: {
  name: string | null;
  views: InsightsView[] | null | "failed";
  asking: boolean;
  hidden: boolean;
  onAsk: (q: string, files: SolFile[]) => void;
}) {
  const views = Array.isArray(props.views) ? props.views : null;
  const mine = views?.[0]?.scope === "me";
  const you = props.name ? `, ${props.name}` : "";
  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col items-center px-1 pb-10 pt-2" inert={props.hidden}>
      <span className="relative">
        <span className="sol-orb sol-breathe inline-flex size-16 items-center justify-center rounded-full">
          <SolMark className="size-12" />
        </span>
        <SolStars className="absolute -right-3 -top-2 size-6" />
      </span>
      <h1 className="mt-4 text-center text-[clamp(22px,2.6vw,28px)] font-normal leading-[1.15] tracking-[-0.02em] text-ink">
        {mine ? `How's your month going${you}?` : `How's the business going${you}?`}
      </h1>
      <p className="mt-1 text-center text-[13.5px] text-ink-2">
        {mine ? "From your own deals. Only you see this." : "Sol read your deals this morning. Here's what matters."}
      </p>

      <div className="mt-6 w-full space-y-10 text-left">
        {props.views === "failed" ? (
          <p className="rounded-2xl bg-surface p-5 text-[13.5px] text-ink-2 ring-1 ring-line">
            The month couldn&rsquo;t be read just now. Feed has your deals.
          </p>
        ) : !views ? (
          <div className="h-56 animate-pulse rounded-[22px] bg-surface/70 ring-1 ring-line/70" />
        ) : (
          views.map((v, i) => <ViewPart key={v.scope} view={v} titled={i > 0} />)
        )}
      </div>

      <div data-tour="today-sol" className="mt-8 w-full">
        <SolBox
          onAsk={props.onAsk}
          asking={props.asking}
          placeholder={mine ? "Ask Sol: how do I win a quiet deal back?" : "Ask about the business: why are we down on last month?"}
        />
      </div>
    </div>
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

/** Business (or My month) | Feed, at the top of Today. */
export function TodaySwitch({ view, onView, first }: { view: TodayView; onView: (v: TodayView) => void; first: string }) {
  return (
    <div
      role="tablist"
      aria-label="Today"
      className="inline-flex rounded-full bg-surface p-1 shadow-[0_2px_10px_rgb(20_22_26_/_0.06)] ring-1 ring-line"
    >
      {(
        [
          ["chat", first],
          ["feed", "Feed"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => onView(v)}
          className={clsx(
            "h-8 rounded-full px-4 text-[13px] font-medium transition",
            view === v ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
