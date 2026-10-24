"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { dayShare, paceOf, tallyOrder, type PanelState } from "@/lib/domain/design/gauges";
import type { MonthFigures, Ring, RingKey } from "@/lib/domain/design/sales-rings";
import { dollars } from "@/lib/services/crm";
import { PATHS } from "./design-shell";

/**
 * RENUABL's progress visuals (24 Oct 2026, Martin: the RENUABL way is the way of leaders who think different, as Apple
 * and Tesla do: restraint, not decoration). The sun keeps time: it travels its arc across the period, and a fine dashed
 * line drops from it through everything below. A goal is one hairline: a faint track, a line in the signal orange that
 * grows toward the goal, and a small glowing point where it has got to; past the sun's line is ahead. A count is a row of
 * fine ticks, like the segments of a charge meter: lit, half-lit or dim. Nothing else.
 */

/** Drawn in once after the page has painted (lines grow, ticks light; none of it moves with reduced motion). */
function useDrawn(): boolean {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    // A timer, not an animation frame: a page opened behind another tab gets no frames, and would never draw its figures.
    const id = window.setTimeout(() => setDrawn(true), 30);
    return () => window.clearTimeout(id);
  }, []);
  return drawn;
}

type Tone = "dark" | "light";
const SIGNAL = "linear-gradient(90deg, rgb(255 90 31 / 0.35), #ff5a1f 60%, #ff8a3d)";

/** The sun on its arc over the period: risen at its start, set at its end, where today is, with its line dropping. */
export function SunArc({ now, tone = "dark", start, end }: { now: number; tone?: Tone; start: string; end: string }) {
  const W = 300;
  const H = 44;
  const at = (s: number) => ({ x: (W / 2) * (1 - Math.cos(Math.PI * s)), y: H - (H - 9) * Math.sin(Math.PI * s) });
  const sun = at(now);
  const path = (to: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const p = at((i / 40) * to);
      return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ");
  const faint = tone === "dark" ? "rgb(255 255 255 / 0.16)" : "var(--line-strong)";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 2}`} className="block h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="sun-glow">
            <stop offset="0" stopColor="#ffc861" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ff7a1f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1={0} x2={W} y1={H} y2={H} stroke={faint} strokeWidth={0.6} />
        <path d={path(1)} fill="none" stroke={faint} strokeWidth={0.8} strokeDasharray="1.5 3" />
        <path d={path(now)} fill="none" stroke="#ff8a3d" strokeOpacity={0.75} strokeWidth={1.2} />
        <line
          x1={sun.x}
          x2={sun.x}
          y1={sun.y}
          y2={H + 2}
          stroke={tone === "dark" ? "rgb(255 210 150 / 0.7)" : "var(--sun-line)"}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <circle cx={sun.x} cy={sun.y} r={12} fill="url(#sun-glow)" />
        <circle cx={sun.x} cy={sun.y} r={4.5} fill="#ffb347" />
      </svg>
      <div className={clsx("mt-1 flex justify-between text-[10.5px] tabular-nums", tone === "dark" ? "text-white/40" : "text-muted")}>
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  );
}

/**
 * A goal as one hairline: the track, the line grown to its share (all of it once reached), a glowing point where it has
 * got to, and where the sun is (`now`, 0–1) as a fine dashed mark.
 */
export function GoalLine(props: { share: number; now?: number | null; tone?: Tone; label?: string }) {
  const { tone = "dark" } = props;
  const drawn = useDrawn();
  const to = drawn ? Math.min(1, Math.max(0, props.share)) : 0;
  return (
    <div className="relative h-6" role="img" aria-label={props.label}>
      <div className={clsx("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", tone === "dark" ? "bg-white/15" : "bg-line-strong")} />
      <div
        className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full transition-[width] duration-[1200ms] ease-out motion-reduce:transition-none"
        style={{ width: `${to * 100}%`, background: SIGNAL }}
      />
      {props.share > 0 && (
        <div
          className="absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffb347] shadow-[0_0_10px_2px_rgb(255_138_61_/_0.55)] transition-[left] duration-[1200ms] ease-out motion-reduce:transition-none"
          style={{ left: `${to * 100}%` }}
        />
      )}
      {props.now !== undefined && props.now !== null && (
        <div
          className={clsx(
            "absolute inset-y-0 w-0 border-l border-dashed",
            tone === "dark" ? "border-[rgb(255_210_150_/_0.6)]" : "border-sun-line",
          )}
          style={{ left: `${props.now * 100}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}

const GOAL: Record<RingKey, { name: string; say: (n: number) => string }> = {
  sales: { name: "Sales", say: (n) => dollars(n) },
  deals: { name: "Deals sold", say: (n) => `${n} ${n === 1 ? "deal" : "deals"}` },
  kw: { name: "Solar sold", say: (n) => `${Math.round(n * 10) / 10} kW` },
};

/**
 * The month on the graphite card: the sun on its arc over three hairlines (sales, deals sold, kW sold), each grown to its
 * share of the month's goal, the figures large beside them, and whether each is ahead of the sun.
 */
