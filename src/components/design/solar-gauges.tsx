"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { arrayLight, dayShare, paceOf, tallyOrder, type PanelState } from "@/lib/domain/design/gauges";
import type { MonthFigures, Ring, RingKey } from "@/lib/domain/design/sales-rings";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { dollars } from "@/lib/services/crm";
import { PATHS } from "./design-shell";

/**
 * RENUABL's own progress visuals (24 Oct 2026, Martin: native to RENUABL, not borrowed): the sun over the array. A goal
 * is a panel array, drawn as the designer draws panels (glass, a fine frame, the cells), lighting column by column; the
 * sun travels its arc over the period; a line drops from the sun through the arrays. Counts are panel tallies.
 */

/** Drawn in once after the page has painted (panels switch on one after another; none of it with reduced motion). */
function useDrawn(): boolean {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return drawn;
}

type Tone = "dark" | "light";
const UNLIT: Record<Tone, { fill: string; stroke: string; cell: string }> = {
  dark: { fill: "rgb(255 255 255 / 0.06)", stroke: "rgb(255 255 255 / 0.16)", cell: "rgb(255 255 255 / 0.06)" },
  light: { fill: "var(--surface-2)", stroke: "var(--line-strong)", cell: "rgb(0 0 0 / 0.05)" },
};

/** One panel: glass, a fine frame and its cells; lit, it glows in the solar orange; part lit, it fills from the foot. */
function Panel(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: number;
  tone: Tone;
  gradient: string;
  delay: number;
  drawn: boolean;
}) {
  const { x, y, w, h, tone } = props;
  const lit = props.drawn ? props.lit : 0;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.6} fill={UNLIT[tone].fill} stroke={UNLIT[tone].stroke} strokeWidth={0.6} />
      <rect
        x={x}
        y={y + h * (1 - lit)}
        width={w}
        height={h * lit}
        rx={1.6}
        fill={`url(#${props.gradient})`}
        style={{ transitionDelay: `${props.delay}ms` }}
        className="transition-all duration-500 ease-out motion-reduce:transition-none"
      />
      {/* The cells: two lines down, three across. */}
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={x + (w * i) / 3}
          x2={x + (w * i) / 3}
          y1={y + 1}
          y2={y + h - 1}
          stroke={lit > 0 ? "rgb(255 255 255 / 0.28)" : UNLIT[tone].cell}
          strokeWidth={0.5}
        />
      ))}
      {[1, 2, 3].map((i) => (
        <line
          key={`h${i}`}
          x1={x + 1}
          x2={x + w - 1}
          y1={y + (h * i) / 4}
          y2={y + (h * i) / 4}
          stroke={lit > 0 ? "rgb(255 255 255 / 0.22)" : UNLIT[tone].cell}
          strokeWidth={0.5}
        />
      ))}
    </g>
  );
}

function SunGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor="#ff5a1f" />
      <stop offset="1" stopColor="#ff9a3c" />
    </linearGradient>
  );
}

/**
 * A goal as a panel array, `cols` across and `rows` high, lit column by column from the left for its share. `now`
 * (0–1) draws the sun's line through it.
 */
