"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { fromISODate, toISODate } from "@/lib/domain/scheduling";
import type { ISODate } from "@/lib/domain/types";
import { cn } from "./primitives";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Native-feeling month calendar. Only `available` dates are selectable. */
export function MonthCalendar({
  available,
  value,
  onChange,
}: {
  available: ISODate[];
  value: ISODate | null;
  onChange: (d: ISODate) => void;
}) {
  const availableSet = useMemo(() => new Set(available), [available]);
  const first = available[0] ? fromISODate(available[0]) : new Date();
  const last = available.at(-1) ? fromISODate(available.at(-1)!) : first;
  const initial = value ? fromISODate(value) : first;
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const monthLabel = cursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const startOffset = (cursor.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];

  const canPrev = cursor > new Date(first.getFullYear(), first.getMonth(), 1);
  const canNext = cursor < new Date(last.getFullYear(), last.getMonth(), 1);
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="select-none">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[17px] font-semibold">{monthLabel}</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            disabled={!canPrev}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            disabled={!canNext}
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-25"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={monthLabel}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="pb-2 text-xs font-medium text-muted" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const iso = toISODate(date);
          const isAvailable = availableSet.has(iso);
          const selected = value === iso;
          return (
            <div key={i} className="flex justify-center" role="gridcell">
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => onChange(iso)}
                aria-pressed={selected}
                aria-label={
                  date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) +
                  (isAvailable ? "" : ", unavailable")
                }
                className={cn(
                  "relative grid h-11 w-11 place-items-center rounded-full text-[15px] tabular-nums transition",
                  selected && "bg-ink text-canvas font-semibold",
                  !selected && isAvailable && "text-ink hover:bg-surface-2 font-medium",
                  !isAvailable && "text-muted/40",
                )}
              >
                {date.getDate()}
                {isAvailable && !selected && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-positive" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
