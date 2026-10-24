"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import type { MonthFigures, Ring, RingKey } from "@/lib/domain/design/sales-rings";
import { dollars } from "@/lib/services/crm";
import { PATHS } from "./design-shell";

const RING: Record<RingKey, { name: string; colour: string; say: (n: number) => string }> = {
  sales: { name: "Sales", colour: "var(--ring-sales)", say: (n) => dollars(n) },
  deals: { name: "Deals sold", colour: "var(--ring-deals)", say: (n) => `${n} ${n === 1 ? "deal" : "deals"}` },
  kw: { name: "Solar sold", colour: "var(--ring-kw)", say: (n) => `${Math.round(n * 10) / 10} kW` },
};

/** Drawn in once, after the page has painted: rings and bars grow from nothing (none of it with reduced motion). */
function useDrawn(): boolean {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return drawn;
}

/**
 * Three rings, one inside the next (sales, deals, kW), as Apple's Activity rings: each a faint track and its share of
 * the goal drawn over it from the top, with a round cap; past the goal it laps itself, the lap's cap shadowed.
 */
export function ActivityRings({ rings, size = 200 }: { rings: Ring[]; size?: number }) {
  const drawn = useDrawn();
  const stroke = size * 0.105;
  const gap = size * 0.02;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={rings.map(ringWords).join(". ")}>
      <defs>
        <filter id="ring-cap" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation={stroke * 0.18} floodOpacity="0.55" />
        </filter>
      </defs>
      {rings.map((ring, i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * r;
        const colour = RING[ring.key].colour;
        const share = drawn ? ring.share : 0;
        const first = Math.min(share, 1);
        const lap = share > 1 ? Math.min(share - 1, 1) : 0;
        const arc = (fraction: number, extra?: object) => (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
            {...extra}
          />
        );
        return (
          <g key={ring.key}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeOpacity={0.18} strokeWidth={stroke} />
            {first > 0.001 && arc(first)}
            {lap > 0.001 && arc(lap, { filter: "url(#ring-cap)" })}
          </g>
        );
      })}
    </svg>
  );
}

const ringWords = (ring: Ring) =>
  `${RING[ring.key].name}: ${RING[ring.key].say(ring.value)}${ring.goal ? ` of ${RING[ring.key].say(ring.goal)}` : ""}`;

/**
 * The month as rings, on the graphite card: the rings, and beside them each figure against its goal and where the goal
 * came from, and the pace the month is on.
 */
export function RingsCard(props: {
  rings: Ring[] | null;
  month: string;
  pace: { day: number; days: number; projected: number } | null;
  canSetTargets: boolean;
}) {
  const { rings, month, pace } = props;
  const averaged = rings?.some((r) => r.basis === "average");
  const unset = rings?.every((r) => r.basis !== "target");
  return (
    <section
      className="flex flex-col gap-6 rounded-xl bg-primary p-6 text-primary-ink sm:flex-row sm:items-center"
      aria-label={`${month} so far`}
    >
      <div className="mx-auto shrink-0 sm:mx-0">
        {rings ? <ActivityRings rings={rings} /> : <div className="size-[200px] rounded-full border-[21px] border-white/10" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">{month} so far</p>
        <ul className="mt-3 space-y-3">
          {(rings ?? []).map((ring) => (
            <li key={ring.key}>
              <p className="text-[12px] font-medium" style={{ color: RING[ring.key].colour }}>
                {RING[ring.key].name}
              </p>
              <p className="mt-0.5 text-[22px] font-medium leading-none tabular-nums tracking-tight">
                {RING[ring.key].say(ring.value)}
                {ring.goal !== null && <span className="text-[15px] text-white/55"> / {RING[ring.key].say(ring.goal)}</span>}
              </p>
              <p className="mt-1 text-[11.5px] text-white/55">
                {ring.goal === null
                  ? "No goal yet: set a target"
                  : ring.share >= 1
                    ? `Closed${ring.share >= 1.05 ? `, ${Math.round(ring.share * 100)}% of ${ring.basis === "target" ? "target" : "your average"}` : ""}`
                    : `${Math.round(ring.share * 100)}% of ${ring.basis === "target" ? "your target" : "your 3-month average"}`}
              </p>
            </li>
          ))}
        </ul>
        {pace && rings?.[0] && (
          <p className="mt-4 border-t border-white/15 pt-3 text-[12px] text-white/70">
            Day {pace.day} of {pace.days} · on pace for{" "}
            <span className="font-medium tabular-nums text-white">{dollars(pace.projected)}</span>
          </p>
        )}
        {props.canSetTargets && (unset || averaged) && (
          <Link
            href={`${PATHS.settings}/targets`}
            className="mt-2 inline-block text-[12px] text-white/70 underline underline-offset-4 hover:text-white"
          >
            {unset ? "Set your monthly targets" : "Change your targets"}
          </Link>
        )}
      </div>
    </section>
  );
}

/** Six months of sales as bars, this month lit; the tallest month sets the height. */
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
              className="w-full rounded-[4px] transition-[height] duration-1000 ease-out motion-reduce:transition-none"
              style={{
                height: `${drawn && m ? Math.max(4, (m.sales / top) * 100) : 4}%`,
                background: i === all.length - 1 ? "var(--ring-sales)" : "var(--line-strong)",
              }}
            />
          </div>
          <span className="text-[10.5px] text-muted">{m?.label ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

/** A share as a half-dial, the arc in the deals colour. */
export function HalfDial({ share, label }: { share: number | null; label: string }) {
  const drawn = useDrawn();
  const r = 40;
  const len = Math.PI * r;
  const f = drawn && share !== null ? Math.min(1, Math.max(0, share)) : 0;
  return (
    <svg viewBox="0 0 100 56" className="h-14 w-24" role="img" aria-label={label}>
      <path d={`M10 50 A${r} ${r} 0 0 1 90 50`} fill="none" stroke="var(--line)" strokeWidth="9" strokeLinecap="round" />
      <path
        d={`M10 50 A${r} ${r} 0 0 1 90 50`}
        fill="none"
        stroke="var(--ring-deals)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - f)}
        className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}

const STAGE_TINT = ["var(--line-strong)", "var(--ring-kw)", "var(--ring-sales)"];

/** The open pipeline as one bar split by stage (by what each is worth, else by how many), with a key under it. */
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

/** A count as dots, one a proposal, up to twelve (then "+N"). */
export function Dots({ n }: { n: number | null }) {
  const shown = Math.min(n ?? 0, 12);
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="size-2.5 rounded-full" style={{ background: "var(--ring-sales)" }} />
      ))}
      {(n ?? 0) > 12 && <span className="text-[11px] text-muted">+{(n ?? 0) - 12}</span>}
      {n === 0 && <span className="size-2.5 rounded-full border border-line" />}
    </div>
  );
}
