"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowUp, CalendarDays, ChevronLeft, ChevronRight, HardHat, KanbanSquare, Mail, Phone, Sun, X } from "lucide-react";
import { LAUNCH_MARKET, greeting } from "@/lib/domain/market";
import { nextHeadline, type NextItem } from "@/lib/domain/design/next-up";
import {
  TODAY_TABS,
  agendaFor,
  beforeYouCall,
  daySoFar,
  jobOf,
  nextWorkingDay,
  pipelineBoard,
  type BeforeCall,
  type TodayTab,
} from "@/lib/domain/design/today-pad";
import type { Activity } from "@/lib/domain/design/crm";
import type { SolReminder } from "@/lib/domain/design/sol";
import type { ISODate } from "@/lib/domain/types";
import { dollars, loadCustomer, loadJob, type JobLine } from "@/lib/services/crm";
import { SOL_CHANGED, SOL_TOGGLE, askSol, loadSol } from "@/lib/services/sol";
import { PATHS } from "./design-shell";
import { NextCard, Numbers, useNextUp } from "./canvas-pad";
import { NewLook } from "./new-look";
import { SolIcon } from "./sol-icon";
import { SolThinking } from "./sol-thinking";

const TAB_ICONS: Record<TodayTab, typeof Sun> = { today: Sun, calendar: CalendarDays, pipeline: KanbanSquare };
/** Items under Up first before "N more". */
const SHOWN = 5;

