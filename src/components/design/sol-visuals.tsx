"use client";

import { useState } from "react";
import clsx from "clsx";
import { Maximize2, X } from "lucide-react";
import type { SolChart } from "@/lib/domain/design/sol-charts";
import { diagramSrc, type SolDiagram } from "@/lib/domain/design/sol-diagrams";

const fmt = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 2 });

/**
 * A chart Sol drew in his chat (as Primero's): one series in the signal orange on a faint track, thin rules, figures
 * beside the marks. A funnel and bars run across, a row each; columns run along, oldest first. Every mark says its
 * figure when pointed at.
 */
export function SolChartView({ chart }: { chart: SolChart }) {
  const max = Math.max(...chart.rows.map((r) => r.value), 0) || 1;
  const unit = chart.unit ? ` ${chart.unit}` : "";
  return (
    <figure className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
      <figcaption className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{chart.title}</figcaption>
      {chart.kind === "columns" ? (
        <Columns chart={chart} max={max} unit={unit} />
      ) : (
        <div className="mt-3 space-y-2">
          {chart.rows.map((r, i) => (
            <div key={i} className="text-xs" title={`${r.label}: ${fmt(r.value)}${unit}${r.note ? ` · ${r.note}` : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-ink-2">{r.label}</span>
                <span className="whitespace-nowrap tabular-nums text-ink">
                  {fmt(r.value)}
                  {r.note && <span className="ml-1.5 text-muted">{r.note}</span>}
                </span>
              </div>
              <span className="relative mt-1 block h-1.5 rounded-full bg-line/60">
                <span
                  className={clsx(
                    "absolute inset-y-0 left-0 rounded-full",
                    chart.kind === "funnel" && i === 0 ? "bg-ink/30" : "bg-sun-line",
                  )}
                  style={{ width: `${r.value > 0 ? Math.max((r.value / max) * 100, 1.5) : 0}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      {(chart.unit || chart.note) && (
        <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-muted">
          {chart.note ?? ""}
          {chart.unit && !chart.note ? `In ${chart.unit}.` : ""}
        </p>
      )}
    </figure>
  );
}

function Columns({ chart, max, unit }: { chart: SolChart; max: number; unit: string }) {
  const [on, setOn] = useState<number | null>(null);
  const n = chart.rows.length;
  const every = Math.ceil(n / 4);
  return (
    <div className="mt-3">
      <p className="h-4 text-xs tabular-nums text-ink">
        {on !== null && (
          <>
            {chart.rows[on].label}: {fmt(chart.rows[on].value)}
            {unit}
            {chart.rows[on].note && <span className="ml-1.5 text-muted">{chart.rows[on].note}</span>}
          </>
        )}
      </p>
      <div className="mt-1 flex h-28 items-end gap-[2px] border-b border-line" onMouseLeave={() => setOn(null)}>
        {chart.rows.map((r, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setOn(i)}
            onFocus={() => setOn(i)}
            aria-label={`${r.label}: ${fmt(r.value)}${unit}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            {n <= 10 && <span className="mb-1 block text-center text-[10px] tabular-nums text-ink-2">{fmt(r.value)}</span>}
            <span
              className={clsx("block rounded-t-[4px]", on === i ? "bg-sun-line" : "bg-sun-line/80")}
              style={{ height: `${r.value > 0 ? Math.max((r.value / max) * (n <= 10 ? 82 : 100), 2) : 0}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {chart.rows.map((r, i) => (
          <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-muted">
            {i % every === 0 ? r.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A diagram Sol drew (as Primero's): the drawing as a picture (a browser runs nothing in a picture and fetches nothing
 * for it), its title over it and its caption under it. Pressed, it opens full size over the page.
 */
export function SolDiagramView({ diagram }: { diagram: SolDiagram }) {
  const [big, setBig] = useState(false);
  const src = diagramSrc(diagram.svg);
  return (
    <figure className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <figcaption className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{diagram.title}</figcaption>
        <button
          type="button"
          onClick={() => setBig(true)}
          aria-label="Open the diagram full size"
          title="Full size"
          className="rounded-full p-1 text-muted hover:bg-canvas hover:text-ink"
        >
          <Maximize2 className="size-3.5" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={() => setBig(true)} className="block w-full cursor-zoom-in px-2 pb-2 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: picture drawn in the chat, not a site image */}
        <img src={src} alt={diagram.title} className="mx-auto block h-auto w-full max-w-[720px]" />
      </button>
      {diagram.caption && <p className="border-t border-line px-4 py-2 text-xs text-muted">{diagram.caption}</p>}
      {big && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={diagram.title}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 sm:p-10"
          onClick={() => setBig(false)}
          onKeyDown={(e) => e.key === "Escape" && setBig(false)}
        >
          <div className="relative max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              autoFocus
              onClick={() => setBig(false)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-canvas"
            >
              <X className="size-4" aria-hidden />
            </button>
            <p className="pr-10 text-sm font-semibold text-ink">{diagram.title}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
            <img src={src} alt={diagram.title} className="mt-3 block h-auto w-full" />
            {diagram.caption && <p className="mt-3 text-xs text-muted">{diagram.caption}</p>}
          </div>
        </div>
      )}
    </figure>
  );
}
