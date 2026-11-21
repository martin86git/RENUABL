"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  PERF_METRICS,
  PERF_RANGES,
  cleanMetrics,
  cleanRange,
  perfPeriod,
  perfSeries,
  performance,
  periodWords,
  type PerfBucket,
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
 * Performance in Today's tray (21 Nov 2026, Martin: "a much much better job of performance… use a drop down to make it
 * neat and clean"): the range in one dropdown, the figures chosen as tiles, each with its change on the period before
 * and small bars across the period. `extra` (the month's goal and the sun, your own month) is drawn under it.
 */
export function PerformancePanel({ jobs, today, extra }: { jobs: JobLine[] | null; today: ISODate; extra?: React.ReactNode }) {
  const [range, setRange] = useState<PerfRange>("month");
  const [custom, setCustom] = useState<{ from: ISODate; to: ISODate } | null>(null);
  const [metrics, setMetrics] = useState<PerfMetric[]>(() => cleanMetrics(null));
  const [open, setOpen] = useState<"range" | "figures" | null>(null);
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
  const series = useMemo(() => (jobs ? perfSeries(jobs, period) : []), [jobs, period]);
  const year = today.slice(0, 4);
  const toggle = (m: PerfMetric) =>
    setMetrics((all) =>
      all.includes(m)
        ? all.length > 1
          ? all.filter((x) => x !== m)
          : all
        : PERF_METRICS.map((x) => x.id).filter((x) => x === m || all.includes(x)),
    );
  const rangeLabel = PERF_RANGES.find((r) => r.id === range)?.label ?? "This month";

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] ring-1 ring-line/70 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Performance</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {periodWords(period, year)} <span className="text-line-strong">·</span> against{" "}
              {periodWords({ from: period.prevFrom, to: period.prevTo }, year)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Menu open={open === "range"} onOpen={(o) => setOpen(o ? "range" : null)} label={rangeLabel} title="Date range">
              {PERF_RANGES.map((r) => (
                <MenuRow
                  key={r.id}
                  on={range === r.id}
                  onClick={() => {
                    setRange(r.id);
                    if (r.id === "custom" && !custom) setCustom({ from: period.from, to: period.to });
                    setOpen(null);
                  }}
                >
                  {r.label}
                </MenuRow>
              ))}
            </Menu>
            <Menu
              open={open === "figures"}
              onOpen={(o) => setOpen(o ? "figures" : null)}
              label={<SlidersHorizontal className="size-4" aria-hidden />}
              title="Choose the figures"
              iconOnly
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Figures to show</p>
              {PERF_METRICS.map((m) => (
                <MenuRow key={m.id} on={metrics.includes(m.id)} check onClick={() => toggle(m.id)}>
                  {m.label}
                </MenuRow>
              ))}
            </Menu>
          </div>
        </header>

        {range === "custom" && custom && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <DateBox label="From" value={custom.from} max={today} onChange={(from) => setCustom({ ...custom, from })} />
            <DateBox label="to" value={custom.to} max={today} onChange={(to) => setCustom({ ...custom, to })} />
          </div>
        )}

        {!figures ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m} className="h-[136px] animate-pulse rounded-2xl bg-canvas" />
            ))}
          </div>
        ) : (
          <div
            className={clsx(
              "mt-5 grid grid-cols-2 gap-3",
              figures.length > 2 && "lg:grid-cols-4",
              figures.length === 3 && "lg:grid-cols-3",
            )}
          >
            {figures.map((f) => (
              <Tile key={f.metric} figure={f} series={series} />
            ))}
          </div>
        )}
      </section>
      {range === "month" && extra}
    </div>
  );
}

