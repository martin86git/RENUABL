"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarCheck, CalendarClock, CalendarX, ChevronLeft, ChevronRight, Plus, StickyNote, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { CAPACITY_WEEKS, capacityWeeks, type CapacityWeek } from "@/lib/domain/design/approvals";
import {
  ENTRY_WORDS,
  entriesOn,
  entryLabel,
  tentativeInWeek,
  type CalendarEntry,
  type EntryInput,
  type EntryKind,
} from "@/lib/domain/design/calendar-entries";
import { calendarDays, holidayOn, isWeekend, type CalendarView } from "@/lib/domain/design/schedule";
import { addDaysISO } from "@/lib/domain/scheduling";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { loadPrefs, loadSchedule, type BookedJob } from "@/lib/services/after-sale";
import { addEntry, loadEntries, removeEntry, saveEntry } from "@/lib/services/calendar-entries";
import { listJobs, type JobLine } from "@/lib/services/crm";
import { PATHS, ui } from "./design-shell";
import { EventCard } from "./event-card";
import { JobCardDialog } from "./job-card";
import { Segmented } from "./segmented";

const ARROW =
  "inline-flex size-8 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-ink-2 hover:bg-surface-2";
const TONE = { ready: "border-positive bg-positive-soft", partly: "border-sun-line bg-sun", not: "border-line bg-surface-2" } as const;
const KIND_ICON = { tentative: CalendarClock, off: CalendarX, note: StickyNote } as const;
/** How each kind of entry looks on a day: a tentative install dashed in the signal colour, a day off greyed, a note plain. */
const ENTRY_TONE: Record<EntryKind, string> = {
  tentative: "border border-dashed border-sun-line bg-surface text-ink",
  off: "bg-surface-2 text-muted ring-1 ring-line",
  note: "bg-surface text-ink-2 ring-1 ring-line",
};

type Editing = { id: string | null; entry: EntryInput };
const blank = (day: ISODate): EntryInput => ({ kind: "tentative", from: day, to: day, title: "", note: "", who: "", jobId: null });

/**
 * /design/installations as a calendar (Calendar | List). Every booked installation on a month or a week, each marked
 * with whether it is ready to go (the stock ordered, the deposit in): green when both, amber when one. Beside them, the
 * entries put on it by hand (10 Nov 2026, Martin): tentative installs, days off, notes, made by clicking a day.
 * One toolbar row and a slim capacity strip, so more of the month is in view.
 */