const dayWords = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00Z`));

/** An instant as its day and 24-hour time in the market. */
function timeOf(iso: string): { day: string; time: string } {
  const at = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAUNCH_MARKET.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return { day, time };
}
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};

/**
 * Today as one pad (1 Nov 2026, as Primero's: it replaces the canvas). Across its top Today, Calendar and Pipeline, and
 * in the corner "Your day" (the sun keeping time on the day's list). Today is the greeting, **Up first** (the most
 * pressing thing, large) with **Before you call** beside it, **To action** (the rest) and **Your day so far**. Calendar
 * is a day's installs and reminders, stepping through the working days. Pipeline is the deals being sold as a board,
 * or the numbers. Sol's box sits at the foot: what is asked there comes back as a card over the box, so the pad stays
 * in sight, and "Open in Sol" carries on in his panel.
 */
export function TodayPad(props: {
  jobs: JobLine[] | null;
  today: ISODate;
  business: string;
  name: string | null;
  email: string;
  /** What this member did today, from the overview. */
  mine: Pick<Activity, "kind" | "by">[] | null;
  problem: string | null;
  /** The day's list with the sun (the corner's view). */
  day: React.ReactNode;
}) {
  const [tab, setTab] = useState<TodayTab | "day">("today");
  const items = useNextUp(props.jobs, props.today);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-6xl flex-col">
      <div className="flex items-center gap-2">
        <span className="hidden w-28 shrink-0 sm:block" aria-hidden />
        <nav aria-label="Today" className="flex min-w-0 flex-1 justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full bg-surface p-1 ring-1 ring-line">
            {TODAY_TABS.map((t) => {
              const Icon = TAB_ICONS[t.id];
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={on}
                  className={clsx(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition",
                    on ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t.label}
                  {t.id === "today" && items && items.length > 0 && (
                    <span
                      className={clsx(
                        "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        on ? "bg-white/20" : "bg-sun text-sun-ink",
                      )}
                    >
                      {items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
        <button
          type="button"
          onClick={() => setTab(tab === "day" ? "today" : "day")}
          aria-pressed={tab === "day"}
          title="Your day: what needs clearing before the sun sets"
          className={clsx(
            "flex w-28 shrink-0 items-center justify-end gap-1.5 rounded-full py-1.5 pl-2 pr-3 text-[13px] text-ink-2 transition hover:text-ink",
            tab === "day" && "bg-surface ring-1 ring-line",
          )}
        >
          <Sun className="size-4 text-sun-line" aria-hidden /> Your day
        </button>
      </div>

      {props.problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {props.problem}
        </p>
      )}

      <div className="mt-5 flex-1">
        {tab === "today" && <TodayView {...props} items={items} />}
        {tab === "calendar" && <CalendarView jobs={props.jobs} today={props.today} />}
        {tab === "pipeline" && <PipelineView jobs={props.jobs} today={props.today} />}
        {tab === "day" && props.day}
      </div>

      <AskSol />
    </div>
  );
}

function TodayView(props: {
  jobs: JobLine[] | null;
  today: ISODate;
  business: string;
  name: string | null;
  email: string;
  mine: Pick<Activity, "kind" | "by">[] | null;
  items: NextItem[] | null;
}) {
  const [all, setAll] = useState(false);
  const hour = Number(new Date().toLocaleString("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: LAUNCH_MARKET.timeZone }));
  const [first, ...rest] = props.items ?? [];
  const shown = all ? rest : rest.slice(0, SHOWN);
  const done = props.mine ? daySoFar(props.mine, props.email) : null;
  return (
    <div>
      <NewLook name={props.name} />
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{props.business || "Your business"}</p>
      <h1 className="mt-1.5 text-[clamp(24px,3.2vw,32px)] font-light leading-[1.1] tracking-[-0.02em] text-ink">
        {greeting()}
        {props.name ? `, ${props.name}` : ""}.
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">{props.items ? nextHeadline(props.items.length, hour) : "Looking at your day…"}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Up first" className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Up first</p>
          {!props.items ? (
            <p className="mt-3 animate-pulse text-[14px] text-muted">Looking…</p>
          ) : !first ? (
            <p className="mt-3 text-[14px] text-ink-2">
              Everything is answered, followed up and booked. Ask Sol below, or look at the Pipeline.
            </p>
          ) : (
            <NextCard item={first} lead />
          )}
          {rest.length > 0 && (
            <>
              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">To action</p>
              <ul className="mt-1 divide-y divide-line">
                {shown.map((i) => (
                  <li key={i.key}>
                    <NextCard item={i} />
                  </li>
                ))}
              </ul>
              {rest.length > SHOWN && (
                <button
                  type="button"
                  onClick={() => setAll(!all)}
                  className="tap-area mt-2 text-[13px] font-medium text-ink-2 hover:text-ink"
                >
                  {all ? "Show fewer" : `${rest.length - SHOWN} more`}
                </button>
              )}
            </>
          )}
        </section>

        <div className="space-y-4">
          {first && jobOf(first) && <BeforeYouCall jobId={jobOf(first)!} today={props.today} />}
          <section aria-label="Your day so far" className="rounded-3xl bg-surface p-5 ring-1 ring-line">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Your day so far</p>
            {!done ? (
              <p className="mt-2 animate-pulse text-sm text-muted">Looking…</p>
            ) : done.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Nothing logged yet today. Calls, emails and notes you log on a deal show here.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {done.map((d) => (
                  <li key={d.kind} className="flex items-baseline gap-2 text-sm">
                    <span className="w-8 text-right text-[20px] font-light tabular-nums text-ink">{d.n}</span>
                    <span className="text-ink-2">{d.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** What to know about the first customer on the list before ringing them, from their record. */
function BeforeYouCall({ jobId, today }: { jobId: string; today: ISODate }) {
  const [got, setGot] = useState<{ id: string; name: string; phone: string; email: string; facts: BeforeCall } | null>(null);
  useEffect(() => {
    let gone = false;
    void loadJob(jobId).then(async (j) => {
      if (!j.ok || gone) return;
      const c = await loadCustomer(j.customer.id);
      if (gone) return;
      setGot({
        id: jobId,
        name: j.customer.name,
        phone: j.customer.phone,
        email: j.customer.email,
        facts: beforeYouCall({ job: j.job, customer: j.customer, activity: c.ok ? c.activity : [], today }),
      });
    });
    return () => {
      gone = true;
    };
  }, [jobId, today]);
  if (!got || got.id !== jobId) return null;
  return (
    <section aria-label="Before you call" className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Before you call</p>
      <p className="mt-2 text-[15px] font-medium text-ink">{got.name}</p>
      <p className="text-[13px] text-ink-2">{got.facts.deal}</p>
      {got.facts.last && <p className="mt-2 text-[13px] text-ink-2">{got.facts.last}</p>}
      {got.facts.open.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
          {got.facts.open.map((o) => (
            <li key={o} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-line" aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {got.phone && (
          <a
            href={`tel:${got.phone.replace(/\s+/g, "")}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink hover:bg-forest"
          >
            <Phone className="size-3.5" aria-hidden /> {got.phone}
          </a>
        )}
        {got.email && (
          <Link
            href={`${PATHS.deals}/${jobId}?tab=email`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-ink ring-1 ring-line hover:ring-ink-2"
          >
            <Mail className="size-3.5" aria-hidden /> Email
          </Link>
        )}
        <Link
          href={`${PATHS.deals}/${jobId}`}
          className="inline-flex h-9 items-center px-2 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          Open deal
        </Link>
      </div>
    </section>
  );
}