function Menu(props: {
  open: boolean;
  onOpen: (open: boolean) => void;
  label: React.ReactNode;
  title: string;
  iconOnly?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && props.onOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && props.onOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [props]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={props.open}
        title={props.title}
        aria-label={props.iconOnly ? props.title : undefined}
        onClick={() => props.onOpen(!props.open)}
        className={clsx(
          "inline-flex h-9 items-center gap-1.5 rounded-full bg-canvas text-[13px] font-medium text-ink ring-1 ring-line transition hover:ring-line-strong",
          props.iconOnly ? "w-9 justify-center" : "pl-3.5 pr-2.5",
        )}
      >
        {props.label}
        {!props.iconOnly && <ChevronDown className={clsx("size-4 text-muted transition", props.open && "rotate-180")} aria-hidden />}
      </button>
      {props.open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-56 rounded-2xl bg-surface p-1.5 shadow-lift ring-1 ring-line">
          {props.children}
        </div>
      )}
    </div>
  );
}

function MenuRow(props: { on: boolean; check?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role={props.check ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={props.on}
      onClick={props.onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-canvas",
        props.on && !props.check ? "font-medium text-ink" : "text-ink-2",
      )}
    >
      {props.check ? (
        <span
          className={clsx(
            "grid size-4 shrink-0 place-items-center rounded-[5px] ring-1",
            props.on ? "bg-primary text-primary-ink ring-primary" : "ring-line-strong",
          )}
        >
          {props.on && <Check className="size-3" aria-hidden />}
        </span>
      ) : null}
      <span className="flex-1">{props.children}</span>
      {!props.check && props.on && <Check className="size-4 text-sun-line" aria-hidden />}
    </button>
  );
}

function DateBox(props: { label: string; value: ISODate; max: ISODate; onChange: (v: ISODate) => void }) {
  return (
    <label className="flex items-center gap-2">
      {props.label}
      <input
        type="date"
        value={props.value}
        max={props.max}
        onChange={(e) => e.target.value && props.onChange(e.target.value)}
        className="h-9 rounded-full bg-canvas px-3 text-ink ring-1 ring-line"
      />
    </label>
  );
}

function shown(kind: PerfFigure["kind"], v: number | null): string {
  if (v === null) return "–";
  if (kind === "dollars") return v >= 10_000 ? `$${Math.round(v / 1000).toLocaleString("en-AU")}k` : dollars(v);
  if (kind === "kw") return `${Math.round(v * 10) / 10} kW`;
  if (kind === "share") return `${Math.round(v * 100)}%`;
  return String(v);
}

function Tile({ figure: f, series }: { figure: PerfFigure; series: PerfBucket[] }) {
  const up = f.change !== null && f.change > 0;
  const down = f.change !== null && f.change < 0;
  const values = series.map((b) => b.values[f.metric] ?? 0);
  const top = Math.max(...values, 0);
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-canvas/70 p-4 ring-1 ring-line/60">
      <div className="text-[12px] font-medium text-ink-2">{f.label}</div>
      <div className="mt-2 font-mono text-[26px] leading-none tracking-[-0.03em] text-ink">{shown(f.kind, f.value)}</div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px]" title={`Before: ${shown(f.kind, f.prev)}`}>
        {f.change === null ? (
          <span className="text-muted">Before: {shown(f.kind, f.prev)}</span>
        ) : (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              up ? "bg-positive/10 text-positive" : down ? "bg-warning/10 text-warning" : "bg-line/60 text-ink-2",
            )}
          >
            {up && <ArrowUpRight className="size-3" aria-hidden />}
            {down && <ArrowDownRight className="size-3" aria-hidden />}
            {Math.round(Math.abs(f.change) * 100)}%
          </span>
        )}
        {f.change !== null && <span className="text-muted">on before</span>}
      </div>
      {/* The period in small bars: where in it the figure came from. */}
      <div className="mt-auto flex h-8 items-end gap-[2px] pt-3" aria-hidden>
        {values.map((v, i) => (
          <span
            key={series[i].from}
            title={`${series[i].from}: ${shown(f.kind, v)}`}
            className={clsx("min-w-0 flex-1 rounded-[2px]", v > 0 ? "bg-sun-line/80" : "bg-line/70")}
            style={{ height: top > 0 && v > 0 ? `${Math.max(14, (v / top) * 100)}%` : "3px" }}
          />
        ))}
      </div>
    </div>
  );
}
