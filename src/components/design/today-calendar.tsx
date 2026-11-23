"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Grid3x3, HardHat, List, RectangleVertical, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import type { ISODate } from "@/lib/domain/types";
import {
  CAL_KEY,
  CAL_VIEWS,
  CAL_VIEW_WORDS,
  cleanKept,
  dayLabel,
  installEvents,
  mineEvents,
  monthHeading,
  scheduleList,
  stepDay,
  viewDays,
  type CalEvent,
  type CalKept,
  type CalSource,
  type CalView,
} from "@/lib/domain/design/calendar-view";
import {
  CALENDAR_PROVIDERS,
  CALENDAR_WORDS,
  CONNECT_RESULTS,
  dayLayout,
  eventTime,
  eventsOn,
  marketMinutes,
  providerName,
  type CalendarProvider,
} from "@/lib/domain/design/my-calendar";
import type { JobLine } from "@/lib/services/crm";
import { connectMyCalendar, disconnectMyCalendar, loadMyCalendar, type CalendarAnswer } from "@/lib/services/my-calendar";

const HOUR_PX = 52;
const VIEW_ICONS = { schedule: List, day: RectangleVertical, month: Grid3x3 } as const;
/** Each calendar's colour: the member's own in the signal orange, installs in the confirmed green. */
const COLOUR: Record<CalSource, string> = { mine: "bg-sun-line text-white", installs: "bg-positive text-white" };
const TICK: Record<CalSource, string> = { mine: "bg-sun-line", installs: "bg-positive" };
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Today's calendar, after Google Calendar's app (23 Nov 2026, Martin: "Calendar should look like Google calendar app").
 * The month with its dropdown and a round to come back to today across the top; the menu opens a drawer of views
 * (Schedule, Day, Month) and the calendars, switched on or off: the member's own Google Calendar or Outlook, and the
 * business's installs. Swiping sideways moves a day, three days or a month. Read only: an event opens in its own
 * calendar, an install opens its deal.
 */