export function ArrayGauge(props: { share: number; cols?: number; rows?: number; tone?: Tone; now?: number | null; label?: string }) {
  const { cols = 12, rows = 2, tone = "dark" } = props;
  const drawn = useDrawn();
  const gradient = `lit-${useId().replace(/:/g, "")}`;
  const w = 14;
  const h = 22;
  const gap = 2.5;
  const width = cols * (w + gap) - gap;
  const height = rows * (h + gap) - gap;
  const { full, part } = arrayLight(props.share, cols * rows);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={props.label}>
      <defs>
        <SunGradient id={gradient} />
      </defs>
      {Array.from({ length: cols * rows }, (_, i) => {
        const col = Math.floor(i / rows);
        const row = i % rows;
        return (
          <Panel
            key={i}
            x={col * (w + gap)}
            y={row * (h + gap)}
            w={w}
            h={h}
            lit={i < full ? 1 : i === full ? part : 0}
            tone={tone}
            gradient={gradient}
            delay={i * 22}
            drawn={drawn}
          />
        );
      })}
      {props.now !== undefined && props.now !== null && (
        <line
          x1={props.now * width}
          x2={props.now * width}
          y1={-2}
          y2={height + 2}
          stroke={tone === "dark" ? "rgb(255 214 140 / 0.9)" : "var(--sun-line)"}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
    </svg>
  );
}

/** The sun on its arc over the period: risen at its start, set at its end, where today is now, with its line dropping. */
export function SunArc({ now, tone = "dark", start, end }: { now: number; tone?: Tone; start: string; end: string }) {
  const drawn = useDrawn();
  const W = 300;
  const H = 46;
  const t = drawn ? now : 0;
  const at = (s: number) => ({ x: (W / 2) * (1 - Math.cos(Math.PI * s)), y: H - (H - 9) * Math.sin(Math.PI * s) });
  const sun = at(t);
  const path = (to: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const p = at((i / 40) * to);
      return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ");
  const faint = tone === "dark" ? "rgb(255 255 255 / 0.18)" : "var(--line-strong)";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 2}`} className="block h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="sun-glow">
            <stop offset="0" stopColor="#ffc861" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff7a1f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1={0} x2={W} y1={H} y2={H} stroke={faint} strokeWidth={0.8} />
        <path d={path(1)} fill="none" stroke={faint} strokeWidth={1} strokeDasharray="2 3" />
        <path d={path(t)} fill="none" stroke="#ff9a3c" strokeOpacity={0.7} strokeWidth={1.4} className="transition-all duration-1000" />
        <line
          x1={sun.x}
          x2={sun.x}
          y1={sun.y}
          y2={H + 2}
          stroke={tone === "dark" ? "rgb(255 214 140 / 0.9)" : "var(--sun-line)"}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <circle cx={sun.x} cy={sun.y} r={13} fill="url(#sun-glow)" />
        <circle cx={sun.x} cy={sun.y} r={5.5} fill="#ffb347" stroke="#fff3d6" strokeWidth={1} />
      </svg>
      <div className={clsx("mt-1 flex justify-between text-[10.5px]", tone === "dark" ? "text-white/45" : "text-muted")}>
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  );
}

const GOAL: Record<RingKey, { name: string; say: (n: number) => string }> = {
  sales: { name: "Sales", say: (n) => dollars(n) },
  deals: { name: "Deals sold", say: (n) => `${n} ${n === 1 ? "deal" : "deals"}` },
  kw: { name: "Solar sold", say: (n) => `${Math.round(n * 10) / 10} kW` },
};

/**
 * The month on the graphite card: the sun on its arc over three arrays (sales, deals sold, kW sold), each lit for its
 * share of the month's goal, with the figures beside them and whether each is ahead of the sun.
 */
export function MonthArrayCard(props: {
  goals: Ring[] | null;
  month: string;
  pace: { day: number; days: number; projected: number } | null;
  canSetTargets: boolean;
}) {
  const { goals, month, pace } = props;
  const now = pace ? dayShare(pace.day, pace.days) : null;
  const unset = goals?.every((g) => g.basis !== "target");
  return (
    <section className="rounded-xl bg-primary p-5 text-primary-ink sm:p-6" aria-label={`${month} so far`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">{month} so far</p>
        {pace && (
          <p className="text-[12px] text-white/70">
            Day {pace.day} of {pace.days} · on pace for{" "}
            <span className="font-medium tabular-nums text-white">{dollars(pace.projected)}</span>
          </p>
        )}
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-x-5 gap-y-3">
        <span />
        {now !== null ? <SunArc now={now} start={`1 ${month.slice(0, 3)}`} end={`${pace?.days} ${month.slice(0, 3)}`} /> : <span />}
        {(goals ?? []).map((g) => {
          const state = g.goal === null ? null : paceOf(g.share, now ?? 0);
          return (
            <div key={g.key} className="contents">
              <div className="min-w-0">
                <p className="text-[11.5px] text-white/60">{GOAL[g.key].name}</p>
                <p className="mt-0.5 truncate text-[19px] font-medium leading-none tabular-nums tracking-tight">
                  {GOAL[g.key].say(g.value)}
                </p>
                <p className="mt-1 truncate text-[11px] text-white/55">
                  {g.goal === null ? "No goal yet" : `of ${GOAL[g.key].say(g.goal)}${g.basis === "average" ? " (3-month avg)" : ""}`}
                  {state && (
                    <span className={clsx("ml-1.5", state === "behind" ? "text-white/55" : "text-[#ffc861]")}>
                      · {state === "reached" ? `reached${g.share > 1.005 ? ` +${Math.round((g.share - 1) * 100)}%` : ""}` : state}
                    </span>
                  )}
                </p>
              </div>
              <ArrayGauge
                share={g.share}
                now={now}
                label={`${GOAL[g.key].name}: ${GOAL[g.key].say(g.value)}${g.goal ? ` of ${GOAL[g.key].say(g.goal)}` : ""}`}
              />
            </div>
          );
        })}
      </div>
      {props.canSetTargets && unset && (
        <Link
          href={`${PATHS.settings}/targets`}
          className="mt-4 inline-block text-[12px] text-white/70 underline underline-offset-4 hover:text-white"
        >
          Set your monthly targets
        </Link>
      )}
    </section>
  );
}

/** A count as a tally of panels: one a thing, lit when done, half-lit when partly done, the rest dark. Up to `max`. */
export function PanelTally({
  states,
  tone = "light",
  max = 24,
  label,
}: {
  states: PanelState[] | null;
  tone?: Tone;
  max?: number;
  label: string;
}) {
  const drawn = useDrawn();
  const gradient = `tally-${useId().replace(/:/g, "")}`;
  const list = tallyOrder(states ?? []);
  const shown = list.slice(0, max);
  const w = 9;
  const h = 15;
  const gap = 2.5;
  const width = Math.max(1, shown.length) * (w + gap) - gap;
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={label}>
      {shown.length > 0 ? (
        <svg viewBox={`0 0 ${width} ${h}`} width={width * 1.15} height={h * 1.15}>
          <defs>
            <SunGradient id={gradient} />
          </defs>
          {shown.map((s, i) => (
            <Panel
              key={i}
              x={i * (w + gap)}
              y={0}
              w={w}
              h={h}
              lit={s === "done" ? 1 : s === "part" ? 0.5 : 0}
              tone={tone}
              gradient={gradient}
              delay={i * 40}
              drawn={drawn}
            />
          ))}
        </svg>
      ) : (
        <span className={clsx("text-[11px]", tone === "dark" ? "text-white/45" : "text-muted")}>None</span>
      )}
      {list.length > max && (
        <span className={clsx("text-[11px]", tone === "dark" ? "text-white/55" : "text-muted")}>+{list.length - max}</span>
      )}
    </div>
  );
}

/** Six months of sales as bars, this month lit in the solar orange; the tallest month sets the height. */
export function MonthBars({ history }: { history: MonthFigures[] | null }) {
  const drawn = useDrawn();
  const top = Math.max(1, ...(history ?? []).map((m) => m.sales));
  return (
    <div
      className="flex h-24 items-end gap-2"
      role="img"
      aria-label={(history ?? []).map((m) => `${m.label} ${dollars(m.sales)}`).join(", ")}
    >
      {(history ?? Array.from({ length: 6 }, () => null)).map((m, i, all) => (
        <div key={m?.month ?? i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-16 w-full items-end">
            <div
              className="w-full rounded-[3px] transition-[height] duration-1000 ease-out motion-reduce:transition-none"
              style={{
                height: `${drawn && m ? Math.max(4, (m.sales / top) * 100) : 4}%`,
                background: i === all.length - 1 ? "linear-gradient(#ff9a3c, #ff5a1f)" : "var(--line-strong)",
              }}
            />
          </div>
          <span className="text-[10.5px] text-muted">{m?.label ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

const STAGE_TINT = ["var(--line-strong)", "#ffc861", "#ff5a1f"];

/** The open pipeline as one bar split by stage (by what each is worth, else how many), in the sun's colours, keyed under it. */
export function PipelineBar({ stages }: { stages: { stage: keyof typeof STAGE_LABELS; deals: number; value: number }[] | null }) {
  const drawn = useDrawn();
  const byValue = (stages ?? []).some((s) => s.value > 0);
  const total = (stages ?? []).reduce((n, s) => n + (byValue ? s.value : s.deals), 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {(stages ?? []).map((s, i) => (
          <div
            key={s.stage}
            className="h-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
            style={{ width: `${drawn && total ? ((byValue ? s.value : s.deals) / total) * 100 : 0}%`, background: STAGE_TINT[i] }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {(stages ?? []).map((s, i) => (
          <li key={s.stage} className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="size-2 rounded-full" style={{ background: STAGE_TINT[i] }} aria-hidden />
            {STAGE_LABELS[s.stage]} <span className="tabular-nums text-muted">{s.deals}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
