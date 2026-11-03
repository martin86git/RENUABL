"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  ChevronRight,
  HardHat,
  MessageSquare,
  Phone,
  Stamp,
  TrendingUp,
  Truck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import {
  PAD_VIEWS,
  PAD_WORDS,
  closedThisMonth,
  installsToday,
  newLeadsToday,
  salesToday,
  type PadView,
  type SalesFigures,
} from "@/lib/domain/design/pad";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { nextUp, type NextInput, type NextItem, type NextKind } from "@/lib/domain/design/next-up";
import { dueFollowUp } from "@/lib/domain/design/proposal-lists";
import { listOrders, listProposals } from "@/lib/services/after-sale";
import { loadMessages } from "@/lib/services/chat";
import type { ISODate } from "@/lib/domain/types";
import { dollars, shortDate, type JobLine } from "@/lib/services/crm";
import { PATHS } from "./design-shell";
import { SunArc } from "./gauges";

const ICONS: Record<PadView, LucideIcon> = { leads: UserPlus, performance: TrendingUp, installs: HardHat, closed: BadgeCheck };
const KIND_ICONS: Record<NextKind, LucideIcon> = {
  install: HardHat,
  message: MessageSquare,
  lead: UserPlus,
  "follow-up": Phone,
  order: Truck,
  date: CalendarPlus,
  approvals: Stamp,
};

/**
 * The numbers (25 Oct 2026, Martin; on Today's Pipeline tab since 1 Nov 2026): four rounds, each showing one thing (new
 * leads today, sales today and this month, installations today, sales closed this month); sales opens first.
 */