export function TodayCalendar({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const path = usePathname();
  const [kept, setKeptState] = useState<CalKept>({ view: "day", hidden: [] });
  useEffect(() => {
    try {
      const k = cleanKept(JSON.parse(window.localStorage.getItem(CAL_KEY) ?? "null"));
      // A remembered choice is only known in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKeptState(k);
    } catch {
      // Nothing kept: Day, both calendars.
    }
  }, []);
  const keep = (k: CalKept) => {
    setKeptState(k);
    try {
      window.localStorage.setItem(CAL_KEY, JSON.stringify(k));
    } catch {
      // Not kept: fine.
    }
  };
  const view = kept.view;
  const shows = (s: CalSource) => !kept.hidden.includes(s);
  const [day, setDay] = useState<ISODate>(today);
  const [drawer, setDrawer] = useState(false);
  const [picker, setPicker] = useState(false);
  const [got, setGot] = useState<CalendarAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<CalendarProvider | null>(null);
  const [asked, setAsked] = useState(0);

  // Ask for the whole month around the day (and Schedule's weeks ahead), so moving within it asks nothing more.
  const span = useMemo(() => {
    const days = [...viewDays("month", day), ...viewDays(view === "schedule" ? "schedule" : "day", day)].sort();
    return { from: days[0], to: days[days.length - 1] };
  }, [day, view]);
  useEffect(() => {
    let gone = false;
    void loadMyCalendar(span.from, span.to).then((r) => {
      if (gone) return;
      if (r.ok) setGot(r);
      else setProblem(r.message);
    });
    return () => {
      gone = true;
    };
  }, [span.from, span.to, asked]);
  const stopWaiting = useRef<() => void>(() => undefined);
  useEffect(() => () => stopWaiting.current(), []);
  const connect = (provider: CalendarProvider) => {
    stopWaiting.current();
    setProblem(null);
    setWaiting(provider);
    stopWaiting.current = connectMyCalendar(provider, path, (result) => {
      setWaiting(null);
      setProblem(CONNECT_RESULTS[result] ?? null);
      if (result === "connected") setAsked((n) => n + 1);
    });
  };
  const disconnect = async () => {
    const r = await disconnectMyCalendar();
    if (!r.ok) return setProblem(r.message);
    setGot({ connected: false, events: [] });
  };

  const events: CalEvent[] = useMemo(
    () => [...(shows("mine") && got?.connected ? mineEvents(got.events) : []), ...(shows("installs") && jobs ? installEvents(jobs) : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [got, jobs, kept.hidden],
  );
  const mineMissing = shows("mine") && got && !got.connected && !got.viewing;

  // A swipe sideways moves on or back (Google's own way of getting about).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }),
    onTouchEnd: (e: React.TouchEvent) => {
      const t = touch.current;
      touch.current = null;
      if (!t) return;
      const dx = e.changedTouches[0].clientX - t.x;
      const dy = e.changedTouches[0].clientY - t.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setDay(stepDay(view, day, dx < 0 ? 1 : -1));
    },
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl pb-6 pt-2">
      {/* The bar: the menu, the month with its dropdown, and today's round. */}
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Calendar settings"
          className="flex size-10 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line"
        >
          <SlidersHorizontal className="size-[17px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPicker((p) => !p)}
          aria-expanded={picker}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[20px] font-normal tracking-[-0.01em] text-ink"
        >
          {monthHeading(day, today)}
          <ChevronDown className={clsx("size-4 transition-transform", picker && "rotate-180")} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            setDay(today);
            setPicker(false);
          }}
          aria-label="Back to today"
          title="Today"
          className="relative ml-auto flex size-10 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line"
        >
          <CalendarDays className="size-[22px] text-ink-2" strokeWidth={1.4} aria-hidden />
          <span className="absolute pt-[5px] text-[9px] font-semibold tabular-nums">{Number(today.slice(8))}</span>
        </button>
      </div>

      {picker && (
        <MonthPicker
          day={day}
          today={today}
          events={events}
          onPick={(d) => {
            setDay(d);
            setPicker(false);
          }}
          onMonth={(d) => setDay(d)}
        />
      )}

      {mineMissing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-line">
          <span className="flex-1 text-[13px] text-ink-2">See your own appointments here too.</span>
          {CALENDAR_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={waiting !== null}
              onClick={() => connect(p.id)}
              className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white disabled:bg-line disabled:text-muted"
            >
              {waiting === p.id ? "Connecting…" : p.name}
            </button>
          ))}
        </div>
      )}
      {got?.broken && shows("mine") && (
        <p className="mt-3 rounded-2xl bg-surface px-3 py-2.5 text-[13px] text-ink-2 ring-1 ring-line">
          {CALENDAR_WORDS.broken}{" "}
          <button type="button" onClick={() => got.provider && connect(got.provider)} className="font-medium text-ink underline">
            Connect again
          </button>
        </p>
      )}
      {problem && <p className="mt-2 px-1 text-[12px] text-sun-ink">{problem}</p>}

      <div className="mt-3" {...swipe}>
        {view === "schedule" ? (
          <Schedule events={events} from={day} today={today} provider={got?.provider} />
        ) : view === "month" ? (
          <MonthGrid
            events={events}
            day={day}
            today={today}
            onPick={(d) => {
              setDay(d);
              keep({ ...kept, view: "day" });
            }}
          />
        ) : (
          <Hours days={viewDays(view, day)} events={events} today={today} provider={got?.provider} />
        )}
      </div>

      {drawer && (
        <Drawer
          kept={kept}
          got={got}
          waiting={waiting}
          onView={(v) => {
            keep({ ...kept, view: v });
            setDrawer(false);
          }}
          onToggle={(s) => keep({ ...kept, hidden: kept.hidden.includes(s) ? kept.hidden.filter((h) => h !== s) : [...kept.hidden, s] })}
          onConnect={connect}
          onDisconnect={() => void disconnect()}
          onClose={() => setDrawer(false)}
        />
      )}
    </div>
  );
}

/**
 * The calendar's settings, as a sheet rising from the foot (23 Nov 2026, Martin: the drawer looked too much like
 * Google's): a graphite head, the views as three tiles, then each calendar with its colour and a switch.
 */
