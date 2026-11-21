"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Check, SlidersHorizontal } from "lucide-react";
import {
  PERF_METRICS,
  PERF_RANGES,
  cleanMetrics,
  cleanRange,
  perfPeriod,
  performance,
  periodWords,
  type PerfFigure,
  type PerfMetric,
  type PerfRange,
} from "@/lib/domain/design/performance";
import type { ISODate } from "@/lib/domain/types";
import { dollars, type JobLine } from "@/lib/services/crm";

/** Kept on the device: the range, a custom range's days and the figures chosen. */
const PERF_KEY = "renuabl.design.perf";

function kept(): { range: PerfRange; custom: { from: ISODate; to: ISODate } | null; metrics: PerfMetric[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(PERF_KEY) ?? "null") as Record<string, unknown> | null;
    const c = raw?.custom as { from?: unknown; to?: unknown } | undefined;
    return {
      range: cleanRange(raw?.range),
      custom: c && typeof c.from === "string" && typeof c.to === "string" ? { from: c.from, to: c.to } : null,
      metrics: cleanMetrics(raw?.metrics),
    };
  } catch {
    return { range: "month", custom: null, metrics: cleanMetrics(null) };
  }
}

/**
 * Performance in Today's tray (21 Nov 2026, Martin): any of the ranges, the figures the member chooses, each against
 * the period before it. `month` (the goal and the sun, for this month only) is drawn under it.
 */
export function PerformancePanel({ jobs, today, month }: { jobs: JobLine[] | null; today: ISODate; month?: React.ReactNode }) {
  const [range, setRange] = useState<PerfRange>("month");
  const [custom, setCustom] = useState<{ from: ISODate; to: ISODate } | null>(null);
  const [metrics, setMetrics] = useState<PerfMetric[]>(() => cleanMetrics(null));
  const [choosing, setChoosing] = useState(false);
  const [ready, setReady] = useState(false);

  // Read after the page is up, so the server's page and the browser's agree.
  useEffect(() => {
    const k = kept();
    const t = window.setTimeout(() => {
      setRange(k.range);
      setCustom(k.custom);
      setMetrics(k.metrics);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(PERF_KEY, JSON.stringify({ range, custom, metrics }));
    } catch {
      // Not kept: the defaults next time.
    }
  }, [ready, range, custom, metrics]);

  const period = useMemo(() => perfPeriod(range, today, custom), [range, today, custom]);
  const figures = useMemo(() => (jobs ? performance(jobs, period, metrics) : null), [jobs, period, metrics]);
  const toggle = (m: PerfMetric) =>
    setMetrics((all) =>
      all.includes(m)
        ? all.length > 1
          ? all.filter((x) => x !== m)
          : all
        : PERF_METRICS.map((x) => x.id).filter((x) => x === m || all.includes(x)),
    );

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] bg-surface px-5 pb-5 pt-4 ring-1 ring-line/70">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERF_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              onClick={() => {
                setRange(r.id);
                if (r.id === "custom" && !custom) setCustom({ from: period.from, to: period.to });
              }}
              className={clsx(
                "h-8 rounded-full px-3 text-[12.5px] transition",
                range === r.id ? "bg-primary text-primary-ink" : "text-ink-2 ring-1 ring-line hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
          <div className="relative ml-auto">
            <button
              type="button"
              aria-expanded={choosing}
              onClick={() => setChoosing((c) => !c)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-ink-2 ring-1 ring-line hover:text-ink"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden /> Customise
            </button>
            {choosing && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setChoosing(false)}
                />
                <div className="absolute right-0 top-10 z-30 w-56 rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line">
                  <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Figures to show</p>
                  {PERF_METRICS.map((m) => {
                    const on = metrics.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={on}
                        onClick={() => toggle(m.id)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[13px] text-ink hover:bg-surface-2"
                      >
                        <span
                          className={clsx(
                            "grid size-4 shrink-0 place-items-center rounded ring-1",
                            on ? "bg-primary text-primary-ink ring-primary" : "ring-line-strong",
                          )}
                        >
                          {on && <Check className="size-3" aria-hidden />}
                        </span>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {range === "custom" && custom && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <label className="flex items-center gap-2">
              From
              <input
                type="date"
                value={custom.from}
                max={today}
                onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
                className="h-8 rounded-lg bg-canvas px-2 text-ink ring-1 ring-line"
              />
            </label>
            <label className="flex items-center gap-2">
              to
              <input
                type="date"
                value={custom.to}
                max={today}
                onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
                className="h-8 rounded-lg bg-canvas px-2 text-ink ring-1 ring-line"
              />
            </label>
          </div>
        )}

        <p className="mt-3 text-[12px] text-muted">
          {periodWords(period, today.slice(0, 4))} · against {periodWords({ from: period.prevFrom, to: period.prevTo }, today.slice(0, 4))}
        </p>

        {!figures ? (
          <div className="mt-4 h-20 animate-pulse rounded-xl bg-surface-2" />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            {figures.map((f) => (
              <Figure key={f.metric} figure={f} />
            ))}
          </div>
        )}
      </div>
      {range === "month" && month}
    </div>
  );
}

function shown(kind: PerfFigure["kind"], v: number | null): string {
  if (v === null) return "–";
  if (kind === "dollars") return v >= 10_000 ? `$${Math.round(v / 1000).toLocaleString("en-AU")}k` : dollars(v);
  if (kind === "kw") return `${Math.round(v * 10) / 10} kW`;
  if (kind === "share") return `${Math.round(v * 100)}%`;
  return String(v);
}

function Figure({ figure: f }: { figure: PerfFigure }) {
  const up = f.change !== null && f.change > 0;
  const down = f.change !== null && f.change < 0;
  return (
    <div className="min-w-0">
      <div className="font-mono text-[22px] leading-none tracking-[-0.02em] text-ink">{shown(f.kind, f.value)}</div>
      <div className="mt-1.5 text-[12px] text-ink-2">{f.label}</div>
      <div
        className={clsx("mt-1 flex items-center gap-0.5 text-[11.5px]", up ? "text-positive" : down ? "text-warning" : "text-muted")}
        title={`Before: ${shown(f.kind, f.prev)}`}
      >
        {up && <ArrowUpRight className="size-3.5" aria-hidden />}
        {down && <ArrowDownRight className="size-3.5" aria-hidden />}
        {f.change === null ? `Before: ${shown(f.kind, f.prev)}` : `${Math.round(Math.abs(f.change) * 100)}% on before`}
      </div>
    </div>
  );
}
