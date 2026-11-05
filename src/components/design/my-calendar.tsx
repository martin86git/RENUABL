"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, Video } from "lucide-react";
import clsx from "clsx";
import { calendarDays } from "@/lib/domain/design/schedule";
import {
  CALENDAR_PROVIDERS,
  CALENDAR_WORDS,
  CONNECT_RESULTS,
  busyDays,
  dayLayout,
  dayStartHour,
  eventTime,
  eventsOn,
  marketMinutes,
  providerName,
  type CalendarProvider,
  type MyEvent,
} from "@/lib/domain/design/my-calendar";
import { todayInMarket } from "@/lib/domain/market";
import { addDaysISO } from "@/lib/domain/scheduling";
import type { ISODate } from "@/lib/domain/types";
import { connectMyCalendar, disconnectMyCalendar, loadMyCalendar, type CalendarAnswer } from "@/lib/services/my-calendar";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const at = (d: ISODate) => new Date(`${d}T00:00:00Z`);
/** Month or Day, kept on the device (a per-person convenience). */
type View = "month" | "day";
const VIEW_KEY = "renuabl.design.calendar-view";
const HOUR_PX = 40;
const dayTitle = (d: ISODate) => at(d).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * The calendar over the page, opened from the date tile (5 Nov 2026, Martin): the month, Monday first, today ringed in
 * the signal orange and a dot under each day with something on, and the picked day's events from the member's own
 * Google Calendar or Outlook (read only). With none connected, one press on either connects it in a small window over
 * the page, so they never leave what they were doing; the events fill in when it closes.
 */
