"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, Video } from "lucide-react";
import clsx from "clsx";
import { calendarDays } from "@/lib/domain/design/schedule";
import { CALENDAR_WORDS, busyDays, eventTime, eventsOn, type MyEvent } from "@/lib/domain/design/my-calendar";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { connectCalendarHref, disconnectMyCalendar, loadMyCalendar, type CalendarAnswer } from "@/lib/services/my-calendar";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const at = (d: ISODate) => new Date(`${d}T00:00:00Z`);
const dayTitle = (d: ISODate) => at(d).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** What came back from connecting with Google, read off the page's address once (`?calendar=`). */
export const CONNECT_RESULTS: Record<string, string | null> = {
  connected: null,
  failed: "Your calendar couldn't be connected. Try again.",
  off: CALENDAR_WORDS.notReady,
  "signed-out": "Sign in again to connect your calendar.",
};

/**
 * The calendar over the page, opened from the date tile (5 Nov 2026, Martin): the month, Monday first, today ringed in
 * the signal orange and a dot under each day with something on, and the picked day's events from the member's own
 * Google Calendar (read only). With no calendar connected it asks them to connect one.
 */
export function MyCalendar(props: { note?: string | null }) {
  const path = usePathname();
  const today = todayInMarket();
  const [month, setMonth] = useState<ISODate>(today);
  const [day, setDay] = useState<ISODate>(today);
  const [got, setGot] = useState<CalendarAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(props.note ?? null);
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
  }, [from, to]);
  const events: MyEvent[] = got?.events ?? [];
  const busy = busyDays(events, grid.days);
  const onDay = eventsOn(events, day);
  const inMonth = (d: ISODate) => d.slice(0, 7) === month.slice(0, 7);
  const go = (to: ISODate) => {
    setMonth(to);
    setGot((g) => (g ? { ...g, events: [] } : g));
  };
  const disconnect = async () => {
    const res = await disconnectMyCalendar();
    if (!res.ok) return setProblem(res.message);
    setGot({ connected: false, ready: true, events: [] });
  };

  return (
    <div className="w-[21rem] text-ink">
      <div className="flex items-center justify-between px-1">
        <p className="text-[15px] font-semibold">{grid.title}</p>
        <div className="flex items-center gap-0.5">
          {(month.slice(0, 7) !== today.slice(0, 7) || day !== today) && (
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
            onClick={() => go(grid.prev)}
            aria-label="Last month"
            className="rounded-full p-1.5 text-ink-2 hover:bg-canvas"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(grid.next)}
            aria-label="Next month"
            className="rounded-full p-1.5 text-ink-2 hover:bg-canvas"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

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

      <div className="mt-3 border-t border-line pt-3">
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
            <p className="mt-1 text-[13px] leading-snug text-ink-2">{got.ready ? CALENDAR_WORDS.connectBody : CALENDAR_WORDS.notReady}</p>
            {got.ready && (
              <a
                href={connectCalendarHref(path)}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-ink/90"
              >
                {CALENDAR_WORDS.connect}
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="px-1 text-[12px] font-medium uppercase tracking-wider text-muted">{dayTitle(day)}</p>
            {got.broken ? (
              <div className="mt-2 rounded-2xl bg-canvas p-3 text-[13px] text-ink-2">
                {CALENDAR_WORDS.broken}{" "}
                <a href={connectCalendarHref(path)} className="font-medium text-ink underline">
                  Connect again
                </a>
              </div>
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
                              <ExternalLink className="size-3" aria-hidden /> Open in Google
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
              <span className="truncate">Google Calendar · {got.address}</span>
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
