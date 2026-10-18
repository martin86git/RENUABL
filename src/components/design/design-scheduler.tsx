"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { calendarDays, holidayOn, isWeekend, type CalendarView } from "@/lib/domain/design/schedule";
import { todayInMarket } from "@/lib/domain/market";
import { loadPrefs, loadSchedule, type BookedJob } from "@/lib/services/after-sale";
import { PATHS, PageHead, ui } from "./design-shell";
import { EventCard } from "./event-card";

const ARROW = "inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:border-forest";
const TONE = { ready: "border-positive bg-positive-soft", partly: "border-sun-line bg-sun", not: "border-line bg-surface-2" } as const;

/**
 * /design/installations/scheduler: the Install Scheduler. Every booked
 * installation on a month or a week, each marked with whether it is ready to
 * go (the stock ordered, the deposit in): green when both, amber when one.
 * Dates are set on the deal or in the Installations list. Whether customers
 * are reminded before their day is shown, with the way to switch it on.
 */
export function SchedulerPage() {
  const today = todayInMarket();
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(today);
  const [jobs, setJobs] = useState<BookedJob[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reminders, setReminders] = useState<{ on: boolean; days: number } | null>(null);
  /** The job whose event card is open. */
  const [open, setOpen] = useState<string | null>(null);
  const cal = calendarDays(view, date);
  const first = cal.days[0];
  const last = cal.days.at(-1)!;

  useEffect(() => {
    let gone = false;
    void loadSchedule(first, last).then((res) => {
      if (gone) return;
      if (res.ok) {
        setJobs(res.jobs);
        setProblem(null);
      } else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [first, last]);
  useEffect(() => {
    void loadPrefs().then(
      (res) => res.ok && setReminders({ on: res.prefs.automations.installReminders, days: res.prefs.reminderDaysBefore }),
    );
  }, []);

  const on = (d: string) => (jobs ?? []).filter((j) => j.date === d);
  const inView = jobs?.length ?? 0;
  const ready = (jobs ?? []).filter((j) => j.state === "ready").length;

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Installations" title="Install Scheduler">
        <div className="flex items-center gap-1">
          <button type="button" className={ARROW} onClick={() => setDate(cal.prev)} aria-label="Earlier">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className={clsx(ui.quiet, "h-9")} onClick={() => setDate(today)}>
            Today
          </button>
          <button type="button" className={ARROW} onClick={() => setDate(cal.next)} aria-label="Later">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex rounded-md border border-line p-0.5" role="radiogroup" aria-label="View">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={clsx(
                "h-8 rounded px-3 text-sm capitalize",
                view === v ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </PageHead>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[19px] tracking-tight text-ink">{cal.title}</p>
        <p className="text-sm text-ink-2">
          {jobs ? `${inView} ${inView === 1 ? "installation" : "installations"} in view, ${ready} ready to go` : "Loading…"}
        </p>
      </div>
      {reminders && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-4 py-2.5 text-sm text-ink-2">
          <Bell className="size-4 text-sun-line" aria-hidden />
          {reminders.on
            ? `Customers are emailed ${reminders.days} ${reminders.days === 1 ? "day" : "days"} before their installation, with how to get ready.`
            : "Customers aren't reminded before their installation."}
          <Link href={`${PATHS.settings}/automations`} className={ui.link}>
            {reminders.on ? "Change" : "Switch reminders on"}
          </Link>
        </p>
      )}
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <div className={clsx("grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-lg border border-line bg-line", "gap-px")}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-surface px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {d}
            </div>
          ))}
          {cal.days.map((d) => {
            const outside = view === "month" && d.slice(0, 7) !== date.slice(0, 7);
            const holiday = holidayOn(d);
            return (
              <div
                key={d}
                className={clsx(
                  "flex flex-col gap-1 p-1.5",
                  view === "week" ? "min-h-64" : "min-h-28",
                  outside || isWeekend(d) ? "bg-surface-2" : "bg-surface",
                )}
              >
                <p
                  className={clsx(
                    "text-xs tabular-nums",
                    d === today ? "font-semibold text-sun-line" : outside ? "text-muted" : "text-ink-2",
                  )}
                >
                  {Number(d.slice(8))}
                  {holiday && <span className="ml-1 text-[10px] text-muted">{holiday}</span>}
                </p>
                {on(d).map((j) => (
                  <button
                    type="button"
                    key={j.jobId}
                    onClick={() => setOpen(j.jobId)}
                    className={clsx(
                      "rounded border-l-[3px] px-1.5 py-1 text-left text-[12px] leading-tight hover:brightness-95",
                      TONE[j.state],
                    )}
                    title={j.checks.map((c) => `${c.label}: ${c.value}`).join(" · ")}
                  >
                    <span className="block truncate font-medium text-ink">{j.customer}</span>
                    {view === "week" && <span className="block truncate text-[11px] text-ink-2">{j.address}</span>}
                    <span className="mt-0.5 flex gap-1">
                      {j.checks.map((c) => (
                        <span key={c.key} className={clsx("size-1.5 rounded-full", c.done ? "bg-positive" : "bg-muted")} aria-hidden />
                      ))}
                      {view === "week" && (
                        <span className="ml-1 text-[10.5px] text-muted">{j.checks.map((c) => `${c.label}: ${c.value}`).join(" · ")}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-positive" /> Ready: stock ordered, deposit in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sun-line" /> One of the two
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" /> Neither yet
        </span>
        <span>
          Set a date on the deal, or in{" "}
          <Link href={PATHS.installations} className={ui.link}>
            In the works
          </Link>
          .
        </span>
      </p>
      {open && <EventCard jobId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
