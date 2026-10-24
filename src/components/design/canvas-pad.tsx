"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ChevronRight, HardHat, TrendingUp, UserPlus, type LucideIcon } from "lucide-react";
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
import type { ISODate } from "@/lib/domain/types";
import { dollars, shortDate, type JobLine } from "@/lib/services/crm";
import { PATHS } from "./design-shell";
import { SunArc } from "./gauges";

const ICONS: Record<PadView, LucideIcon> = { leads: UserPlus, performance: TrendingUp, installs: HardHat, closed: BadgeCheck };

/**
 * The pad (25 Oct 2026, Martin): a large surface in the same look as the box beneath it, filling the space between the
 * greeting and the box. Four rounds, each one thing: new leads today, sales today and this month, installations today,
 * sales closed this month. Pressing one shows it in the pad, the rounds moving up into a row; pressing it again puts
 * it away.
 */
export function CanvasPad({ jobs, today, grow }: { jobs: JobLine[] | null; today: ISODate; grow: boolean }) {
  const [open, setOpen] = useState<PadView | null>(null);
  const count: Record<PadView, number | null> = jobs
    ? {
        leads: newLeadsToday(jobs, today).length,
        performance: null,
        installs: installsToday(jobs, today).length,
        closed: closedThisMonth(jobs, today).length,
      }
    : { leads: null, performance: null, installs: null, closed: null };

  return (
    <section
      aria-label="Your business at a glance"
      className={clsx(
        "flex flex-col rounded-3xl bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8",
        grow ? "min-h-[22rem] flex-1" : "",
      )}
    >
      <div className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-4", open === null && grow && "my-auto")}>
        {PAD_VIEWS.map((v) => {
          const Icon = ICONS[v];
          const on = open === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => setOpen(on ? null : v)}
              className={clsx(
                "group flex flex-col items-center rounded-2xl text-center",
                open === null ? "gap-3 px-2 py-4" : "gap-2 px-2 py-2",
                on ? "bg-surface-2" : "hover:bg-surface-2",
              )}
            >
              <span
                className={clsx(
                  "relative grid place-items-center rounded-full transition-[width,height] duration-300 motion-reduce:transition-none",
                  open === null ? "size-16" : "size-11",
                  on ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink ring-1 ring-line group-hover:ring-ink-2",
                )}
              >
                <Icon className={open === null ? "size-6" : "size-5"} aria-hidden />
                {(count[v] ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sun-line px-1 text-[11px] font-semibold leading-5 text-white">
                    {count[v]}
                  </span>
                )}
              </span>
              <span
                className={clsx(
                  "font-medium leading-snug",
                  open === null ? "text-[14px]" : "text-[12.5px]",
                  on ? "text-ink" : "text-ink-2",
                )}
              >
                {PAD_WORDS[v].name}
              </span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="mt-6 border-t border-line pt-6">
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
      )}
    </section>
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
