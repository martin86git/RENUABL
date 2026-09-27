"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/components/ui/primitives";
import { addDays, fromISODate, getWindow, toISODate } from "@/lib/domain/scheduling";
import type { Crew, ISODate, Job } from "@/lib/domain/types";
import { StageBadge } from "./bits";

function mondayOf(iso: ISODate) {
  const d = fromISODate(iso);
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** Week view first. Assign crews inline; no drag-and-drop until it's needed. */
export function ScheduleBoard({ jobs, crews, today }: { jobs: Job[]; crews: Crew[]; today: ISODate }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(jobs.map((j) => [j.id, j.crewId])),
  );

  const start = addDays(mondayOf(today), weekOffset * 7);
  const days = Array.from({ length: 6 }, (_, i) => toISODate(addDays(start, i)));
  const inWeek = jobs.filter((j) => days.includes(j.preferredDate));
  const unassigned = inWeek.filter((j) => !assignments[j.id]);
  const rows: { id: string | null; label: string; sub?: string }[] = [
    ...crews.map((c) => ({ id: c.id, label: c.name, sub: c.lead })),
    ...(unassigned.length ? [{ id: null, label: "Unassigned" }] : []),
  ];

  const weekLabel = `${fromISODate(days[0]).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${fromISODate(days[5]).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[14px] hover:border-line-strong"
          aria-label="Previous week"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset(0)}
          className="h-10 rounded-xl border border-line bg-surface px-4 text-[14px] hover:border-line-strong"
        >
          This week
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[14px] hover:border-line-strong"
          aria-label="Next week"
        >
          →
        </button>
        <p className="ml-3 text-[15px] font-medium">{weekLabel}</p>
        <p className="ml-auto text-[13px] text-muted">
          {inWeek.length} installs · {unassigned.length} unassigned
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <div className="grid min-w-[960px]" style={{ gridTemplateColumns: "160px repeat(6, minmax(0, 1fr))" }}>
          <div className="border-b border-line" />
          {days.map((d) => (
            <div key={d} className={cn("border-b border-l border-line px-3 py-3 text-[13px]", d === today && "bg-surface-2")}>
              <span className="text-muted">{fromISODate(d).toLocaleDateString("en-AU", { weekday: "short" })}</span>{" "}
              <span className={cn("font-semibold", d === today && "text-positive")}>{fromISODate(d).getDate()}</span>
            </div>
          ))}
          {rows.map((row) => (
            <div key={row.id ?? "none"} className="contents">
              <div className="border-b border-line px-4 py-3">
                <p className={cn("text-[14px] font-medium", !row.id && "text-warning")}>{row.label}</p>
                {row.sub && <p className="text-[12px] text-muted">{row.sub}</p>}
              </div>
              {days.map((d) => {
                const cell = inWeek.filter((j) => j.preferredDate === d && (assignments[j.id] ?? null) === row.id);
                return (
                  <div key={d} className={cn("min-h-24 space-y-2 border-b border-l border-line p-2", d === today && "bg-surface-2/50")}>
                    {cell.map((j) => (
                      <div
                        key={j.id}
                        className={cn(
                          "rounded-xl border p-2.5 text-[12px]",
                          row.id ? "border-line bg-surface-2" : "border-warning/40 bg-warning-soft",
                        )}
                      >
                        <Link href={`/installer/jobs/${j.id}`} className="block text-[13px] font-medium hover:underline">
                          {j.customer.name}
                        </Link>
                        <p className="text-muted">
                          {getWindow(j.windowId)?.label} · {j.address.suburb}
                        </p>
                        <div className="mt-2 flex flex-col items-start gap-2">
                          <StageBadge stage={j.stage} />
                          <select
                            aria-label={`Crew for ${j.customer.name}`}
                            value={assignments[j.id] ?? ""}
                            onChange={(e) => setAssignments((a) => ({ ...a, [j.id]: e.target.value || null }))}
                            className="h-8 w-full rounded-md border border-line bg-surface px-1 text-[12px] text-ink"
                          >
                            <option value="">—</option>
                            {crews.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
