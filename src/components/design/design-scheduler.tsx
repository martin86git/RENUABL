"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { CAPACITY_WEEKS, capacityWeeks, type CapacityWeek } from "@/lib/domain/design/approvals";
import { calendarDays, holidayOn, isWeekend, type CalendarView } from "@/lib/domain/design/schedule";
import { addDaysISO } from "@/lib/domain/scheduling";
import { todayInMarket } from "@/lib/domain/market";
import { loadPrefs, loadSchedule, type BookedJob } from "@/lib/services/after-sale";
import { PATHS, PageHead, ui } from "./design-shell";
import { EventCard } from "./event-card";
import { JobCardDialog } from "./job-card";
import { Segmented } from "./segmented";

const ARROW =
  "inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-ink-2 hover:bg-surface-2";
const TONE = { ready: "border-positive bg-positive-soft", partly: "border-sun-line bg-sun", not: "border-line bg-surface-2" } as const;

/**
 * /design/installations as a calendar (Calendar | List). Every booked
 * installation on a month or a week, each marked with whether it is ready to
 * go (the stock ordered, the deposit in): green when both, amber when one.
 * Dates are set on the deal or in the Installations list. Whether customers
 * are reminded before their day is shown, with the way to switch it on.
 */
export function SchedulerPage({ switcher }: { switcher?: React.ReactNode }) {
  const today = todayInMarket();
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(today);
  const [jobs, setJobs] = useState<BookedJob[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reminders, setReminders] = useState<{ on: boolean; days: number } | null>(null);
  /** The job whose job card is open (Primero's: an installation opens its job card), and whose calendar event. */
  const [open, setOpen] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);
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
  // The next six weeks' capacity: installations booked against what the business can do in a week.
  const [capacity, setCapacity] = useState<CapacityWeek[] | null>(null);
  useEffect(() => {
    void (async () => {
      const prefs = await loadPrefs();
      if (!prefs.ok) return;
      setReminders({ on: prefs.prefs.automations.installReminders, days: prefs.prefs.reminderDaysBefore });
      const now = new Date();
      const from = capacityWeeks([], 1, now)[0].monday;
      const booked = await loadSchedule(from, addDaysISO(from, CAPACITY_WEEKS * 7 - 1));
      if (booked.ok)
        setCapacity(
          capacityWeeks(
            booked.jobs.map((j) => j.date),
            prefs.prefs.weeklyCapacity,
            now,
          ),
        );
    })();
  }, []);

  const on = (d: string) => (jobs ?? []).filter((j) => j.date === d);
  const inView = jobs?.length ?? 0;
  const ready = (jobs ?? []).filter((j) => j.state === "ready").length;

  return (
    <div className={ui.page}>
      <PageHead title="Installations">{switcher}</PageHead>
      {/* Where you are in time on the left (the arrows either side of the month, Today once you've moved away); how
          much of it to show on the right. Kept apart from the Calendar | List switch above (8 Nov 2026, Martin). */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className={ARROW} onClick={() => setDate(cal.prev)} aria-label={`Earlier ${view}`}>
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-[10.5rem] text-center text-[19px] tracking-tight text-ink" aria-live="polite">
            {cal.title}
          </p>
          <button type="button" className={ARROW} onClick={() => setDate(cal.next)} aria-label={`Later ${view}`}>
            <ChevronRight className="size-4" />
          </button>
          {!cal.days.includes(today) && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-sun-ink ring-1 ring-sun-line hover:bg-sun"
            >
              <CalendarCheck className="size-3.5" aria-hidden />
              Back to today
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[13px] text-muted">
            {jobs ? `${inView} ${inView === 1 ? "installation" : "installations"} in view, ${ready} ready to go` : "Loading…"}
          </p>
          <Segmented
            label="Show a month or a week"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
            ]}
          />
        </div>
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
      {capacity && (
        <div className="mt-3 flex flex-wrap items-stretch gap-2" aria-label="Capacity, booked against what you can do">
          <p className="flex flex-col justify-center pr-1 text-[11px] leading-tight text-muted">
            Capacity
            <span>booked / can do</span>
          </p>
          {capacity.map((w) => {
            const shown = cal.days.includes(w.monday);
            return (
              <button
                key={w.monday}
                type="button"
                onClick={() => {
                  setView("week");
                  setDate(w.monday);
                }}
                title={`${w.label}: ${w.booked} booked, room for ${Math.max(0, w.canDo - w.booked)} more`}
                className={clsx(
                  "min-w-[5.5rem] flex-1 rounded-md bg-surface px-2.5 py-1.5 text-left ring-1 hover:ring-forest",
                  shown ? "ring-ink" : "ring-line",
                )}
              >
                <span className="block text-[11px] text-muted">{w.label}</span>
                <span className={clsx("block text-sm font-medium tabular-nums", w.full ? "text-positive" : "text-ink")}>
                  {w.booked} / {w.canDo}
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className={clsx("block h-full rounded-full", w.full ? "bg-positive" : "bg-ink")}
                    style={{ width: `${Math.min(100, (w.booked / w.canDo) * 100)}%` }}
                  />
                </span>
              </button>
            );
          })}
          <Link
            href={`${PATHS.settings}/installers`}
            className="self-center text-xs text-muted underline underline-offset-4 hover:text-ink"
          >
            Change
          </Link>
        </div>
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
          Set a date on the deal, or in the{" "}
          <Link href={`${PATHS.installations}?view=list`} className={ui.link}>
            list
          </Link>
          .
        </span>
      </p>
      {open && (
        <JobCardDialog
          jobId={open}
          onClose={() => setOpen(null)}
          onEvent={() => {
            setEvent(open);
            setOpen(null);
          }}
        />
      )}
      {event && <EventCard jobId={event} onClose={() => setEvent(null)} />}
    </div>
  );
}