export function MonthCard(props: {
  goals: Ring[] | null;
  month: string;
  pace: { day: number; days: number; projected: number } | null;
  canSetTargets: boolean;
}) {
  const { goals, month, pace } = props;
  const now = pace ? dayShare(pace.day, pace.days) : null;
  const unset = goals?.every((g) => g.basis !== "target");
  const short = month.slice(0, 3);
  return (
    <section className="rounded-xl bg-primary p-5 text-primary-ink sm:p-6" aria-label={`${month} so far`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">{month} so far</p>
        {pace && (
          <p className="text-[12px] text-white/65">
            Day {pace.day} of {pace.days} · on pace for{" "}
            <span className="font-medium tabular-nums text-white">{dollars(pace.projected)}</span>
          </p>
        )}
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-6 gap-y-4">
        <span />
        {now !== null ? <SunArc now={now} start={`1 ${short}`} end={`${pace?.days} ${short}`} /> : <span />}
        {(goals ?? []).map((g) => {
          const state = g.goal === null ? null : paceOf(g.share, now ?? 0);
          return (
            <div key={g.key} className="contents">
              <div className="min-w-0">
                <p className="text-[11.5px] text-white/55">{GOAL[g.key].name}</p>
                <p className="mt-1 truncate text-[22px] font-medium leading-none tabular-nums tracking-tight">{GOAL[g.key].say(g.value)}</p>
                <p className="mt-1.5 truncate text-[11px] text-white/50">
                  {g.goal === null ? "No goal yet" : `of ${GOAL[g.key].say(g.goal)}${g.basis === "average" ? " · 3-month avg" : ""}`}
                  {state && (
                    <span className={clsx("ml-1.5", state === "behind" ? "text-white/50" : "text-[#ffb347]")}>
                      · {state === "reached" ? `reached${g.share > 1.005 ? ` +${Math.round((g.share - 1) * 100)}%` : ""}` : state}
                    </span>
                  )}
                </p>
              </div>
              <GoalLine
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
          className="mt-5 inline-block text-[12px] text-white/65 underline underline-offset-4 hover:text-white"
        >
          Set your monthly targets
        </Link>
      )}
    </section>
  );
}

/** A count as a row of fine ticks: one a thing, lit when done, half-lit when partly done, dim otherwise. Up to `max`. */
export function Tally({
  states,
  tone = "light",
  max = 40,
  label,
}: {
  states: PanelState[] | null;
  tone?: Tone;
  max?: number;
  label: string;
}) {
  const drawn = useDrawn();
  const list = tallyOrder(states ?? []);
  const shown = list.slice(0, max);
  const dim = tone === "dark" ? "rgb(255 255 255 / 0.18)" : "var(--line-strong)";
  return (
    <div className="flex items-center gap-[3px]" role="img" aria-label={label}>
      {shown.length === 0 && <span className={clsx("text-[11px]", tone === "dark" ? "text-white/45" : "text-muted")}>None</span>}
      {shown.map((s, i) => (
        <span
          key={i}
          className="h-3.5 w-[3px] rounded-full transition-colors duration-500 motion-reduce:transition-none"
          style={{
            background: !drawn || s === "todo" ? dim : s === "done" ? "#ff5a1f" : "rgb(255 90 31 / 0.4)",
            transitionDelay: `${i * 30}ms`,
          }}
        />
      ))}
      {list.length > max && (
        <span className={clsx("ml-1 text-[11px]", tone === "dark" ? "text-white/55" : "text-muted")}>+{list.length - max}</span>
      )}
    </div>
  );
}

/** Six months of sales as fine bars, this month in the signal orange; the tallest month sets the height. */
export function MonthBars({ history }: { history: MonthFigures[] | null }) {
  const drawn = useDrawn();
  const top = Math.max(1, ...(history ?? []).map((m) => m.sales));
  return (
    <div
      className="flex h-24 items-end gap-3"
      role="img"
      aria-label={(history ?? []).map((m) => `${m.label} ${dollars(m.sales)}`).join(", ")}
    >
      {(history ?? Array.from({ length: 6 }, () => null)).map((m, i, all) => (
        <div key={m?.month ?? i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-16 w-full items-end justify-center">
            <div
              className="w-1.5 rounded-full transition-[height] duration-1000 ease-out motion-reduce:transition-none"
              style={{
                height: `${drawn && m ? Math.max(4, (m.sales / top) * 100) : 4}%`,
                background: i === all.length - 1 ? "#ff5a1f" : "var(--line-strong)",
              }}
            />
          </div>
          <span className="text-[10.5px] text-muted">{m?.label ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

const STAGE_TINT = ["var(--line-strong)", "rgb(255 90 31 / 0.45)", "#ff5a1f"];

/** The open pipeline as one fine line split by stage (by what each is worth, else how many), keyed under it. */
export function PipelineBar({ stages }: { stages: { stage: keyof typeof STAGE_LABELS; deals: number; value: number }[] | null }) {
  const drawn = useDrawn();
  const byValue = (stages ?? []).some((s) => s.value > 0);
  const total = (stages ?? []).reduce((n, s) => n + (byValue ? s.value : s.deals), 0);
  return (
    <div>
      <div className="flex h-[3px] w-full gap-[2px] overflow-hidden rounded-full">
        {(stages ?? []).map((s, i) => (
          <div
            key={s.stage}
            className="h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
            style={{ width: `${drawn && total ? ((byValue ? s.value : s.deals) / total) * 100 : 0}%`, background: STAGE_TINT[i] }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {(stages ?? []).map((s, i) => (
          <li key={s.stage} className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="size-1.5 rounded-full" style={{ background: STAGE_TINT[i] }} aria-hidden />
            {STAGE_LABELS[s.stage]} <span className="tabular-nums text-muted">{s.deals}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