export function MyCalendar(props: { note?: string | null }) {
  const path = usePathname();
  const today = todayInMarket();
  const [month, setMonth] = useState<ISODate>(today);
  const [day, setDay] = useState<ISODate>(today);
  const [got, setGot] = useState<CalendarAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(props.note ?? null);
  const [waiting, setWaiting] = useState<CalendarProvider | null>(null);
  const [asked, setAsked] = useState(0);
  const [view, setViewState] = useState<View>("month");
  useEffect(() => {
    try {
      // A remembered choice is only known in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(VIEW_KEY) === "day") setViewState("day");
    } catch {
      // No storage: Month it is.
    }
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not kept: fine.
    }
  };
  const stopWaiting = useRef<() => void>(() => undefined);
  const grid = calendarDays("month", month);
  const from = grid.days[0];
  const to = grid.days[grid.days.length - 1];
  useEffect(() => {
    let gone = false;
    void loadMyCalendar(from, to).then((res) => {
      if (gone) return;
      if (res.ok) setGot(res);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [from, to, asked]);
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
  const events: MyEvent[] = got?.events ?? [];
  const busy = busyDays(events, grid.days);
  const onDay = eventsOn(events, day);
  const inMonth = (d: ISODate) => d.slice(0, 7) === month.slice(0, 7);
  const go = (to: ISODate) => {
    setMonth(to);
    setGot((g) => (g ? { ...g, events: [] } : g));
  };
  const step = (days: number) => {
    const d = addDaysISO(day, days);
    setDay(d);
    if (d.slice(0, 7) !== month.slice(0, 7)) go(d);
  };
  const disconnect = async () => {
    const res = await disconnectMyCalendar();
    if (!res.ok) return setProblem(res.message);
    setGot({ connected: false, events: [] });
  };

  return (
    <div className="w-[21rem] text-ink">
      <div className="flex items-center justify-between px-1">
        <div className="flex rounded-full bg-canvas p-0.5 text-[12px] font-medium" role="tablist" aria-label="Calendar view">
          {(["month", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={clsx(
                "rounded-full px-3 py-1 capitalize transition-colors",
                view === v ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {((view === "month" && month.slice(0, 7) !== today.slice(0, 7)) || day !== today) && (
            <button
              type="button"
              onClick={() => {
                go(today);
                setDay(today);
              }}
              className="rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:bg-canvas"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => (view === "day" ? step(-1) : go(grid.prev))}
            aria-label={view === "day" ? "Day before" : "Last month"}
            className="rounded-full p-1.5 text-ink-2 hover:bg-canvas"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => (view === "day" ? step(1) : go(grid.next))}
            aria-label={view === "day" ? "Day after" : "Next month"}
            className="rounded-full p-1.5 text-ink-2 hover:bg-canvas"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="mt-3 px-1 text-[15px] font-semibold">
        {view === "day" ? (
          <>
            {dayTitle(day)}
            {day === today && <span className="ml-2 text-[12px] font-medium text-sun-line">Today</span>}
          </>
        ) : (
          grid.title
        )}
      </p>
      {view === "month" && (
        <>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-muted" aria-hidden>
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center" role="grid" aria-label={grid.title}>
            {grid.days.map((d) => {
              const picked = d === day;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDay(d);
                    if (!inMonth(d)) go(d);
                  }}
                  aria-pressed={picked}
                  aria-label={`${dayTitle(d)}${busy.has(d) ? ", something on" : ""}`}
                  className={clsx(
                    "relative mx-auto flex size-9 flex-col items-center justify-center rounded-full text-[13px] tabular-nums transition-colors",
                    picked
                      ? "bg-ink text-white"
                      : isToday
                        ? "text-sun-line ring-1 ring-sun-line"
                        : inMonth(d)
                          ? "hover:bg-canvas"
                          : "text-muted/60 hover:bg-canvas",
                    isToday && "font-semibold",
                  )}
                >
                  {Number(d.slice(8))}
                  {busy.has(d) && (
                    <span className={clsx("absolute bottom-1 size-1 rounded-full", picked ? "bg-white" : "bg-sun-line")} aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className={clsx("mt-3 pt-3", view === "month" && "border-t border-line")}>
        {!got ? (
          !problem && <p className="px-1 py-2 text-[13px] text-muted">Looking at your calendar…</p>
        ) : got.viewing ? (
          <p className="px-1 py-2 text-[13px] text-muted">{CALENDAR_WORDS.viewing}</p>
        ) : !got.connected ? (
          <div className="rounded-2xl bg-canvas p-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-surface text-sun-line ring-1 ring-line">
              <CalendarDays className="size-[18px]" aria-hidden />
            </span>
            <p className="mt-3 text-[14px] font-semibold">{CALENDAR_WORDS.connectTitle}</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">{CALENDAR_WORDS.connectBody}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CALENDAR_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => connect(p.id)}
                  disabled={waiting !== null}
                  className={clsx(
                    "rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
                    waiting === p.id
                      ? "bg-line text-muted"
                      : waiting
                        ? "bg-surface text-muted ring-1 ring-line"
                        : "bg-ink text-white hover:bg-ink/90",
                  )}
                >
                  {waiting === p.id ? "Connecting…" : p.name}
                </button>
              ))}
            </div>
            {waiting && <p className="mt-2 text-[12px] text-muted">{CALENDAR_WORDS.waiting}</p>}
          </div>
        ) : (
          <>
            {view === "month" && (
              <div className="flex items-center justify-between px-1">
                <p className="text-[12px] font-medium uppercase tracking-wider text-muted">{dayTitle(day)}</p>
                <button type="button" onClick={() => setView("day")} className="text-[12px] font-medium text-ink-2 hover:text-ink">
                  Day view
                </button>
              </div>
            )}
            {got.broken ? (
              <div className="mt-2 rounded-2xl bg-canvas p-3 text-[13px] text-ink-2">
                {CALENDAR_WORDS.broken}{" "}
                <button type="button" onClick={() => got.provider && connect(got.provider)} className="font-medium text-ink underline">
                  {waiting ? "Connecting…" : "Connect again"}
                </button>
              </div>
            ) : view === "day" ? (
              <DayTimeline events={events} day={day} today={today} provider={got.provider ?? "google"} />
            ) : onDay.length === 0 ? (
              <p className="px-1 py-2 text-[13px] text-muted">{CALENDAR_WORDS.nothing}</p>
            ) : (
              <ul className="mt-1.5 max-h-60 space-y-1 overflow-y-auto">
                {onDay.map((e) => (
                  <li key={e.id} className="flex gap-2.5 rounded-xl px-1 py-1.5">
                    <span className="mt-1 w-1 shrink-0 self-stretch rounded-full bg-sun-line" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{e.title}</p>
                      <p className="text-[12px] tabular-nums text-muted">{eventTime(e, day)}</p>
                      {e.location && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-2">
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{e.location}</span>
                        </p>
                      )}
                      {(e.call || e.link) && (
                        <div className="mt-1 flex gap-3 text-[12px]">
                          {e.call && (
                            <a
                              href={e.call}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="flex items-center gap-1 font-medium text-ink hover:underline"
                            >
                              <Video className="size-3" aria-hidden /> Join call
                            </a>
                          )}
                          {e.link && (
                            <a
                              href={e.link}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="flex items-center gap-1 text-ink-2 hover:underline"
                            >
                              <ExternalLink className="size-3" aria-hidden /> Open in {got.provider === "outlook" ? "Outlook" : "Google"}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between gap-2 px-1 text-[11px] text-muted">
              <span className="truncate">
                {providerName(got.provider ?? "google")} · {got.address}
              </span>
              <button type="button" onClick={() => void disconnect()} className="shrink-0 hover:text-ink">
                Disconnect
              </button>
            </div>
          </>
        )}
        {problem && <p className="mt-2 px-1 text-[12px] text-sun-line">{problem}</p>}
      </div>
    </div>
  );
}

/**
 * One day by the hour (5 Nov 2026, Martin: switch from the month to the day): all-day events above, then the hours with
 * each timed event drawn at its time and length, overlapping ones side by side (`dayLayout`), and on today a line at
 * the time now. It opens scrolled to just before the first event, else 7am. An event opens in its calendar.
 */
function DayTimeline(props: { events: readonly MyEvent[]; day: ISODate; today: ISODate; provider: CalendarProvider }) {
  const placed = dayLayout(props.events, props.day);
  const allDay = eventsOn(props.events, props.day).filter((e) => !placed.some((p) => p.event.id === e.id));
  const box = useRef<HTMLDivElement>(null);
  const startHour = dayStartHour(placed);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = startHour * HOUR_PX;
  }, [props.day, startHour]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(marketMinutes(new Date().toISOString()));
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, []);
  const where = props.provider === "outlook" ? "Outlook" : "Google";
  return (
    <div>
      {allDay.length > 0 && (
        <ul className="mb-2 space-y-1">
          {allDay.map((e) => (
            <li key={e.id}>
              <EventLink
                event={e}
                where={where}
                className="block truncate rounded-lg bg-sun px-2 py-1 text-[12px] font-medium text-sun-ink"
              >
                {e.title}
              </EventLink>
            </li>
          ))}
        </ul>
      )}
      <div
        ref={box}
        className="relative h-[22rem] overflow-y-auto rounded-xl ring-1 ring-line"
        aria-label={`${dayTitle(props.day)}, by the hour`}
      >
        <div className="relative" style={{ height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute inset-x-0 flex" style={{ top: h * HOUR_PX }}>
              <span className="w-11 shrink-0 -translate-y-1.5 pr-2 text-right text-[10px] tabular-nums text-muted">
                {h === 0 ? "" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`}
              </span>
              <span className="flex-1 border-t border-line" />
            </div>
          ))}
          <div className="absolute inset-y-0 left-11 right-1">
            {placed.map((p) => {
              const height = ((p.to - p.from) / 60) * HOUR_PX;
              return (
                <EventLink
                  key={p.event.id}
                  event={p.event}
                  where={where}
                  className="absolute overflow-hidden rounded-md border-l-2 border-sun-line bg-sun px-1.5 py-0.5 text-[11px] leading-tight text-sun-ink ring-1 ring-surface hover:brightness-95"
                  style={{
                    top: (p.from / 60) * HOUR_PX,
                    height: height - 1,
                    left: `calc(${(p.column / p.columns) * 100}% + 1px)`,
                    width: `calc(${100 / p.columns}% - 2px)`,
                  }}
                >
                  <span className="block truncate font-medium">{p.event.title}</span>
                  {height >= 32 && <span className="block truncate tabular-nums opacity-80">{eventTime(p.event, props.day)}</span>}
                </EventLink>
              );
            })}
            {props.day === props.today && now !== null && (
              <div className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: (now / 60) * HOUR_PX }} aria-hidden>
                <span className="-ml-1 size-2 rounded-full bg-sun-line" />
                <span className="h-px flex-1 bg-sun-line" />
              </div>
            )}
          </div>
        </div>
      </div>
      {placed.length === 0 && allDay.length === 0 && <p className="mt-2 px-1 text-[13px] text-muted">{CALENDAR_WORDS.nothing}</p>}
    </div>
  );
}

/** An event that opens in its own calendar when it has a link there; its details are in its title. */
function EventLink(props: { event: MyEvent; where: string; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const e = props.event;
  const title = [e.title, e.location, e.link ? `Open in ${props.where}` : null].filter(Boolean).join(" · ");
  return e.link ? (
    <a href={e.link} target="_blank" rel="noreferrer noopener" title={title} className={props.className} style={props.style}>
      {props.children}
    </a>
  ) : (
    <span title={title} className={props.className} style={props.style}>
      {props.children}
    </span>
  );
}
