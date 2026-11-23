"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HardHat, MapPin } from "lucide-react";
import clsx from "clsx";
import type { ISODate } from "@/lib/domain/types";
import { addDaysISO } from "@/lib/domain/scheduling";
import { CALENDAR_SIDE_KEY, CALENDAR_SIDES, type CalendarSide } from "@/lib/domain/design/today-view";
import { INSTALLER_KEY } from "@/lib/domain/design/crm";
import type { JobLine } from "@/lib/services/crm";
import { MyCalendar } from "./my-calendar";

/** How far ahead the installs list looks. */
const INSTALL_DAYS = 30;

/**
 * Today's calendar (23 Nov 2026, Martin: "Calendar it's important for seeing any sales appointments … switched between
 * personal sales calendar and installs calendar"). **Mine** is the member's own Google Calendar or Outlook (Sol's
 * meetings land there too); **Installs** is the business's booked installs for the next month, day by day, with the
 * whole install calendar a press away.
 */
export function TodayCalendar({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const [side, setSideState] = useState<CalendarSide>("mine");
  useEffect(() => {
    try {
      const kept = window.localStorage.getItem(CALENDAR_SIDE_KEY);
      // A remembered choice is only known in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (kept === "installs") setSideState("installs");
    } catch {
      // Nothing kept: Mine.
    }
  }, []);
  const setSide = (s: CalendarSide) => {
    setSideState(s);
    try {
      window.localStorage.setItem(CALENDAR_SIDE_KEY, s);
    } catch {
      // Not kept: fine.
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl pb-8 pt-3">
      <div className="flex justify-center">
        <div role="tablist" aria-label="Whose calendar" className="flex rounded-full bg-ink/[0.06] p-0.5 text-[13px] font-medium">
          {CALENDAR_SIDES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={side === s}
              onClick={() => setSide(s)}
              className={clsx(
                "rounded-full px-4 py-1.5 transition-colors",
                side === s ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
              )}
            >
              {s === "mine" ? "Mine" : "Installs"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-[22px] bg-surface p-4 ring-1 ring-line/70">
        {side === "mine" ? <MyCalendar wide /> : <InstallsAhead jobs={jobs} today={today} />}
      </div>
    </div>
  );
}

const dayWords = (d: ISODate, today: ISODate) =>
  d === today
    ? "Today"
    : d === addDaysISO(today, 1)
      ? "Tomorrow"
      : new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** The booked installs from today for the next month, grouped by day; each opens its deal. */
function InstallsAhead({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  if (!jobs) return <div className="h-32 animate-pulse rounded-xl bg-canvas" />;
  const last = addDaysISO(today, INSTALL_DAYS);
  const booked = jobs
    .filter((j) => j.stage !== "lost" && j.installDate && j.installDate >= today && j.installDate <= last)
    .sort((a, b) => (a.installDate! < b.installDate! ? -1 : a.installDate! > b.installDate! ? 1 : 0));
  const days: { day: ISODate; jobs: JobLine[] }[] = [];
  for (const j of booked) {
    const d = j.installDate as ISODate;
    if (days[days.length - 1]?.day === d) days[days.length - 1].jobs.push(j);
    else days.push({ day: d, jobs: [j] });
  }
  return (
    <div>
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[15px] font-semibold text-ink">Installs, next {INSTALL_DAYS} days</p>
        <Link href="/design/installations" className="text-[12px] font-medium text-ink-2 hover:text-ink">
          Full calendar →
        </Link>
      </div>
      {days.length === 0 ? (
        <p className="mt-3 px-1 text-[13px] text-muted">No installs booked in the next {INSTALL_DAYS} days.</p>
      ) : (
        <div className="mt-2 space-y-3">
          {days.map(({ day, jobs: on }) => (
            <section key={day}>
              <p className={clsx("px-1 text-[12px] font-medium uppercase tracking-wider", day === today ? "text-sun-line" : "text-muted")}>
                {dayWords(day, today)}
              </p>
              <ul className="mt-1 space-y-1">
                {on.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/design/deals/${j.id}`}
                      className="flex items-start gap-2.5 rounded-xl bg-canvas px-3 py-2.5 text-ink hover:bg-sun-line/10"
                    >
                      <HardHat className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{j.customerName}</span>
                        {j.address && (
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-2">
                            <MapPin className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{j.address}</span>
                          </span>
                        )}
                      </span>
                      {j.details?.[INSTALLER_KEY] ? (
                        <span className="shrink-0 text-[12px] text-ink-2">{String(j.details[INSTALLER_KEY])}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