function Drawer(props: {
  kept: CalKept;
  got: CalendarAnswer | null;
  waiting: CalendarProvider | null;
  onView: (v: CalView) => void;
  onToggle: (s: CalSource) => void;
  onConnect: (p: CalendarProvider) => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [props]);
  const got = props.got;
  const calendars: { id: CalSource; name: string; sub: string }[] = [
    {
      id: "mine",
      name: "My calendar",
      sub: got?.connected ? `${providerName(got.provider ?? "google")} · ${got.address ?? ""}` : "Not connected yet",
    },
    { id: "installs", name: "Installs", sub: "Every booked install, 8 am to 4 pm" },
  ];
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center sm:items-center" role="dialog" aria-label="Calendar settings">
      <button type="button" aria-label="Close" onClick={props.onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[28px] bg-canvas pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-white">
          <span className="flex items-center gap-2.5">
            <CalendarDays className="size-[18px] text-sun-line" aria-hidden />
            <span className="text-[16px] font-semibold">Calendar</span>
          </span>
          <button type="button" onClick={props.onClose} aria-label="Close" className="rounded-full p-1.5 text-white/80 hover:bg-white/10">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <p className="px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">View</p>
        <div className="grid grid-cols-3 gap-2 px-4">
          {CAL_VIEWS.map((v) => {
            const Icon = VIEW_ICONS[v];
            const on = props.kept.view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => props.onView(v)}
                aria-pressed={on}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-medium transition-colors",
                  on ? "bg-primary text-white shadow-md" : "bg-surface text-ink ring-1 ring-line hover:ring-ink/20",
                )}
              >
                <Icon className={clsx("size-5", on ? "text-sun-line" : "text-ink-2")} strokeWidth={1.7} aria-hidden />
                {CAL_VIEW_WORDS[v]}
              </button>
            );
          })}
        </div>

        <p className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Show</p>
        <div className="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {calendars.map((c) => {
            const on = !props.kept.hidden.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => props.onToggle(c.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className={clsx("size-2.5 shrink-0 rounded-full", TICK[c.id])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium text-ink">{c.name}</span>
                  <span className="block truncate text-[12px] text-muted">{c.sub}</span>
                </span>
                <span
                  className={clsx("relative h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-line")}
                  aria-hidden
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
                      on ? "left-[1.125rem]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-5 pt-4 text-[13px]">
          {got?.connected ? (
            <button type="button" onClick={props.onDisconnect} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">
              Disconnect my calendar
            </button>
          ) : got?.viewing ? (
            <p className="text-muted">{CALENDAR_WORDS.viewing}</p>
          ) : (
            <>
              <p className="pb-2 text-[12px] text-muted">Connect your own calendar to see your appointments here.</p>
              <div className="grid grid-cols-2 gap-2">
                {CALENDAR_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={props.waiting !== null}
                    onClick={() => props.onConnect(p.id)}
                    className="rounded-full bg-primary px-3 py-2 text-[13px] font-medium text-white disabled:bg-line disabled:text-muted"
                  >
                    {props.waiting === p.id ? "Connecting…" : p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** One event as a solid block in its calendar's colour; mine opens in its calendar, an install its deal. */
function EventBox(props: { event: CalEvent; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const e = props.event;
  const cls = clsx(COLOUR[e.source], props.className);
  if (!e.href)
    return (
      <span className={cls} style={props.style}>
        {props.children}
      </span>
    );
  return e.source === "installs" ? (
    <Link href={e.href} className={cls} style={props.style}>
      {props.children}
    </Link>
  ) : (
    <a href={e.href} target="_blank" rel="noreferrer noopener" className={cls} style={props.style}>
      {props.children}
    </a>
  );
}

/** Day: the days' headers, their all-day events, then the hours with each event at its time. */
function Hours(props: { days: ISODate[]; events: CalEvent[]; today: ISODate; provider?: CalendarProvider }) {
  const box = useRef<HTMLDivElement>(null);
  const layouts = props.days.map((d) => dayLayout(props.events, d));
  const firstFrom = Math.min(...layouts.map((l) => l[0]?.from ?? 24 * 60));
  const startHour = firstFrom >= 24 * 60 ? 7 : Math.max(0, Math.min(7, Math.floor(firstFrom / 60) - 1));
  const key = props.days.join();
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = startHour * HOUR_PX;
  }, [key, startHour]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(marketMinutes(new Date().toISOString()));
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, []);
  const allDays = props.days.map((d) =>
    eventsOn(props.events, d).filter((e) => !layouts[props.days.indexOf(d)].some((p) => p.event.id === e.id)),
  );
  const cols = `3rem repeat(${props.days.length}, minmax(0, 1fr))`;
  return (
    <div className="overflow-hidden rounded-[22px] bg-surface ring-1 ring-line/70">
      <div className="grid border-b border-line pb-2 pt-3" style={{ gridTemplateColumns: cols }}>
        <span />
        {props.days.map((d, i) => {
          const { weekday, date } = dayLabel(d);
          const isToday = d === props.today;
          return (
            <div key={d} className="min-w-0 px-1">
              <div className={clsx("flex flex-col", props.days.length === 1 ? "items-start" : "items-center")}>
                <span className={clsx("text-[11px] font-medium tracking-wide", isToday ? "text-sun-line" : "text-muted")}>{weekday}</span>
                <span
                  className={clsx(
                    "mt-0.5 flex size-10 items-center justify-center rounded-full text-[20px] tabular-nums",
                    isToday ? "bg-sun-line text-white" : "text-ink",
                  )}
                >
                  {date}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {allDays[i].map((e) => (
                  <li key={e.id}>
                    <EventBox event={e} className="block truncate rounded-md px-2 py-1 text-[12px] font-medium">
                      {e.title}
                    </EventBox>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div ref={box} className="relative h-[min(62dvh,36rem)] overflow-y-auto overscroll-contain" aria-label="By the hour">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="pointer-events-none absolute inset-x-0 flex" style={{ top: h * HOUR_PX }}>
              <span className="w-12 shrink-0 -translate-y-2 pr-2 text-right text-[11px] tabular-nums text-muted">
                {h === 0 ? "" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`}
              </span>
              <span className="flex-1 border-t border-line/80" />
            </div>
          ))}
          <span />
          {props.days.map((d, i) => (
            <div key={d} className={clsx("relative", i > 0 && "border-l border-line/60")}>
              {layouts[i].map((p) => {
                const e = p.event as CalEvent;
                const height = ((p.to - p.from) / 60) * HOUR_PX;
                return (
                  <EventBox
                    key={e.id}
                    event={e}
                    className="absolute overflow-hidden rounded-md px-1.5 py-1 text-[12px] leading-tight ring-1 ring-surface"
                    style={{
                      top: (p.from / 60) * HOUR_PX + 1,
                      height: height - 2,
                      left: `calc(${(p.column / p.columns) * 100}% + 2px)`,
                      width: `calc(${100 / p.columns}% - 4px)`,
                    }}
                  >
                    <span className="flex items-start gap-1 font-semibold">
                      {e.source === "installs" && <HardHat className="mt-px size-3 shrink-0" aria-hidden />}
                      <span className="line-clamp-2">{e.title}</span>
                    </span>
                    {height >= 48 && <span className="mt-0.5 block truncate opacity-90">{eventTime(e, d)}</span>}
                    {height >= 70 && e.detail && <span className="block truncate opacity-90">{e.detail}</span>}
                  </EventBox>
                );
              })}
              {d === props.today && now !== null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[1] flex items-center"
                  style={{ top: (now / 60) * HOUR_PX }}
                  aria-hidden
                >
                  <span className="-ml-1.5 size-3 rounded-full bg-sun-line" />
                  <span className="h-0.5 flex-1 bg-sun-line" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Schedule: each day with something on, its date in a round on the left and its events as blocks beside it. */
function Schedule(props: { events: CalEvent[]; from: ISODate; today: ISODate; provider?: CalendarProvider }) {
  const list = scheduleList(props.events, props.from, props.today);
  return (
    <div className="space-y-1">
      {list.map(({ day, events }, i) => {
        const { weekday, date } = dayLabel(day);
        const isToday = day === props.today;
        const m = monthHeading(day, props.today);
        const newMonth = i === 0 || monthHeading(list[i - 1].day, props.today) !== m;
        return (
          <div key={day}>
            {newMonth && <p className="px-2 pb-1 pt-3 text-[15px] font-medium text-ink">{m}</p>}
            <div className="flex gap-3 py-1.5">
              <div className="flex w-12 shrink-0 flex-col items-center">
                <span className={clsx("text-[11px] font-medium", isToday ? "text-sun-line" : "text-muted")}>{weekday}</span>
                <span
                  className={clsx(
                    "flex size-9 items-center justify-center rounded-full text-[18px] tabular-nums",
                    isToday ? "bg-sun-line text-white" : "text-ink",
                  )}
                >
                  {date}
                </span>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 pt-1">
                {events.length === 0 && <li className="px-1 pt-2 text-[13px] text-muted">Nothing on today</li>}
                {events.map((e) => (
                  <li key={e.id}>
                    <EventBox event={e} className="block rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                        {e.source === "installs" && <HardHat className="size-3.5 shrink-0" aria-hidden />}
                        <span className="truncate">{e.title}</span>
                      </span>
                      <span className="block text-[12px] opacity-90">
                        {eventTime(e, day)}
                        {e.detail ? ` · ${e.detail}` : ""}
                      </span>
                    </EventBox>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Month: the weeks as a grid, each day with up to three events as small bars; a day opens it by the hour. */
function MonthGrid(props: { events: CalEvent[]; day: ISODate; today: ISODate; onPick: (d: ISODate) => void }) {
  const days = viewDays("month", props.day);
  const month = props.day.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-[22px] bg-surface ring-1 ring-line/70">
      <div className="grid grid-cols-7 border-b border-line py-2 text-center text-[11px] font-medium text-muted">
        {WEEK.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const on = eventsOn(props.events, d) as CalEvent[];
          const isToday = d === props.today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => props.onPick(d)}
              className={clsx(
                "flex min-h-[5.5rem] min-w-0 flex-col items-stretch gap-0.5 border-line/70 px-0.5 pb-1 pt-1 text-left hover:bg-canvas",
                i % 7 > 0 && "border-l",
                i >= 7 && "border-t",
              )}
            >
              <span
                className={clsx(
                  "mx-auto flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                  isToday ? "bg-sun-line font-semibold text-white" : d.slice(0, 7) === month ? "text-ink" : "text-muted/60",
                )}
              >
                {Number(d.slice(8))}
              </span>
              {on.slice(0, 3).map((e) => (
                <span
                  key={e.id}
                  className={clsx("truncate rounded-[4px] px-1 py-px text-[10px] font-medium leading-tight", COLOUR[e.source])}
                >
                  {e.title}
                </span>
              ))}
              {on.length > 3 && <span className="px-1 text-[10px] text-muted">+{on.length - 3}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The month under the heading, as Google drops it down: a small grid to jump to a day, dots where something is on. */
function MonthPicker(props: {
  day: ISODate;
  today: ISODate;
  events: CalEvent[];
  onPick: (d: ISODate) => void;
  onMonth: (d: ISODate) => void;
}) {
  const days = viewDays("month", props.day);
  const month = props.day.slice(0, 7);
  return (
    <div className="mt-2 rounded-[22px] bg-surface p-3 ring-1 ring-line/70">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => props.onMonth(stepDay("month", props.day, -1))}
          className="rounded-full px-2 py-1 text-ink-2 hover:bg-canvas"
          aria-label="Last month"
        >
          ‹
        </button>
        <span className="text-[14px] font-medium text-ink">{monthHeading(props.day, props.today)}</span>
        <button
          type="button"
          onClick={() => props.onMonth(stepDay("month", props.day, 1))}
          className="rounded-full px-2 py-1 text-ink-2 hover:bg-canvas"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-[11px] text-muted">
        {WEEK.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {days.map((d) => {
          const busy = eventsOn(props.events, d).length > 0;
          const picked = d === props.day;
          return (
            <button
              key={d}
              type="button"
              onClick={() => props.onPick(d)}
              className={clsx(
                "relative mx-auto flex size-9 items-center justify-center rounded-full text-[13px] tabular-nums",
                picked
                  ? "bg-ink text-white"
                  : d === props.today
                    ? "font-semibold text-sun-line ring-1 ring-sun-line"
                    : d.slice(0, 7) === month
                      ? "text-ink hover:bg-canvas"
                      : "text-muted/60",
              )}
            >
              {Number(d.slice(8))}
              {busy && <span className={clsx("absolute bottom-1 size-1 rounded-full", picked ? "bg-white" : "bg-sun-line")} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