/** A day's installs and the member's own reminders, stepping through the working days. */
function CalendarView({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const [days, setDays] = useState<string[]>([today]);
  const [reminders, setReminders] = useState<SolReminder[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadSol().then((r) => !gone && setReminders(r.ok ? r.state.reminders : []));
    return () => {
      gone = true;
    };
  }, []);
  const day = days[days.length - 1];
  const items = jobs && reminders ? agendaFor(day, { jobs, reminders, timeOf }) : null;
  return (
    <section aria-label="Calendar" className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDays(days.slice(0, -1))}
          disabled={days.length === 1}
          aria-label="The day before"
          className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink disabled:text-line"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="min-w-[14rem] text-center text-sm font-semibold text-ink">
          {day === today ? "Today" : days.length === 2 ? "Next working day" : "Ahead"}{" "}
          <span className="font-normal text-muted">· {dayWords(day)}</span>
        </p>
        <button
          type="button"
          onClick={() => setDays([...days, nextWorkingDay(day)])}
          disabled={days.length > 15}
          aria-label="The next working day"
          className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink disabled:text-line"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      {!items ? (
        <p className="mt-6 animate-pulse text-center text-sm text-muted">Looking…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-2">
          Nothing booked. Installs on their day, and reminders you ask Sol for, show here.
        </p>
      ) : (
        <ol className="mx-auto mt-5 max-w-2xl divide-y divide-line">
          {items.map((i) => {
            const body = (
              <span className="flex items-center gap-4 py-3">
                <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-ink-2">{i.time ? clock(i.time) : ""}</span>
                <span
                  className={clsx(
                    "grid size-8 shrink-0 place-items-center rounded-full",
                    i.kind === "install" ? "bg-sun text-sun-line" : "bg-surface-2 text-ink-2",
                  )}
                >
                  {i.kind === "install" ? <HardHat className="size-4" aria-hidden /> : <SolIcon className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink">{i.title}</span>
                  <span className="block truncate text-[12.5px] text-ink-2">{i.line}</span>
                </span>
              </span>
            );
            return (
              <li key={i.key}>
                {i.jobId ? (
                  <Link href={`${PATHS.deals}/${i.jobId}`} className="block hover:bg-canvas">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-5 text-center text-[12px] text-muted">
        <Link href={PATHS.scheduler} className="underline-offset-4 hover:text-ink hover:underline">
          Open the install calendar
        </Link>
      </p>
    </section>
  );
}

/** The deals being sold as a board, or the numbers. */
function PipelineView({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const [numbers, setNumbers] = useState(false);
  const pill = (on: boolean) =>
    clsx("rounded-full px-3 py-1 text-[13px] transition", on ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink");
  return (
    <section aria-label="Pipeline" className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <div className="flex justify-center">
        <div className="inline-flex gap-0.5 rounded-full bg-canvas p-1 ring-1 ring-line" role="tablist" aria-label="Pipeline">
          <button type="button" role="tab" aria-selected={!numbers} onClick={() => setNumbers(false)} className={pill(!numbers)}>
            Board
          </button>
          <button type="button" role="tab" aria-selected={numbers} onClick={() => setNumbers(true)} className={pill(numbers)}>
            Numbers
          </button>
        </div>
      </div>
      <div className="mt-5">
        {numbers ? (
          <Numbers jobs={jobs} today={today} />
        ) : !jobs ? (
          <p className="animate-pulse text-center text-sm text-muted">Looking…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pipelineBoard(jobs).map((s) => (
              <div key={s.stage} className="rounded-2xl bg-canvas p-3">
                <p className="flex items-baseline justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <span>
                    {s.label} <span className="tabular-nums">{s.count}</span>
                  </span>
                  {s.value > 0 && <span className="tabular-nums normal-case tracking-normal">{dollars(s.value)}</span>}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {s.jobs.map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`${PATHS.deals}/${j.id}`}
                        className="block rounded-xl bg-surface px-3 py-2 ring-1 ring-line hover:ring-sun-line"
                      >
                        <span className="block truncate text-[13px] font-medium text-ink">{j.customerName}</span>
                        <span className="block truncate text-[12px] text-ink-2">
                          {[j.title, j.value ? dollars(j.value) : null, j.kw ? `${j.kw} kW` : null].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {s.count === 0 && <li className="px-1 text-[12px] text-muted">None</li>}
                </ul>
                {s.more > 0 && (
                  <Link href={PATHS.pipelines} className="mt-2 block px-1 text-[12px] font-medium text-ink-2 hover:text-ink">
                    {s.more} more
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Sol's box at the foot of Today: a question goes to Sol (the same conversation as his panel), and his answer comes
 * back as a card over the box, so the pad stays in sight. "Open in Sol" carries on in his panel.
 */
function AskSol() {
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; more: boolean } | null>(null);
  const send = async () => {
    const said = text.trim();
    if (said.length < 2 || asking) return;
    setText("");
    setAsking(true);
    setAnswer(null);
    const r = await askSol(said, []);
    setAsking(false);
    if (!r.ok) return setAnswer({ text: r.message, more: false });
    window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    const last = [...r.state.turns].reverse().find((t) => t.role === "sol");
    setAnswer({
      text: last?.text ?? "Done.",
      more: Boolean(last?.charts?.length || last?.diagrams?.length || last?.drafts?.length || last?.reminder),
    });
  };
  return (
    <div className="sticky bottom-0 z-10 bg-gradient-to-t from-canvas from-70% to-transparent pb-5 pt-6 print:hidden">
      {(asking || answer) && (
        <div className="mx-auto mb-2 max-h-64 max-w-3xl overflow-y-auto rounded-2xl bg-surface p-4 text-sm text-ink shadow-[0_8px_30px_rgba(20,22,26,0.12)] ring-1 ring-line">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-ink">
            <SolIcon className="size-3.5 text-sun-line" aria-hidden /> Sol
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(SOL_TOGGLE))}
              className="ml-auto text-[12px] font-medium normal-case tracking-normal text-ink-2 underline-offset-4 hover:underline"
            >
              Open in Sol
            </button>
            {answer && (
              <button type="button" onClick={() => setAnswer(null)} aria-label="Close" className="text-muted hover:text-ink">
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          {asking ? (
            <SolThinking />
          ) : (
            <p className="whitespace-pre-wrap">
              {answer?.text}
              {answer?.more && <span className="mt-1 block text-xs text-muted">There is more with it in your conversation with Sol.</span>}
            </p>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl bg-surface p-2 pl-4 shadow-[var(--shadow-soft)] ring-1 ring-line focus-within:ring-sun-line"
      >
        <SolIcon className="size-4 shrink-0 text-sun-line" aria-hidden />
        <label htmlFor="today-ask" className="sr-only">
          Ask Sol
        </label>
        <input
          id="today-ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          autoComplete="off"
          placeholder="Ask Sol about your deals, your day, or what to say to a customer"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={asking || text.trim().length < 2}
          aria-label="Ask Sol"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-sun-line text-white disabled:bg-surface-2 disabled:text-muted"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