export function SchedulerPage({ switcher }: { switcher?: React.ReactNode }) {
  const today = todayInMarket();
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(today);
  const [jobs, setJobs] = useState<BookedJob[] | null>(null);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [reminders, setReminders] = useState<{ on: boolean; days: number } | null>(null);
  /** The job whose job card is open (Primero's: an installation opens its job card), and whose calendar event. */
  const [open, setOpen] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const cal = calendarDays(view, date);
  const first = cal.days[0];
  const last = cal.days.at(-1)!;

  useEffect(() => {
    let gone = false;
    void Promise.all([loadSchedule(first, last), loadEntries(first, last)]).then(([res, made]) => {
      if (gone) return;
      if (res.ok) {
        setJobs(res.jobs);
        setProblem(null);
      } else setProblem(res.message);
      if (made.ok) setEntries(made.entries);
    });
    return () => {
      gone = true;
    };
  }, [first, last]);
  // The next six weeks' capacity: installations booked against what the business can do in a week.
  const [capacity, setCapacity] = useState<CapacityWeek[] | null>(null);
  const [ahead, setAhead] = useState<CalendarEntry[]>([]);
  const [capacityFrom, setCapacityFrom] = useState<ISODate | null>(null);
  useEffect(() => {
    void (async () => {
      const prefs = await loadPrefs();
      if (!prefs.ok) return;
      setReminders({ on: prefs.prefs.automations.installReminders, days: prefs.prefs.reminderDaysBefore });
      const now = new Date();
      const from = capacityWeeks([], 1, now)[0].monday;
      setCapacityFrom(from);
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
  // The tentative installs in the capacity weeks, read again whenever an entry changes.
  useEffect(() => {
    if (!capacityFrom) return;
    void loadEntries(capacityFrom, addDaysISO(capacityFrom, CAPACITY_WEEKS * 7 - 1)).then((r) => r.ok && setAhead(r.entries));
  }, [capacityFrom, entries]);

  const on = (d: string) => (jobs ?? []).filter((j) => j.date === d);
  const inView = jobs?.length ?? 0;
  const ready = (jobs ?? []).filter((j) => j.state === "ready").length;
  const tentatives = entries.filter((e) => e.kind === "tentative").length;

  const kept = (saved: CalendarEntry) =>
    setEntries((all) => [...all.filter((e) => e.id !== saved.id), saved].sort((a, b) => a.from.localeCompare(b.from)));

  return (
    <div className={ui.page}>
      {/* One row: the title and where you are in time on the left; what is in view, Month | Week and Calendar | List on
          the right (10 Nov 2026, Martin: fit more of the calendar into view). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-ink">Installations</h1>
          <div className="flex items-center gap-1.5">
            <button type="button" className={ARROW} onClick={() => setDate(cal.prev)} aria-label={`Earlier ${view}`}>
              <ChevronLeft className="size-4" />
            </button>
            <p className="min-w-[9.5rem] text-center text-[17px] tracking-tight text-ink" aria-live="polite">
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-1 text-[12.5px] text-muted">
            {jobs ? `${inView} booked, ${ready} ready${tentatives ? `, ${tentatives} tentative` : ""}` : "Loading…"}
          </p>
          <button
            type="button"
            onClick={() => setEditing({ id: null, entry: blank(cal.days.includes(today) ? today : first) })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Add to calendar
          </button>
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
          {switcher}
        </div>
      </div>

      {/* Capacity and reminders in one slim row. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {capacity && (
          <>
            <span className="pr-1 text-[11px] text-muted" title="Installations booked against what you can do in a week">
              Booked / can do
            </span>
            {capacity.map((w) => {
              const shown = cal.days.includes(w.monday);
              const pencilled = tentativeInWeek(ahead, w.monday);
              return (
                <button
                  key={w.monday}
                  type="button"
                  onClick={() => {
                    setView("week");
                    setDate(w.monday);
                  }}
                  title={`${w.label}: ${w.booked} booked, room for ${Math.max(0, w.canDo - w.booked)} more${pencilled ? `, ${pencilled} tentative` : ""}`}
                  className={clsx(
                    "relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full bg-surface px-3 text-[12px] ring-1 hover:ring-ink-2",
                    shown ? "ring-ink" : "ring-line",
                  )}
                >
                  <span className="text-muted">{w.label}</span>
                  <span className={clsx("font-medium tabular-nums", w.full ? "text-positive" : "text-ink")}>
                    {w.booked}/{w.canDo}
                  </span>
                  {pencilled > 0 && <span className="tabular-nums text-sun-ink">+{pencilled}</span>}
                  <span
                    aria-hidden
                    className={clsx("absolute inset-x-0 bottom-0 h-0.5", w.full ? "bg-positive" : "bg-ink")}
                    style={{ width: `${Math.min(100, (w.booked / w.canDo) * 100)}%` }}
                  />
                </button>
              );
            })}
            <Link href={`${PATHS.settings}/installers`} className="px-1 text-[11px] text-muted underline underline-offset-4 hover:text-ink">
              Change
            </Link>
          </>
        )}
        {reminders && (
          <Link
            href={`${PATHS.settings}/automations`}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] text-ink-2 ring-1 ring-line hover:ring-ink-2"
            title={
              reminders.on
                ? `Customers are emailed ${reminders.days} ${reminders.days === 1 ? "day" : "days"} before their installation.`
                : "Customers aren't reminded before their installation."
            }
          >
            <Bell className={clsx("size-3.5", reminders.on ? "text-positive" : "text-sun-line")} aria-hidden />
            {reminders.on ? `Reminders ${reminders.days} ${reminders.days === 1 ? "day" : "days"} before` : "Reminders off · switch on"}
          </Link>
        )}
      </div>
      {problem && (
        <p className="mt-3 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <div className={clsx("grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-lg border border-line bg-line", "gap-px")}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-surface px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted">
              {d}
            </div>
          ))}
          {cal.days.map((d) => {
            const outside = view === "month" && d.slice(0, 7) !== date.slice(0, 7);
            const holiday = holidayOn(d);
            const made = entriesOn(entries, d);
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                aria-label={`Add to ${d}`}
                onClick={(e) => e.target === e.currentTarget && setEditing({ id: null, entry: blank(d) })}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                    e.preventDefault();
                    setEditing({ id: null, entry: blank(d) });
                  }
                }}
                className={clsx(
                  "group relative flex cursor-pointer flex-col gap-0.5 p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sun-line",
                  view === "week" ? "min-h-64" : "min-h-[5.25rem]",
                  outside || isWeekend(d) ? "bg-surface-2" : "bg-surface",
                )}
              >
                <p
                  className={clsx(
                    "pointer-events-none flex items-center text-[11.5px] tabular-nums",
                    d === today ? "font-semibold text-sun-line" : outside ? "text-muted" : "text-ink-2",
                  )}
                >
                  {Number(d.slice(8))}
                  {holiday && <span className="ml-1 truncate text-[10px] font-normal text-muted">{holiday}</span>}
                  <Plus className="ml-auto size-3.5 text-muted opacity-0 group-hover:opacity-100" aria-hidden />
                </p>
                {on(d).map((j) => (
                  <button
                    type="button"
                    key={j.jobId}
                    onClick={() => setOpen(j.jobId)}
                    className={clsx(
                      "rounded border-l-[3px] px-1.5 py-0.5 text-left text-[12px] leading-tight hover:brightness-95",
                      TONE[j.state],
                    )}
                    title={j.checks.map((c) => `${c.label}: ${c.value}`).join(" · ")}
                  >
                    <span className="flex items-center gap-1">
                      <span className="truncate font-medium text-ink">{j.customer}</span>
                      <span className="ml-auto flex shrink-0 gap-0.5">
                        {j.checks.map((c) => (
                          <span key={c.key} className={clsx("size-1.5 rounded-full", c.done ? "bg-positive" : "bg-muted")} aria-hidden />
                        ))}
                      </span>
                    </span>
                    {view === "week" && (
                      <>
                        <span className="block truncate text-[11px] text-ink-2">{j.address}</span>
                        <span className="block text-[10.5px] text-muted">{j.checks.map((c) => `${c.label}: ${c.value}`).join(" · ")}</span>
                      </>
                    )}
                  </button>
                ))}
                {made.map((e) => {
                  const Icon = KIND_ICON[e.kind];
                  return (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => setEditing({ id: e.id, entry: e })}
                      className={clsx(
                        "flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-[12px] leading-tight",
                        ENTRY_TONE[e.kind],
                      )}
                      title={`${ENTRY_WORDS[e.kind].label}${e.note ? `: ${e.note}` : ""}`}
                    >
                      <Icon className={clsx("size-3 shrink-0", e.kind === "tentative" ? "text-sun-line" : "")} aria-hidden />
                      <span className="truncate">
                        {e.from !== d && "↳ "}
                        {entryLabel(e)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-positive" /> Ready: stock ordered, deposit in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sun-line" /> One of the two
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" /> Neither yet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-sun-line" /> Tentative
        </span>
        <span>Click a day to add a tentative install, a day off or a note. Booked dates are set on the deal.</span>
      </p>
      {editing && (
        <EntryEditor
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            kept(saved);
            setEditing(null);
          }}
          onRemoved={(id) => {
            setEntries((all) => all.filter((e) => e.id !== id));
            setEditing(null);
          }}
        />
      )}
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

const field = "mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-ink-2 focus:outline-none";
const label = "block text-[12px] font-medium text-ink-2";

/** Making or changing an entry: its kind, its days, a deal for a tentative install, who, words and a note. */
function EntryEditor({
  editing,
  onClose,
  onSaved,
  onRemoved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: (e: CalendarEntry) => void;
  onRemoved: (id: string) => void;
}) {
  const [entry, setEntry] = useState<EntryInput>(editing.entry);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [deals, setDeals] = useState<JobLine[] | null>(null);
  const set = (change: Partial<EntryInput>) => setEntry((e) => ({ ...e, ...change }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // The deals a tentative install can be pencilled in for: those still open or sold, not yet installed.
  useEffect(() => {
    if (entry.kind !== "tentative" || deals) return;
    void listJobs().then((r) => setDeals(r.ok ? r.jobs : []));
  }, [entry.kind, deals]);
  const choices = useMemo(
    () =>
      (deals ?? [])
        .filter((j) => ["lead", "designed", "proposal", "won", "ordered", "scheduled"].includes(j.stage) || j.id === entry.jobId)
        .sort((a, b) => a.customerName.localeCompare(b.customerName)),
    [deals, entry.jobId],
  );

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const res = editing.id ? await saveEntry(editing.id, entry) : await addEntry(entry);
    setBusy(false);
    if (res.ok) onSaved(res.entry);
    else setProblem(res.message);
  };
  const remove = async () => {
    if (!editing.id) return;
    setBusy(true);
    const res = await removeEntry(editing.id);
    setBusy(false);
    if (res.ok) onRemoved(editing.id);
    else setProblem(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 p-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing.id ? "Change this entry" : "Add to the calendar"}
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-lift ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-ink">{editing.id ? "Change this entry" : "Add to the calendar"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3">
          <Segmented
            label="What kind of entry"
            size="sm"
            value={entry.kind}
            onChange={(kind) => set({ kind, jobId: kind === "tentative" ? entry.jobId : null })}
            options={[
              { value: "tentative", label: "Tentative", icon: CalendarClock },
              { value: "off", label: "Day off", icon: CalendarX },
              { value: "note", label: "Note", icon: StickyNote },
            ]}
          />
          <p className="mt-1.5 text-[12px] text-muted">{ENTRY_WORDS[entry.kind].hint}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={label}>
            {entry.from === entry.to ? "Day" : "First day"}
            <input
              type="date"
              value={entry.from}
              onChange={(e) =>
                e.target.value &&
                set({ from: e.target.value as ISODate, to: e.target.value > entry.to ? (e.target.value as ISODate) : entry.to })
              }
              className={field}
            />
          </label>
          <label className={label}>
            Last day
            <input
              type="date"
              value={entry.to}
              min={entry.from}
              onChange={(e) => e.target.value && set({ to: e.target.value as ISODate })}
              className={field}
            />
          </label>
        </div>
        {entry.kind === "tentative" && (
          <label className={clsx(label, "mt-3")}>
            For a deal (optional)
            <select value={entry.jobId ?? ""} onChange={(e) => set({ jobId: e.target.value || null })} className={field}>
              <option value="">{deals ? "No deal yet" : "Loading deals…"}</option>
              {choices.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.customerName} · {(j.address || j.title).split(",")[0]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={label}>
            {entry.kind === "off" ? "Who's away" : entry.kind === "tentative" ? "Installer" : "Who"}
            <input
              value={entry.who}
              onChange={(e) => set({ who: e.target.value })}
              placeholder={entry.kind === "off" ? "Sam, or the whole crew" : "Optional"}
              maxLength={60}
              className={field}
            />
          </label>
          <label className={label}>
            {entry.kind === "note" ? "Words on the calendar" : "Label (optional)"}
            <input
              value={entry.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={entry.kind === "note" ? "Crane booked" : ENTRY_WORDS[entry.kind].label}
              maxLength={80}
              className={field}
            />
          </label>
        </div>
        <label className={clsx(label, "mt-3")}>
          Note (optional)
          <textarea value={entry.note} onChange={(e) => set({ note: e.target.value })} rows={2} maxLength={500} className={field} />
        </label>
        {problem && (
          <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning" role="alert">
            {problem}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          {editing.id && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-4" aria-hidden />
              Remove
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto h-9 rounded-full px-3.5 text-[13px] text-ink-2 hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-muted"
          >
            {busy ? "Saving…" : editing.id ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