export function Numbers({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const [open, setOpen] = useState<PadView>("performance");
  const count: Record<PadView, number | null> = jobs
    ? {
        leads: newLeadsToday(jobs, today).length,
        performance: null,
        installs: installsToday(jobs, today).length,
        closed: closedThisMonth(jobs, today).length,
      }
    : { leads: null, performance: null, installs: null, closed: null };

  return (
    <section aria-label="Your numbers" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PAD_VIEWS.map((v) => {
          const Icon = ICONS[v];
          const on = open === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => setOpen(v)}
              className={clsx(
                "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium",
                on ? "bg-primary text-primary-ink" : "text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-2",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {PAD_WORDS[v].name}
              {(count[v] ?? 0) > 0 && <span className="tabular-nums opacity-70">{count[v]}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-1 flex-col border-t border-line pt-6">
        {!jobs ? (
          <p className="animate-pulse text-[14px] text-muted">Looking…</p>
        ) : open === "performance" ? (
          <Performance jobs={jobs} today={today} />
        ) : open === "leads" ? (
          <DealList
            jobs={newLeadsToday(jobs, today)}
            empty={PAD_WORDS.leads.empty}
            side={(j) =>
              `${STAGE_LABELS[j.stage]} · ${new Date(j.createdAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: LAUNCH_MARKET.timeZone })}`
            }
            more={{ href: PATHS.pipelines, label: "Every deal" }}
          />
        ) : open === "installs" ? (
          <DealList
            jobs={installsToday(jobs, today)}
            empty={PAD_WORDS.installs.empty}
            side={(j) => [j.kw ? `${j.kw} kW` : null, j.details.installer || "No installer named"].filter(Boolean).join(" · ")}
            more={{ href: PATHS.scheduler, label: "Install Scheduler" }}
          />
        ) : (
          <Closed jobs={jobs} today={today} />
        )}
      </div>
    </section>
  );
}

/** What needs the business now, from its deals, its customers' messages, its proposals and its orders. */
export function useNextUp(jobs: JobLine[] | null, today: ISODate): NextItem[] | null {
  const [found, setFound] = useState<Omit<NextInput, "jobs" | "today" | "now" | "paths"> | null>(null);
  useEffect(() => {
    let gone = false;
    void Promise.all([loadMessages(), listProposals(), listOrders()]).then(([messages, proposals, orders]) => {
      if (gone) return;
      const now = new Date();
      setFound({
        threads: messages.ok ? messages.threads : [],
        followUps: proposals.ok
          ? proposals.proposals.flatMap((p) => {
              if (p.state !== "live") return [];
              const due = dueFollowUp({ sentAt: p.publishedAt, now, done: p.followUps.map((x) => x.day), lastWord: p.lastWord });
              return due ? [{ jobId: p.jobId, customer: p.customer, age: due.age }] : [];
            })
          : [],
        orders: orders.ok ? orders.orders : [],
      });
    });
    return () => {
      gone = true;
    };
  }, []);
  if (!jobs || !found) return null;
  return nextUp({
    jobs,
    ...found,
    today,
    now: new Date(),
    paths: {
      deal: (id) => `${PATHS.deals}/${id}`,
      chat: (id) => `${PATHS.deals}/${id}?tab=chat`,
      design: (id) => `${PATHS.designer}?job=${encodeURIComponent(id)}`,
      orders: PATHS.orders,
    },
  });
}

/** One thing to do: what, why, and the one button. The most pressing is larger and lit. */
export function NextCard({ item, lead, flush }: { item: NextItem; lead?: boolean; flush?: boolean }) {
  const Icon = KIND_ICONS[item.kind];
  return (
    <div className={clsx("flex items-center gap-4", lead ? clsx("rounded-2xl bg-surface-2 p-4 sm:p-5", !flush && "mt-5") : "py-3")}>
      <span
        className={clsx(
          "grid shrink-0 place-items-center rounded-full",
          lead ? "size-11 bg-[#ffb347] text-[#3a1d00] shadow-[0_0_12px_2px_rgb(255_138_61_/_0.4)]" : "size-9 bg-surface-2 text-ink-2",
        )}
        aria-hidden
      >
        <Icon className={lead ? "size-5" : "size-4"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate font-medium text-ink", lead ? "text-[16px]" : "text-[14px]")}>{item.title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-2">{item.why}</span>
      </span>
      <Link
        href={item.href}
        className={clsx(
          "inline-flex shrink-0 items-center gap-1 rounded-full text-[13px] font-medium",
          lead ? "h-10 bg-primary px-4 text-primary-ink hover:bg-forest" : "h-9 px-3 text-ink ring-1 ring-line hover:ring-ink-2",
        )}
      >
        {item.action} <ChevronRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function Figures({ label, f }: { label: string; f: SalesFigures }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-[30px] font-light leading-none tabular-nums text-ink">{dollars(f.value)}</p>
      <p className="mt-2 text-[13px] tabular-nums text-ink-2">
        {f.deals} {f.deals === 1 ? "deal" : "deals"} · {f.kw} kW
      </p>
    </div>
  );
}

/** Sales today and month to date, under the sun crossing the month. */
function Performance({ jobs, today }: { jobs: JobLine[]; today: ISODate }) {
  const s = salesToday(jobs, today);
  const name = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1fr_1.3fr] md:items-end">
      <Figures label="Today" f={s.today} />
      <Figures label="Month to date" f={s.month} />
      <div>
        <SunArc now={(s.day - 0.5) / s.days} tone="light" start={`1 ${name}`} end={`${s.days} ${name}`} />
        <p className="mt-2 text-[13px] text-ink-2">
          Day {s.day} of {s.days}
          {s.month.value > 0 ? (
            <>
              {" · "}on pace for <span className="tabular-nums text-ink">{dollars(s.projected)}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/** This month's closed sales: the total, then each one. */
function Closed({ jobs, today }: { jobs: JobLine[]; today: ISODate }) {
  const list = closedThisMonth(jobs, today);
  const total = salesToday(jobs, today).month;
  return (
    <>
      {list.length > 0 && (
        <p className="mb-4 text-[14px] text-ink-2">
          <span className="text-[22px] font-light tabular-nums text-ink">{dollars(total.value)}</span> from {total.deals}{" "}
          {total.deals === 1 ? "sale" : "sales"} · {total.kw} kW
        </p>
      )}
      <DealList
        jobs={list}
        empty={PAD_WORDS.closed.empty}
        side={(j) => [j.wonAt ? `Sold ${shortDate(j.wonAt)}` : null, dollars(j.value)].filter(Boolean).join(" · ")}
        more={{ href: PATHS.proposalsSigned, label: "Signed proposals" }}
      />
    </>
  );
}

/** Deals as rows, each opening its deal. */
function DealList(props: { jobs: JobLine[]; empty: string; side: (j: JobLine) => string; more: { href: string; label: string } }) {
  return (
    <div>
      {props.jobs.length === 0 ? (
        <p className="text-[14px] text-ink-2">{props.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {props.jobs.map((j) => (
            <li key={j.id}>
              <Link href={`${PATHS.deals}/${j.id}`} className="group flex items-center gap-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                    {j.customerName}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-2">{j.address || j.title}</span>
                </span>
                <span className="shrink-0 text-right text-[12.5px] tabular-nums text-ink-2">{props.side(j)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={props.more.href} className="mt-4 inline-block text-[13px] font-medium text-ink-2 hover:text-ink">
        {props.more.label} →
      </Link>
    </div>
  );
}
