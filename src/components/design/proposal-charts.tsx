"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MONTH_NAMES_LONG, SUN_FROM, SUN_TO, dayOf, paybackRun, readoutWords, yearFacts } from "@/lib/domain/design/proposal-charts";

/**
 * The proposal's charts drawn RENUABL's way (19 Nov 2026, Martin: the output chart looked "exactly the way Pylon would
 * present it"; RENUABL's analytics as Apple, Tesla and SpaceX's sister company would draw them; `proposal-charts.ts`):
 * one large figure that reads out what is touched, slim rounded bars in the business's chart colours growing in as they
 * come into view, and the rest quiet. `LiveMonths` and `SunRing` draw the year's output, `BillReadout` the bill.
 * Still with reduced motion.
 */

type Colours = { from?: string; to?: string };
const vars = (c: Colours) => ({ "--chart-from": c.from ?? SUN_FROM, "--chart-to": c.to ?? SUN_TO }) as React.CSSProperties;
const fill = "bg-[linear-gradient(to_top,var(--chart-from),var(--chart-to))]";

/** True once the element has come into view (so the bars grow as it is scrolled to, not before). */
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

/** A figure that counts to its value. */
function useCount(to: number, on: boolean) {
  const [n, setN] = useState(to);
  const from = useRef(0);
  useEffect(() => {
    if (!on) return;
    // With reduced motion it is there at once.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = still ? 1 : Math.min(1, (t - t0) / 500);
      const v = start + (to - start) * (1 - Math.pow(1 - k, 3));
      setN(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, on]);
  return Math.round(n);
}

const hover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;

function BigFigure({ value, unit, on, prefix }: { value: number; unit: string; on: boolean; prefix?: string }) {
  const n = useCount(value, on);
  return (
    <p className="text-[46px] font-light leading-none tracking-[-0.04em] text-ink [font-variant-numeric:tabular-nums] sm:text-[60px]">
      {prefix}
      {n.toLocaleString("en-AU")}
      <span className="ml-2 text-[17px] font-normal tracking-normal text-muted sm:text-[20px]">{unit}</span>
    </p>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={on === v}
      onClick={() => onChange(v)}
      className={clsx(
        "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all",
        on === v ? "bg-[color:var(--surface)] text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Show" className="inline-flex shrink-0 rounded-full bg-[color:var(--line)] p-[3px] print:hidden">
      {opt(false, "Output")}
      {opt(true, "With the home's use")}
    </div>
  );
}

function Facts({ kwh }: { kwh: number[] }) {
  const f = yearFacts(kwh);
  const cell = (k: string, v: string, small: string) => (
    <div className="py-4 sm:px-5 sm:first:pl-0">
      <p className="text-[12px] text-muted">{k}</p>
      <p className="mt-1 text-[21px] leading-tight tracking-[-0.02em] text-ink [font-variant-numeric:tabular-nums]">
        {v}
        <span className="ml-1.5 text-[12.5px] tracking-normal text-muted">{small}</span>
      </p>
    </div>
  );
  return (
    <div className="mt-6 grid border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
      {cell("Sunniest month", MONTH_NAMES_LONG[f.best], `${dayOf(kwh, f.best)} kWh a day`)}
      {cell("Darkest month", MONTH_NAMES_LONG[f.worst], `${dayOf(kwh, f.worst)} kWh a day`)}
      {cell("An average day", `${f.dayKwh}`, "kWh")}
    </div>
  );
}

/** The year as slim bars that read out the month touched, with the home's use marked on each when there is a bill. */
export function LiveMonths({ kwh, use, colours }: { kwh: number[]; use: number[] | null; colours: Colours }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [month, setMonth] = useState<number | null>(null);
  const [withUse, setWithUse] = useState(false);
  const shownUse = withUse && use ? use : null;
  const top = Math.max(1, ...kwh, ...(shownUse ?? [])) * 1.06;
  const year = kwh.reduce((a, b) => a + b, 0);
  return (
    <div ref={ref} style={vars(colours)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <BigFigure
            value={month === null ? year : kwh[month]}
            unit={month === null ? "kWh a year" : `kWh in ${MONTH_NAMES_LONG[month]}`}
            on={seen}
          />
          <p className="mt-2.5 min-h-[22px] text-[14.5px] text-muted" aria-live="polite">
            {readoutWords({ kwh, month, use: shownUse })}
            {month === null && <span className="print:hidden"> Tap a month.</span>}
          </p>
        </div>
        {use && <Toggle on={withUse} onChange={setWithUse} />}
      </div>
      <div
        className="relative mt-7 grid h-52 grid-cols-12 items-end"
        role="img"
        aria-label="Estimated output for each month of the year"
        onMouseLeave={() => hover() && setMonth(null)}
      >
        {kwh.map((m, i) => {
          const on = month === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${MONTH_NAMES_LONG[i]}: ${m.toLocaleString("en-AU")} kWh`}
              onClick={() => setMonth(on ? null : i)}
              onMouseEnter={() => hover() && setMonth(i)}
              className="relative flex h-full flex-col items-center justify-end"
            >
              <span
                className={clsx(
                  "pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium text-canvas transition-all duration-200 [font-variant-numeric:tabular-nums]",
                  on ? "opacity-100" : "translate-y-1 opacity-0",
                )}
                style={{ bottom: `calc(${(m / top) * 100}% + 10px)` }}
              >
                {m.toLocaleString("en-AU")} kWh
              </span>
              {shownUse && (
                <span
                  aria-hidden
                  className={clsx(
                    "pointer-events-none absolute z-[1] h-[2px] w-7 rounded-full bg-ink transition-all duration-500 sm:w-9",
                    month !== null && !on ? "opacity-25" : "opacity-85",
                  )}
                  style={{ bottom: `${(shownUse[i] / top) * 100}%` }}
                />
              )}
              <span
                aria-hidden
                className={clsx(
                  "block origin-bottom rounded-full transition-[transform,opacity,width] duration-[900ms] ease-[cubic-bezier(.2,.9,.25,1.12)] motion-reduce:transition-none",
                  fill,
                  on ? "w-3 sm:w-[22px]" : "w-2.5 sm:w-[18px]",
                  month !== null && !on && "opacity-30",
                  seen ? "scale-y-100" : "scale-y-0",
                )}
                style={{ height: `${Math.max(3, (m / top) * 100)}%`, transitionDelay: seen ? `${i * 45}ms` : "0ms" }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-12">
        {MONTH_NAMES_LONG.map((name, i) => (
          <span key={i} className={clsx("text-center text-[11.5px] font-medium", month === i ? "text-ink" : "text-muted")}>
            {name[0]}
          </span>
        ))}
      </div>
      {shownUse && (
        <div className="mt-4 flex flex-wrap gap-5 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className={clsx("size-2.5 rounded-full", fill)} /> Solar made
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full bg-ink" /> What the home uses
          </span>
        </div>
      )}
      <Facts kwh={kwh} />
    </div>
  );
}

/** The year as the sun's rays, one a month, January at the top: summer's long, winter's short. */
export function SunRing({ kwh, colours }: { kwh: number[]; colours: Colours }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [month, setMonth] = useState<number | null>(null);
  const top = Math.max(1, ...kwh);
  const year = kwh.reduce((a, b) => a + b, 0);
  const id = `sun-${colours.from ?? "s"}-${colours.to ?? "s"}`.replace(/#/g, "");
  const [inner, reach] = [44, 92];
  return (
    <div ref={ref} style={vars(colours)}>
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <BigFigure
            value={month === null ? year : kwh[month]}
            unit={month === null ? "kWh a year" : `kWh in ${MONTH_NAMES_LONG[month]}`}
            on={seen}
          />
          <p className="mt-2.5 min-h-[22px] text-[14.5px] text-muted" aria-live="polite">
            {readoutWords({ kwh, month, use: null })}
            {month === null && <span className="print:hidden"> Touch a ray.</span>}
          </p>
        </div>
        <svg
          viewBox="-130 -130 260 260"
          className="mx-auto block size-64 sm:size-72"
          role="img"
          aria-label="Estimated output for each month of the year, as rays round the sun"
          onMouseLeave={() => hover() && setMonth(null)}
        >
          <defs>
            <radialGradient id={id}>
              <stop offset="0%" stopColor={colours.to ?? SUN_TO} />
              <stop offset="100%" stopColor={colours.from ?? SUN_FROM} />
            </radialGradient>
          </defs>
          <circle
            r={inner - 12}
            fill={`url(#${id})`}
            style={{ transform: `scale(${seen ? 1 : 0})`, transformOrigin: "0 0", transition: "transform 700ms ease-out" }}
          />
          {kwh.map((m, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const len = inner + (reach - inner) * (m / top);
            // Rounded, so the page drawn on the server and in the browser agree to the digit.
            const r2 = (n: number) => Math.round(n * 100) / 100;
            const [cx, cy] = [Math.cos(a), Math.sin(a)];
            const at = (r: number) => ({ x: r2(cx * r), y: r2(cy * r) });
            const [p0, p1, p2, pl] = [at(inner), at(seen ? len : inner + 1), at(reach), at(reach + 18)];
            const on = month === i;
            return (
              <g key={i}>
                <line
                  x1={p0.x}
                  y1={p0.y}
                  x2={p1.x}
                  y2={p1.y}
                  stroke={i % 2 ? (colours.to ?? SUN_TO) : (colours.from ?? SUN_FROM)}
                  strokeWidth={on ? 15 : 12}
                  strokeLinecap="round"
                  opacity={month !== null && !on ? 0.28 : 1}
                  style={{ transition: `all 900ms cubic-bezier(.2,.9,.25,1.12) ${i * 50}ms` }}
                />
                <line
                  x1={p0.x}
                  y1={p0.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="transparent"
                  strokeWidth={26}
                  className="cursor-pointer"
                  onClick={() => setMonth(on ? null : i)}
                  onMouseEnter={() => hover() && setMonth(i)}
                >
                  <title>{`${MONTH_NAMES_LONG[i]}: ${m.toLocaleString("en-AU")} kWh`}</title>
                </line>
                <text
                  x={pl.x}
                  y={pl.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={clsx("text-[11px] font-medium", on ? "fill-[color:var(--ink)]" : "fill-[color:var(--muted)]")}
                >
                  {MONTH_NAMES_LONG[i][0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Facts kwh={kwh} />
    </div>
  );
}

/**
 * The bill now and with the system as two slim bars, the saving as the large figure, and how long the saving takes to
 * add up to the price as a line across the years. Estimates, as the figures under it say.
 */
export function BillReadout({
  now,
  after,
  saving,
  payback,
  colours,
}: {
  now: number;
  after: number;
  saving: number;
  payback: number | null;
  colours: Colours;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const top = Math.max(1, now, after);
  const run = paybackRun(payback);
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
  const bar = (label: string, value: number, strong: boolean, i: number) => (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="text-ink [font-variant-numeric:tabular-nums]">{money(value)} a year</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-[color:var(--line)]">
        <div
          className={clsx(
            "h-2.5 origin-left rounded-full transition-transform duration-[900ms] ease-[cubic-bezier(.2,.9,.25,1.05)] motion-reduce:transition-none",
            strong ? "bg-[linear-gradient(to_right,var(--chart-from),var(--chart-to))]" : "bg-[color:var(--muted)] opacity-50",
            seen ? "scale-x-100" : "scale-x-0",
          )}
          style={{ width: `${Math.max(2, (value / top) * 100)}%`, transitionDelay: `${i * 150}ms` }}
        />
      </div>
    </div>
  );
  return (
    <div ref={ref} style={vars(colours)} className="mb-5">
      <p className="text-[12px] text-muted">Saved, about</p>
      <BigFigure prefix="$" value={saving} unit="a year" on={seen} />
      <div
        className="mt-6 space-y-4"
        role="img"
        aria-label={`A year's bill: about ${money(now)} now, about ${money(after)} with this system`}
      >
        {bar("Now", now, false, 0)}
        {bar("With this system", after, true, 1)}
      </div>
      {run && payback !== null && (
        <div className="mt-7">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-muted">The saving adds up to the price in</span>
            <span className="text-ink [font-variant-numeric:tabular-nums]">about {payback} years</span>
          </div>
          <div className="relative mt-3 h-6">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[color:var(--line)]" />
            <div
              className="absolute left-0 top-1/2 h-[3px] origin-left -translate-y-1/2 rounded-full bg-[linear-gradient(to_right,var(--chart-from),var(--chart-to))] transition-transform duration-[1200ms] ease-out motion-reduce:transition-none"
              style={{ width: `${run.paid * 100}%`, transform: `translateY(-50%) scaleX(${seen ? 1 : 0})` }}
            />
            <span
              className={clsx(
                "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--chart-from)] shadow transition-opacity delay-1000 duration-300",
                seen ? "opacity-100" : "opacity-0",
              )}
              style={{ left: `${run.paid * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted [font-variant-numeric:tabular-nums]">
            <span>Today</span>
            <span>{run.span} years</span>
          </div>
        </div>
      )}
    </div>
  );
}
