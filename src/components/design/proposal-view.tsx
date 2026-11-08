"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Download, FileText } from "lucide-react";
import { blockHeading, viewBlocks, type BlockId, type ViewBlock } from "@/lib/domain/design/blocks";
import { lookOf, lookVars, shownAbn, shownBsb, shownWebsite, themeVars, type ChartStyle } from "@/lib/domain/design/brand";
import {
  BANK_NOTE,
  FEEDBACK_MISSING,
  INDICATIVE_INTRO,
  INDICATIVE_LABEL,
  INDICATIVE_PRICE_NOTE,
  INDICATIVE_STEPS,
  acceptLine,
  feedbackMessage,
  contractDetails,
  ESTIMATE_NOTE,
  NO_SUNSHINE_NOTE,
  PRODUCTION_NOTE,
  ROOF_NOTE,
  SAVING_NOTE,
  STC_NOTE,
  VARIATIONS_NOTE,
  TIMING_NOTE,
  warrantyNote,
  recommendedGoal,
  type ProposalState,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import type { OptionKey } from "@/lib/domain/design/proposal";
import { money } from "@/lib/domain/design/deposit";
import { ROOF_IMAGE, metresPerPixel } from "@/lib/domain/design/roof-design";
import { HERO_DARK, batteryHero, heroGlow, type BatteryHero } from "@/lib/domain/design/battery-hero";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
/** "3 November 2026" from a day or a moment. A bare day is that day wherever it is read. */
const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "Australia/Melbourne",
  });

/**
 * A part of the proposal in its box. What the box is comes from the template (`lookVars`): a card with a border all
 * round, or (Minimal) no box at all, only a fine line above. The defaults are the card, for anything drawn outside a
 * proposal page.
 */
const card =
  "rounded-[var(--part-radius,0.75rem)] border-solid border-line bg-[color:var(--part-bg,var(--surface))] [border-width:1px_var(--part-border,1px)_var(--part-border,1px)] px-[var(--part-pad-x,1.25rem)] py-5 sm:px-[var(--part-pad-x-sm,1.75rem)] sm:py-7";
const eyebrow = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";
// Headings are set in the face the business chose (`--proposal-heading`, from `themeVars`).
const h2 = "text-[22px] leading-tight tracking-tight text-ink [font-family:var(--proposal-heading)] sm:text-[26px]";
const fine = "text-[12.5px] leading-relaxed text-muted";
const field =
  "block min-h-11 w-full rounded-md border border-line bg-surface px-3 text-[16px] text-ink outline-none focus:border-[var(--primary)] sm:text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted";

/** Where a proposal's pictures and files are fetched from: the customer's link, or the business's own preview. */
export interface ProposalUrls {
  image: (id: string) => string;
  /** The roof from above. Null in a preview with no picture to show: the layout is then drawn on a plain ground. */
  roof: string | null;
  /** Null in a preview: there is no file until it is published. */
  pdf: string | null;
  /** The business's own terms and conditions, when the proposal carries them. */
  terms?: string | null;
}

/** What the customer can do from the page. Left out in the business's preview, where the buttons are shown but do nothing. */
export interface ProposalActions {
  accept: (name: string, agree: boolean) => Promise<string | null>;
  /** On an indicative proposal: the customer's thoughts, sent as a message in the chat. Answers with what went wrong, or null. */
  feedback?: (text: string) => Promise<string | null>;
}

/** The roof from above with the panels where they were placed: the same picture and scale the design was drawn on. */
function Roof({ view, src, hero }: { view: ProposalView; src: string | null; hero?: BatteryHero | null }) {
  // The picture is shown only once it is known to have come: a picture that can't be had (no map service here, or
  // the place has none) must leave the plain ground, not a broken image.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!src) return;
    const probe = new Image();
    probe.onload = () => setArrived(true);
    probe.src = src;
    return () => {
      probe.onload = null;
    };
  }, [src]);
  const scale = metresPerPixel(view.roof.lat);
  const { width, height } = ROOF_IMAGE;
  const at = (x: number, y: number) => `${(width / 2 + x / scale).toFixed(1)},${(height / 2 + y / scale).toFixed(1)}`;
  // With a battery laid over it: a soft flow from the middle of the panels to the corner the battery sits in.
  const corners = view.roof.panels.flatMap((p) => [0, 2, 4, 6].map((k) => [width / 2 + p[k] / scale, height / 2 + p[k + 1] / scale]));
  const mid = corners.length
    ? corners.reduce(([sx, sy], [x, y]) => [sx + x / corners.length, sy + y / corners.length], [0, 0])
    : [width / 2, height / 2];
  const flow = ([tx, ty]: [number, number]) =>
    `M${mid[0].toFixed(1)},${mid[1].toFixed(1)} Q${((mid[0] + tx) / 2).toFixed(1)},${(Math.min(mid[1], ty) - 40).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
  return (
    // A dark ground under the picture, so the layout still reads when the picture from above can't be had.
    <div
      className="bh relative overflow-hidden rounded-lg border border-line bg-ink"
      style={hero ? ({ "--bh-glow": heroGlow(view.theme.primary) } as React.CSSProperties) : undefined}
    >
      {hero && <style>{HERO_CSS}</style>}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={hero ? hero.label : `${view.system.panels} panels on the roof, seen from above`}
      >
        {src && arrived && <image href={src} width={width} height={height} preserveAspectRatio="xMidYMid slice" />}
        {view.roof.panels.map((p, i) => (
          <polygon
            key={i}
            points={[0, 2, 4, 6].map((k) => at(p[k], p[k + 1])).join(" ")}
            fill="rgb(17 24 39 / 0.82)"
            stroke="rgb(255 255 255 / 0.85)"
            strokeWidth={0.8}
          />
        ))}
        {hero && (
          <>
            {/* The dark the battery sits on, so it reads over any roof: deepest in the corner, gone by the middle. */}
            <defs>
              <radialGradient id="bh-fade" cx="1" cy="1" r="0.95">
                <stop offset="0" stopColor={HERO_DARK} stopOpacity={0.85} />
                <stop offset="0.55" stopColor={HERO_DARK} stopOpacity={0.4} />
                <stop offset="1" stopColor={HERO_DARK} stopOpacity={0} />
              </radialGradient>
            </defs>
            <rect className="hidden sm:inline" width={width} height={height} fill="url(#bh-fade)" />
            {(
              [
                { to: [width * 0.97, height * 0.99], cls: "sm:hidden" },
                { to: [width * 0.72, height * 0.4], cls: "hidden sm:inline" },
              ] as { to: [number, number]; cls: string }[]
            ).map(({ to, cls }) => (
              <g key={cls} className={cls}>
                <path d={flow(to)} fill="none" stroke={HERO_DARK} strokeOpacity={0.5} strokeWidth={5} strokeLinecap="round" />
                <path
                  className="bh-flow bh-by-day"
                  d={flow(to)}
                  fill="none"
                  stroke="var(--bh-glow)"
                  strokeWidth={2}
                  strokeDasharray="2 7"
                  strokeLinecap="round"
                />
              </g>
            ))}
            <circle cx={mid[0]} cy={mid[1]} r={4} fill="var(--bh-glow)" />
          </>
        )}
      </svg>
      {hero && <BatteryOverlay hero={hero} />}
    </div>
  );
}

/**
 * The battery's day, shared by the overlay on the roof and the home's day: one fourteen-second day on a loop (the sun
 * crossing, the battery filling in the afternoon and running the evening, the grid in the small hours). Each part's
 * resting look is the still picture shown with reduced motion: late afternoon going into the evening, the battery full
 * and running the home.
 */
const HERO_CSS = `
.bh .bh-sun{transform-box:view-box;transform-origin:320px 214px;transform:rotate(150deg);animation:bh-sun 14s linear infinite}
.bh .bh-sun-dot{animation:bh-sun-dot 14s linear infinite}
.bh .bh-fill{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(.85);animation:bh-fill 14s ease-in-out infinite}
.bh .bh-bar{transform-origin:0 50%;transform:scaleX(.85);animation:bh-bar 14s ease-in-out infinite}
.bh .bh-lit{animation:bh-lit 14s linear infinite}
.bh .bh-dusk{opacity:.5;animation:bh-dusk 14s linear infinite}
.bh .bh-evening{animation:bh-evening 14s linear infinite}
.bh .bh-grid{opacity:.3;animation:bh-grid 14s linear infinite}
.bh .bh-flow{animation:bh-dash 1.2s linear infinite}
.bh .bh-by-day{animation:bh-dash 1.2s linear infinite,bh-day 14s linear infinite}
.bh .bh-evening.bh-flow{animation:bh-dash 1.2s linear infinite,bh-evening 14s linear infinite}
.bh .bh-grid.bh-flow{animation:bh-dash 1.2s linear infinite,bh-grid 14s linear infinite}
.bh .bh-stage-afternoon{animation:bh-st-a 14s linear infinite}
.bh .bh-stage-evening{animation:bh-st-e 14s linear infinite}
.bh .bh-stage-night{animation:bh-st-n 14s linear infinite}
@keyframes bh-sun{0%{transform:rotate(0)}50%,100%{transform:rotate(180deg)}}
@keyframes bh-sun-dot{0%{opacity:0}4%,48%{opacity:1}53%,100%{opacity:0}}
@keyframes bh-fill{0%,18%{transform:scaleY(.15)}48%,58%{transform:scaleY(1)}86%,100%{transform:scaleY(.15)}}
@keyframes bh-bar{0%,18%{transform:scaleX(.15)}48%,58%{transform:scaleX(1)}86%,100%{transform:scaleX(.15)}}
@keyframes bh-lit{0%,46%{opacity:0}54%,90%{opacity:.7}97%,100%{opacity:0}}
@keyframes bh-dusk{0%,46%{opacity:0}58%,92%{opacity:1}100%{opacity:0}}
@keyframes bh-evening{0%,52%{opacity:0}56%,84%{opacity:1}88%,100%{opacity:0}}
@keyframes bh-grid{0%,84%{opacity:.3}88%,97%{opacity:1}100%{opacity:.3}}
@keyframes bh-day{0%,16%{opacity:.2}22%,48%{opacity:1}54%,100%{opacity:.2}}
@keyframes bh-dash{to{stroke-dashoffset:-9}}
@keyframes bh-st-a{0%,16%{opacity:.4}20%,50%{opacity:1}54%,100%{opacity:.4}}
@keyframes bh-st-e{0%,50%{opacity:.4}54%,84%{opacity:1}88%,100%{opacity:.4}}
@keyframes bh-st-n{0%,84%{opacity:.4}88%,98%{opacity:1}100%{opacity:.4}}
@media (prefers-reduced-motion:reduce){.bh *{animation:none!important}}
`;

/** The battery's charge through the day, as one fine bar. */
function ChargeBar({ dark }: { dark?: boolean }) {
  return (
    <div aria-hidden className={clsx("h-1.5 overflow-hidden rounded-full", dark ? "bg-white/20" : "bg-[color:var(--line)]")}>
      <div className="bh-bar h-full w-full rounded-full" style={{ background: dark ? "var(--bh-glow)" : "var(--primary)" }} />
    </div>
  );
}

/** Over the roof picture's corner (under it on a phone): "and your evenings", the battery filling by day and running the evening. */
function BatteryOverlay({ hero }: { hero: BatteryHero }) {
  return (
    <div className="bg-[#111827] px-4 py-4 text-white sm:absolute sm:bottom-4 sm:right-4 sm:w-[19rem] sm:rounded-xl sm:bg-[#111827]/70 sm:backdrop-blur-md">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">{hero.headline}</p>
      <div className="mt-2 flex items-center gap-3">
        <BatteryGlyph />
        <p className="text-[24px] leading-none tracking-tight [font-variant-numeric:tabular-nums]">
          {hero.kwh.toLocaleString("en-AU")} <span className="text-[14px] text-white/75">kWh battery</span>
        </p>
      </div>
      <div className="mt-3">
        <ChargeBar dark />
      </div>
      <ol className="mt-2 grid grid-cols-3 gap-2 text-[11px] leading-snug text-white/80">
        {hero.stages.map((s) => (
          <li key={s.id} className={`bh-stage-${s.id}`}>
            <span className="block font-medium text-white">{s.when}</span>
            {s.words}
          </li>
        ))}
      </ol>
      <ul className="mt-3 space-y-1 border-t border-white/15 pt-3 text-[12.5px] leading-snug text-white/90">
        {hero.says.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** A small battery, its charge rising and falling with the day. */
function BatteryGlyph() {
  return (
    <svg viewBox="0 0 20 32" className="h-8 w-5 shrink-0" aria-hidden>
      <rect x={7} y={0.5} width={6} height={3} rx={1} fill="rgb(255 255 255 / 0.7)" />
      <rect x={1} y={3.5} width={18} height={28} rx={3} fill="none" stroke="rgb(255 255 255 / 0.8)" strokeWidth={1.2} />
      <rect className="bh-fill" x={3.5} y={6} width={13} height={23} rx={1.5} fill="var(--bh-glow)" />
    </svg>
  );
}

/**
 * The home's day, for a battery without new solar on the roof: a home under the sun's arc. The afternoon sun fills the
 * battery, the battery runs the evening, and the grid is left for the small hours. Fine lines and one colour, the
 * business's own.
 */
function BatteryDay({ hero }: { hero: BatteryHero }) {
  // A 640 × 250 frame, the ground at 214, the sun's arc centred over the home.
  const ground = 214;
  return (
    <div className={clsx(card, "bh overflow-hidden")}>
      <style>{HERO_CSS}</style>
      <p className={eyebrow}>Your battery</p>
      <p className={clsx(h2, "mt-2")}>{hero.headline}</p>
      <svg viewBox="0 0 640 250" className="mt-5 block h-auto w-full text-ink" role="img" aria-label={hero.label}>
        {/* The evening coming in over the picture. */}
        <rect className="bh-dusk" width={640} height={250} rx={10} fill="currentColor" fillOpacity={0.05} />
        {/* The sun's path across the day, and the sun on it. */}
        <path d={`M140,${ground} A180,180 0 0 1 500,${ground}`} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 6" />
        <g className="bh-sun">
          <g className="bh-sun-dot">
            <circle cx={140} cy={ground} r={20} fill="var(--primary)" opacity={0.15} />
            <circle cx={140} cy={ground} r={11} fill="var(--primary)" />
          </g>
        </g>
        {/* Spare sun from the roof into the battery by day. */}
        <path
          className="bh-by-day"
          d="M352,128 Q400,112 413,144"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.6}
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        {/* The home. */}
        <g fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
          <path d="M248,150 L308,108 L368,150" />
          <path d={`M258,146 L258,${ground} L358,${ground} L358,146`} />
          <path d={`M296,${ground} L296,182 L318,182 L318,${ground}`} />
          <rect x={328} y={160} width={20} height={16} />
          <rect x={268} y={160} width={20} height={16} />
        </g>
        <g className="bh-lit" fill="var(--primary)" opacity={0.7}>
          <rect x={329} y={161} width={18} height={14} />
          <rect x={269} y={161} width={18} height={14} />
        </g>
        {/* The battery on the wall beside it, and the evening's power back into the home. */}
        <rect x={406} y={146} width={18} height={4} rx={1} fill="currentColor" />
        <rect x={398} y={150} width={34} height={60} rx={5} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <rect className="bh-fill" x={403} y={155} width={24} height={50} rx={2.5} fill="var(--primary)" />
        <path
          className="bh-flow bh-evening"
          d="M396,190 L362,190"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.8}
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <text x={415} y={234} textAnchor="middle" fontSize={16} fill="currentColor" style={{ fontVariantNumeric: "tabular-nums" }}>
          {hero.kwh.toLocaleString("en-AU")} kWh
        </text>
        {/* The grid, for the small hours. */}
        <path
          d={`M560,${ground} L572,120 L584,${ground} M564,172 L580,172 M556,132 L588,132 M567,152 L577,152`}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <path
          className="bh-flow bh-grid"
          d="M556,134 Q460,150 360,168"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1.4}
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <text x={572} y={234} textAnchor="middle" fontSize={16} fill="var(--muted)">
          Grid
        </text>
        <line x1={20} y1={ground} x2={620} y2={ground} stroke="var(--line-strong)" strokeWidth={1} />
      </svg>
      <div className="mt-2">
        <ChargeBar />
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-3">
        {hero.stages.map((s) => (
          <li key={s.id} className={`bh-stage-${s.id}`}>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink">{s.when}</p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{s.words}</p>
          </li>
        ))}
      </ol>
      <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-[15px] leading-snug text-ink">
        {hero.says.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className={clsx(fine, "mt-3")}>{hero.note}</p>
    </div>
  );
}

/** The year month by month, drawn the way the business chose: bars, a line, a shaded area, or the figures written out. */
function Months({ kwh, style = "bars" }: { kwh: number[]; style?: ChartStyle }) {
  const top = Math.max(1, ...kwh);
  if (style === "table")
    return (
      <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
        {kwh.map((m, i) => (
          <div key={i} className="border-b border-line pb-1.5">
            <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">{MONTH_NAMES[i]}</dt>
            <dd className="text-[15px] text-ink [font-variant-numeric:tabular-nums]">{m.toLocaleString("en-AU")} kWh</dd>
          </div>
        ))}
      </dl>
    );
  if (style === "line" || style === "area") {
    // 12 points across a 360 × 120 frame, the best month at the top.
    const [w, h] = [360, 120];
    const pts = kwh.map((m, i) => [(i + 0.5) * (w / 12), h - 6 - (m / top) * (h - 16)] as const);
    const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return (
      <div role="img" aria-label="Estimated output for each month of the year">
        <svg viewBox={`0 0 ${w} ${h}`} className="block h-36 w-full" preserveAspectRatio="none">
          {style === "area" && (
            <path d={`${path} L${pts[11][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`} fill="var(--primary)" opacity={0.18} />
          )}
          <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.6} fill="var(--primary)">
              <title>{`${kwh[i].toLocaleString("en-AU")} kWh`}</title>
            </circle>
          ))}
        </svg>
        <div className="mt-1.5 grid grid-cols-12">
          {MONTHS.map((m, i) => (
            <span key={i} className="text-center text-[10.5px] text-muted">
              {m}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-36 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Estimated output for each month of the year">
      {kwh.map((m, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div
            className="w-full rounded-t bg-primary"
            style={{ height: `${Math.max(2, (m / top) * 100)}%` }}
            title={`${m.toLocaleString("en-AU")} kWh`}
          />
          <span className="text-[10.5px] text-muted">{MONTHS[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** A year's bill now and with the system, as two bars against each other. Estimates, as the figures under them say. */
function BillBars({ now, after }: { now: number; after: number }) {
  const top = Math.max(1, now, after);
  const bar = (label: string, value: number, strong?: boolean) => (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="text-ink [font-variant-numeric:tabular-nums]">{dollars(value)}</span>
      </div>
      <div className="mt-1.5 h-3 rounded-full bg-[color:var(--line)]">
        <div
          className={clsx("h-3 rounded-full", strong ? "bg-primary" : "bg-[color:var(--muted)]")}
          style={{ width: `${Math.max(2, (value / top) * 100)}%` }}
        />
      </div>
    </div>
  );
  return (
    <div
      className="mb-4 space-y-3"
      role="img"
      aria-label={`A year's bill: about ${dollars(now)} now, about ${dollars(after)} with this system`}
    >
      {bar("Now", now)}
      {bar("With this system", after, true)}
    </div>
  );
}

const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14.5px] last:border-b-0">
    <span className={strong ? "font-medium text-ink" : "text-muted"}>{label}</span>
    <span className={clsx("text-right [font-variant-numeric:tabular-nums] text-ink", strong && "font-semibold")}>{value}</span>
  </div>
);

/** The three figures that sum a proposal up, wherever the template puts them. */
function Headline({ view }: { view: ProposalView }) {
  const figures: [string, string][] = [
    // A battery with no new solar leads with the battery, not "0 kW".
    view.system.kw > 0 || !view.system.batteryKwh
      ? [`${view.system.kw} kW`, `${view.system.panels} panels${view.system.batteryKwh ? ` · ${view.system.batteryKwh} kWh battery` : ""}`]
      : [`${view.system.batteryKwh} kWh`, "battery storage"],
    ...(view.bill && view.bill.saving > 0
      ? ([[`about ${dollars(view.bill.saving)}`, "estimated saving a year"]] as [string, string][])
      : []),
    [dollars(view.price.youPay), "you pay, after the federal rebate"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {figures.map(([figure, words]) => (
        <div key={words} className={clsx(card, "sm:p-5")}>
          <p className="text-[26px] leading-none tracking-tight text-ink [font-variant-numeric:tabular-nums]">{figure}</p>
          <p className="mt-2 text-[13px] text-muted">{words}</p>
        </div>
      ))}
    </div>
  );
}

/** Going ahead. In a preview it is shown and does nothing. */
function GoAhead({ view, state, accepted, actions }: Pick<ProposalPageProps, "view" | "state" | "accepted" | "actions">) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const b = view.business;
  const line = acceptLine(view);

  if (state === "accepted")
    return (
      <div className={card}>
        <p className={eyebrow}>Accepted</p>
        <p className="mt-2 text-[18px] text-ink">
          {accepted ? `${accepted.name} accepted this proposal on ${day(accepted.at)}.` : "This proposal has been accepted."}
        </p>
        <p className="mt-2 text-sm text-muted">{b.name} will be in touch about what happens next.</p>
      </div>
    );
  if (state === "lapsed")
    return (
      <div className={card}>
        <p className={eyebrow}>Price lapsed</p>
        <p className="mt-2 text-[18px] text-ink">This price stood until {day(view.validUntil)}.</p>
        <p className="mt-2 text-sm text-muted">Ask {b.name} for an up-to-date proposal.</p>
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actions) return;
    setBusy(true);
    setProblem(await actions.accept(name, agree));
    setBusy(false);
  };
  return (
    <div>
      <form onSubmit={submit} className={card}>
        <h3 className="text-[18px] text-ink">Ready to go ahead?</h3>
        <p className="mt-1 text-sm text-muted">
          You pay {dollars(view.price.youPay)}. The price stands until {day(view.validUntil)}. Nothing is charged here.
        </p>
        <label className="mt-4 block text-[13px] font-medium text-ink">
          Your full name
          <input
            className={clsx(field, "mt-1.5")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug text-ink">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span>{line}</span>
        </label>
        {problem && (
          <p className="mt-3 text-[13px] text-danger" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className={clsx(button, "mt-4 w-full")} disabled={busy || !actions}>
          {busy ? "Sending…" : "I'd like to go ahead"}
        </button>
        {!actions && <p className={clsx(fine, "mt-2")}>A preview: your customer uses this from their own link.</p>}
      </form>
    </div>
  );
}

/**
 * In place of going ahead on an indicative proposal: which system suits them best (with options) and a note, sent to
 * the business as a message in the chat, where it can be answered. Then a thank you, and the chat to carry on in.
 */
function Thoughts({
  view,
  actions,
  chosen,
  onOpenChat,
}: {
  view: ProposalView;
  actions?: ProposalActions;
  chosen: OptionKey | null;
  onOpenChat?: () => void;
}) {
  const options = view.options && view.options.length > 1 ? view.options : [];
  const [pick, setPick] = useState<OptionKey | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const b = view.business;
  // What they are looking at above is where the choice starts, until they pick here.
  const goal = pick ?? (options.some((o) => o.goal === chosen) ? chosen : null);
  if (sent)
    return (
      <div className={card}>
        <p className={eyebrow}>Sent</p>
        <p className="mt-2 text-[18px] text-ink">Thanks. {b.name} has your thoughts.</p>
        <p className="mt-2 text-sm text-muted">We&apos;ll be in touch to arrange a visit to your home. Ask anything else in the chat.</p>
        {onOpenChat && (
          <button type="button" onClick={onOpenChat} className={clsx(button, "mt-4")}>
            Open the chat
          </button>
        )}
      </div>
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actions?.feedback) return;
    const option = options.find((o) => o.goal === goal);
    const text = feedbackMessage(option ? { name: option.name } : null, note);
    if (!text) return setProblem(FEEDBACK_MISSING);
    setBusy(true);
    const wrong = await actions.feedback(text);
    setBusy(false);
    setProblem(wrong);
    if (!wrong) setSent(true);
  };
  return (
    <form onSubmit={submit} className={card}>
      <h3 className="text-[18px] text-ink">What do you think?</h3>
      <p className="mt-1 text-sm text-muted">
        Tell us which system suits you, and anything we should know before we visit. It goes to {b.name} in the chat.
      </p>
      {options.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="The system that suits you best">
          {options.map((o) => (
            <button
              key={o.goal}
              type="button"
              role="radio"
              aria-checked={goal === o.goal}
              onClick={() => setPick(o.goal)}
              className={clsx(
                "min-h-11 rounded-md border px-3 py-2 text-left text-[14px]",
                goal === o.goal ? "border-[var(--primary)] font-medium text-ink shadow-[0_0_0_1px_var(--primary)]" : "border-line text-ink",
              )}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
      <label className="mt-4 block text-[13px] font-medium text-ink">
        A note or a question (optional)
        <textarea
          className={clsx(field, "mt-1.5 min-h-24 py-2")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1500}
          placeholder="Where the battery could go, when suits for a visit, anything you're wondering about"
        />
      </label>
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <button type="submit" className={clsx(button, "mt-4 w-full")} disabled={busy || !actions?.feedback}>
        {busy ? "Sending…" : "Send my thoughts"}
      </button>
      <p className={clsx(fine, "mt-2")}>
        {actions?.feedback
          ? "Nothing is agreed here: the final proposal comes after our visit."
          : "A preview: your customer uses this from their own link."}
      </p>
    </form>
  );
}

/** How the business works from an indicative proposal, in three steps, the first lit. */
function HowWeWork() {
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="How we work">
      {INDICATIVE_STEPS.map((step, i) => (
        <li key={step.name} className={clsx(card, "sm:p-5", i === 0 && "shadow-[0_0_0_1px_var(--primary)]")}>
          <p className={clsx("text-[12px] font-medium tracking-[0.16em]", i === 0 ? "text-[color:var(--primary)]" : "text-muted")}>
            {String(i + 1).padStart(2, "0")}
            {i === 0 ? " · You are here" : ""}
          </p>
          <p className="mt-1.5 text-[16px] font-medium text-ink">{step.name}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-muted">{step.words}</p>
        </li>
      ))}
    </ol>
  );
}

export interface ProposalPageProps {
  view: ProposalView;
  state: ProposalState;
  accepted: { name: string; at: string } | null;
  urls: ProposalUrls;
  /** Left out in the business's own preview. */
  actions?: ProposalActions;
  /**
   * The conversation with the business, whatever state the proposal is in: `greeting` (the business's latest
   * message) under the title, and `chat` (the dock that stays at the foot of the screen) at the end of the page.
   * Drawn by the page that knows the link.
   */
  greeting?: React.ReactNode;
  chat?: React.ReactNode;
  /** "Pay your deposit", once the proposal is accepted and asks for one: shown straight under the acceptance. Drawn by the page that knows the link. */
  deposit?: React.ReactNode;
  /**
   * With options: which one the page shows, and how the customer changes it (left out once the choice is made, by
   * going ahead, and in the business's preview, where the cards still show the choice).
   */
  choice?: { chosen: OptionKey | null; onChoose?: (goal: OptionKey) => void };
  /** Opens the chat dock: the thank you after an indicative proposal's thoughts are sent offers it. */
  onOpenChat?: () => void;
}

/**
 * A proposal as the customer reads it, under the business's own name, logo
 * and colours: never RENUABL's. One renderer for the customer's link and for
 * the business's preview, so what is previewed is what is sent.
 *
 * After the cover, the blocks come in the order the business has put them
 * in, each under its heading with the business's own words and picture
 * (`view.blocks`, from the customiser); the PDF follows the same list. The
 * three templates differ only in how the cover opens: Classic under a photo, Compact with the three figures
 * first, Bold on a full block of the business's colour. Colours come in as
 * the site's usual tokens (`themeVars`), so everything below uses tokens.
 * It is given the customer's copy only: there is no cost here to show.
 *
 * Figures are lined up with `[font-variant-numeric:tabular-nums]`, not the
 * `tabular-nums` class: inside the business's screens that class is set in
 * the design tool's monospace face, and the preview must look as the
 * customer's page does.
 */
export function ProposalPage({ view, state, accepted, urls, actions, greeting, chat, deposit, choice, onOpenChat }: ProposalPageProps) {
  const b = view.business;
  const look = lookOf(view.template);
  const bold = look.cover === "colour";
  const chart = view.theme.chart ?? "bars";
  const contact = [b.phone, b.email, b.website && shownWebsite(b.website)].filter(Boolean);
  const title = (
    <>
      <p className={clsx(eyebrow, bold && "text-[color:var(--primary-ink)] opacity-80")}>
        {view.indicative ? INDICATIVE_LABEL : "Proposal"} · {day(view.publishedAt)}
      </p>
      <h1
        className={clsx(
          "mt-3 leading-[1.1] tracking-tight [font-family:var(--proposal-heading)]",
          // Minimal leans on its type: larger and lighter, with the space around it doing the work.
          look.cover === "plain" ? "text-[38px] font-light sm:text-[60px] sm:leading-[1.02]" : "text-[32px] sm:text-[44px]",
          bold ? "text-[color:var(--primary-ink)]" : "text-ink",
        )}
      >
        {view.title} for {view.customer.name}
      </h1>
      <p className={clsx("mt-3 text-[15px]", bold ? "text-[color:var(--primary-ink)] opacity-90" : "text-muted")}>
        {view.customer.address}
      </p>
    </>
  );

  // Each block's own content, by its id. Null when there is nothing to show for it on this proposal (no bill was
  // entered, no terms are set): the block is then left out, unless the business gave it words or a picture of its own.
  const terms = view.terms;
  const blocks = viewBlocks(view);
  // With a battery, the proposal opens on it (8 Nov 2026, Martin: the proposal is about the battery, not the array):
  // the roof with the battery laid over it, or the home's day when there is no solar on the design (or the roof is
  // switched off). The roof then isn't shown a second time in its own block.
  const hero = batteryHero(view, { roofShown: blocks.some((block) => block.id === "roof"), chosen: choice?.chosen });
  const roofPicture = (withHero: BatteryHero | null) => (
    <>
      <Roof view={view} src={urls.roof} hero={withHero} />
      <p className={clsx(fine, "mt-3")}>
        The {view.system.panels} panels as designed, seen from above. {ROOF_NOTE}
        {withHero && ` ${withHero.note}`}
      </p>
    </>
  );
  const content: Record<BlockId, () => React.ReactNode> = {
    cover: () => null,
    system: () => (
      <div className={card}>
        {view.system.details.map((d) => (
          <Line key={d.label} label={d.label} value={d.value} />
        ))}
      </div>
    ),
    roof: () => (view.roof.panels.length > 0 && hero?.kind !== "roof" ? roofPicture(null) : null),
    production: () =>
      view.production ? (
        <div className={card}>
          <p className="text-[15px] text-ink">
            About{" "}
            <strong className="font-semibold [font-variant-numeric:tabular-nums]">
              {view.production.yearKwh.toLocaleString("en-AU")} kWh
            </strong>{" "}
            a year.
          </p>
          <div className="mt-5">
            <Months kwh={view.production.monthlyKwh} style={chart} />
          </div>
          <p className={clsx(fine, "mt-4")}>{PRODUCTION_NOTE}</p>
        </div>
      ) : (
        <p className="text-[15px] text-muted">{NO_SUNSHINE_NOTE}</p>
      ),
    bill: () =>
      view.bill ? (
        <div className={card}>
          {chart !== "table" && <BillBars now={view.bill.now} after={view.bill.after} />}
          <Line label="A year's bill now (estimate)" value={dollars(view.bill.now)} />
          <Line label="A year's bill with this system (estimate)" value={dollars(view.bill.after)} />
          <Line label="Estimated saving a year" value={`about ${dollars(view.bill.saving)}`} strong />
          {view.paybackYears !== null && <Line label="Years for the saving to add up to the price" value={`about ${view.paybackYears}`} />}
          <p className={clsx(fine, "mt-4")}>
            {SAVING_NOTE} {ESTIMATE_NOTE}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-ink">What these figures assume</summary>
            <ul className={clsx(fine, "mt-2 list-disc space-y-1 pl-5")}>
              <li>
                A {view.bill.assumed.interval} bill of {dollars(view.bill.assumed.amount)}, which is about {view.bill.dailyKwh} kWh a day.
              </li>
              <li>
                ${view.bill.assumed.supplyPerDay.toFixed(2)} a day supply charge, ${view.bill.assumed.rate.toFixed(2)} a kWh, and $
                {view.bill.assumed.feedIn.toFixed(2)} a kWh for power sent to the grid.
              </li>
              <li>About {Math.round(view.bill.assumed.selfUseShare * 100)}% of the solar used in the home as it is made.</li>
              <li>The same use every day, one price all day, today&apos;s prices, and no shade.</li>
            </ul>
          </details>
        </div>
      ) : null,
    price: () => (
      <>
        <div className={card}>
          {/* The price as the business writes its prices: one figure with GST in it, or the two parts and the total. */}
          {view.price.gstShown === "excluded" && view.price.beforeGst !== undefined && view.price.gst !== undefined ? (
            <>
              <Line label="Price before GST" value={dollars(view.price.beforeGst)} />
              <Line label="GST" value={dollars(view.price.gst)} />
              <Line label="Price with GST" value={dollars(view.price.incGst)} />
            </>
          ) : (
            <Line label="Price, GST included" value={dollars(view.price.incGst)} />
          )}
          <Line label="Less the federal rebate (estimate)" value={`− ${dollars(view.price.stc)}`} />
          <div className="mt-3 flex items-baseline justify-between gap-4 rounded-lg bg-primary px-4 py-4 text-primary-ink">
            <span className="text-[15px] font-medium">You pay</span>
            <span className="text-[28px] leading-none tracking-tight [font-variant-numeric:tabular-nums]">
              {dollars(view.price.youPay)}
            </span>
          </div>
          {/* Solar Victoria, when it is on the quote: what it would come to if approved, never as the price itself. */}
          {view.price.solarVic && (
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
                With Solar Victoria, if you are eligible and approved
              </p>
              <div className="mt-2">
                <Line label="Solar Victoria rebate" value={`− ${dollars(view.price.solarVic.rebate)}`} />
                <Line label="You would pay" value={dollars(view.price.solarVic.afterRebate)} />
                {view.price.solarVic.loan > 0 && (
                  <>
                    <Line label="Solar Victoria interest-free loan" value={`− ${dollars(view.price.solarVic.loan)}`} />
                    <Line label="To pay up front" value={dollars(view.price.solarVic.upfront)} />
                    <Line
                      label={`Then, for ${view.price.solarVic.loanMonths} months, with no interest`}
                      value={`$${view.price.solarVic.monthly.toFixed(2)} a month`}
                    />
                  </>
                )}
              </div>
              <p className={clsx(fine, "mt-3")}>{view.price.solarVic.note}</p>
            </div>
          )}
          <p className="mt-4 text-[14px] text-ink">Covers: {view.price.includes.join(", ")}.</p>
          <p className={clsx(fine, "mt-2")}>{STC_NOTE}</p>
          {view.indicative && <p className="mt-2 text-[13.5px] font-medium text-ink">{INDICATIVE_PRICE_NOTE}</p>}
          {/* The costs decided on each job that were left out: they may apply, found at the site inspection (as Primero's). */}
          {view.variations && view.variations.length > 0 && (
            <div className="mt-4 rounded-lg border border-line p-3">
              <p className="text-[13.5px] font-medium text-ink">May apply: {view.variations.join(", ")}</p>
              <p className={clsx(fine, "mt-1")}>{VARIATIONS_NOTE}</p>
            </div>
          )}
        </div>
        {b.extra && <p className="mt-5 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{b.extra}</p>}
      </>
    ),
    // The business's own payment terms: what it asks up front, when the rest falls due, and where to pay.
    payment: () =>
      terms && (terms.deposit !== null || terms.milestones.length > 0 || terms.bank) ? (
        <div className={card}>
          {terms.deposit !== null && <Line label="Deposit to go ahead" value={money(terms.deposit)} strong />}
          {terms.milestones.map((m) => (
            <Line key={m.name} label={`${m.name} (${m.percent}%)`} value={money(m.amount)} />
          ))}
          {(terms.deposit !== null || terms.milestones.length > 0) && (
            <p className={clsx(fine, "mt-3")}>
              Worked out from what you pay, {dollars(view.price.youPay)}. Nothing is charged through this page.
            </p>
          )}
          {terms.bank && (
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">Pay by bank transfer to</p>
              <div className="mt-2">
                <Line label="Account name" value={terms.bank.name} />
                <Line label="BSB" value={shownBsb(terms.bank.bsb)} />
                <Line label="Account number" value={terms.bank.number} />
                {terms.bank.reference && <Line label="Reference" value={terms.bank.reference} />}
              </div>
              <p className={clsx(fine, "mt-3")}>{BANK_NOTE}</p>
            </div>
          )}
        </div>
      ) : null,
    timing: () =>
      terms?.installTime ? (
        <div className={card}>
          <Line label="Usual time from going ahead to installation" value={terms.installTime} strong />
          <p className={clsx(fine, "mt-3")}>{TIMING_NOTE}</p>
        </div>
      ) : null,
    // The business's own workmanship warranty, in its own words: its statement to its customer, and labelled as such.
    warranty: () =>
      terms?.warranty ? (
        <div className={card}>
          {terms.warranty.years !== null && (
            <Line
              label={`${b.name}'s workmanship warranty`}
              value={`${terms.warranty.years} ${terms.warranty.years === 1 ? "year" : "years"}`}
              strong
            />
          )}
          {terms.warranty.words && (
            <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{terms.warranty.words}</p>
          )}
          <p className={clsx(fine, "mt-3")}>{warrantyNote(b.name)}</p>
        </div>
      ) : null,
    about: () =>
      b.about || b.points.length > 0 || b.photos.length > 0 ? (
        <>
          {b.about && <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{b.about}</p>}
          {b.points.length > 0 && (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {b.points.map((point) => (
                <li key={point} className="rounded-lg border border-line bg-surface px-4 py-3 text-[14.5px] text-ink">
                  {point}
                </li>
              ))}
            </ul>
          )}
          {b.photos.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {b.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element -- as above
                <img
                  key={photo.id}
                  src={urls.image(photo.id)}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </>
      ) : null,
    "custom-1": () => null,
    "custom-2": () => null,
    "custom-3": () => null,
    accept: () => (
      <>
        {view.indicative ? (
          <Thoughts view={view} actions={actions} chosen={choice?.chosen ?? null} onOpenChat={onOpenChat} />
        ) : (
          <GoAhead view={view} state={state} accepted={accepted} actions={actions} />
        )}
        {deposit && <div className="mt-4">{deposit}</div>}
      </>
    ),
    // The standard terms and conditions, when the business has them on: the details of this agreement (from the
    // proposal's own figures), the consumer information, then the terms as they stood when it was published. Closed
    // until asked for; the tick to go ahead refers to them.
    terms: () => {
      if (view.ownTerms)
        return (
          <div className={card}>
            <p className="text-[15px] text-ink">
              {b.name}&apos;s terms and conditions go with this proposal. Please read them before you go ahead.
            </p>
            {urls.terms ? (
              <a href={urls.terms} className={clsx(button, "mt-4")} download>
                <FileText className="size-4" aria-hidden /> {view.ownTerms.name} (PDF)
              </a>
            ) : (
              <p className={clsx(fine, "mt-3")}>{view.ownTerms.name} (PDF) is attached for your customer to download.</p>
            )}
          </div>
        );
      const contract = view.contract;
      if (!contract) return null;
      const details = contractDetails(view);
      return (
        <details className={card}>
          <summary className="cursor-pointer text-[15px] font-medium text-ink">Read the terms and conditions</summary>
          <h3 className="mt-5 text-[15px] font-semibold text-ink">Details</h3>
          <div className="mt-2">
            {details.rows.map((row) => (
              <Line key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
          <p className="mt-4 text-[13.5px] font-medium text-ink">The documents that make up this agreement, in the order they apply</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] text-ink">
            {details.documents.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ol>
          <h3 className="mt-6 text-[15px] font-semibold text-ink">{contract.netcc.heading}</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{contract.netcc.intro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] text-ink">
            {contract.netcc.guides.map((guide) => (
              <li key={guide}>{guide}</li>
            ))}
          </ul>
          <p className="mt-2 text-[13.5px] text-ink">
            The guides are at{" "}
            <a href={contract.netcc.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {contract.netcc.url.replace(/^https?:\/\//, "")}
            </a>
            . {contract.netcc.seller}
          </p>
          {contract.terms.map((part) => (
            <div key={part.heading} className="mt-5">
              <h3 className="text-[14.5px] font-semibold text-ink">{part.heading}</h3>
              {part.clauses.map((clause) => (
                <p key={clause} className="mt-2 text-[13.5px] leading-relaxed text-ink">
                  {clause}
                </p>
              ))}
            </div>
          ))}
          <p className={clsx(fine, "mt-5")}>Terms version {contract.version}.</p>
        </details>
      );
    },
    conditions: () => (b.conditions ? <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{b.conditions}</p> : null),
  };

  const cover = blocks.find((block) => block.id === "cover");
  /** A block's own words and picture, as the business set them in the customiser. */
  const own = (block: ViewBlock) => (
    <>
      {block.words && <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{block.words}</p>}
      {block.image && (
        // eslint-disable-next-line @next/next/no-img-element -- as above
        <img src={urls.image(block.image.id)} alt="" loading="lazy" className="mt-4 max-h-[26rem] w-full rounded-xl object-cover" />
      )}
    </>
  );

  return (
    <div
      style={{ ...themeVars(view.theme), ...lookVars(view.template) } as React.CSSProperties}
      className="min-h-dvh bg-canvas text-ink [color-scheme:light]"
    >
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-5 sm:px-8">
        {b.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our own route at the size it was kept
          <img src={urls.image(b.logo.id)} alt={b.name} className="h-10 w-auto max-w-[200px] object-contain object-left" />
        ) : (
          <span className="text-[18px] font-semibold tracking-tight text-ink">{b.name}</span>
        )}
        <span className="text-[13px] text-muted">{contact.join(" · ")}</span>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-12 px-5 pb-20 sm:px-8">
        {/* How it opens: the one place the templates differ. Always first, whatever order the rest is in. */}
        <section aria-label="Proposal">
          {look.cover === "colour" ? (
            <div className="rounded-2xl bg-primary px-6 py-12 sm:px-10 sm:py-16">{title}</div>
          ) : look.cover === "split" ? (
            // The photo (or a block of the main colour without one) beside the title, side by side on a wide screen.
            <div className="grid items-stretch gap-6 sm:grid-cols-2 sm:gap-10">
              {b.cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- as above
                <img
                  src={urls.image(b.cover.id)}
                  alt=""
                  className="aspect-[4/3] h-full w-full rounded-2xl object-cover sm:aspect-auto sm:min-h-72"
                />
              ) : (
                <div className="aspect-[4/3] rounded-2xl bg-primary sm:aspect-auto sm:min-h-72" aria-hidden />
              )}
              <div className="flex flex-col justify-center">{title}</div>
            </div>
          ) : look.cover === "plain" ? (
            <div className="border-b border-line pb-10 pt-6 sm:pt-12">{title}</div>
          ) : (
            <>
              {look.cover === "photo" && b.cover && (
                // eslint-disable-next-line @next/next/no-img-element -- as above
                <img src={urls.image(b.cover.id)} alt="" className="mb-8 aspect-[21/9] w-full rounded-2xl object-cover" />
              )}
              {title}
            </>
          )}
          {b.tagline && !bold && <p className="mt-2 text-[15px] text-ink">{b.tagline}</p>}
          {greeting && <div className="mt-6">{greeting}</div>}
          {view.note && <p className="mt-6 max-w-2xl whitespace-pre-line text-[16px] leading-relaxed text-ink">{view.note}</p>}
          {cover && (cover.words || cover.image) && <div className="mt-6">{own(cover)}</div>}
          {hero && <div className="mt-8">{hero.kind === "roof" ? roofPicture(hero) : <BatteryDay hero={hero} />}</div>}
          {view.indicative && (
            <div className="mt-8">
              <p className="max-w-2xl text-[16px] leading-relaxed text-ink">{INDICATIVE_INTRO}</p>
              <div className="mt-4">
                <HowWeWork />
              </div>
            </div>
          )}
          <div className="mt-8">
            <Headline view={view} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className={fine}>The price stands until {day(view.validUntil)}.</p>
            {urls.pdf && (
              <a
                href={urls.pdf}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink underline underline-offset-4"
              >
                <Download className="size-4" aria-hidden /> Download as a PDF
              </a>
            )}
          </div>
        </section>

        {/* With a choice of systems: the options side by side, the one chosen showing below. */}
        {view.options && view.options.length > 1 && <ChooseSystem view={view} choice={choice} locked={state === "accepted"} />}

        {/* The rest, in the business's own order: each block under its heading, with the business's own words and picture first. */}
        {blocks
          .filter((block) => block.id !== "cover")
          .map((block) => ({ block, inner: content[block.id](), hasOwn: Boolean(block.words || block.image) }))
          .filter(({ inner, hasOwn }) => inner || hasOwn)
          .map(({ block, inner, hasOwn }, i) => {
            // On an indicative proposal the business's "going ahead" block asks for their thoughts instead.
            const heading =
              view.indicative && block.id === "accept" && !block.heading
                ? "Your thoughts"
                : blockHeading(block, block.id === "about" ? `About ${b.name}` : "");
            const side = look.headings === "side";
            return (
              <section
                key={block.id}
                aria-label={heading || undefined}
                className={clsx(side && "sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8")}
              >
                {heading && (
                  <h2 className={clsx(h2, side && "sm:sticky sm:top-6 sm:self-start sm:text-[20px]")}>
                    {look.numbered && (
                      <span className="mb-2 block text-[12px] font-medium tracking-[0.2em] text-muted [font-family:inherit]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                    {heading}
                  </h2>
                )}
                <div className={clsx(heading && !side && "mt-4", heading && side && "mt-4 sm:mt-0")}>
                  {hasOwn && own(block)}
                  {inner && <div className={hasOwn ? "mt-4" : undefined}>{inner}</div>}
                </div>
              </section>
            );
          })}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-4xl space-y-1 px-5 py-6 text-[12.5px] text-muted sm:px-8">
          <p className="text-ink">{b.name}</p>
          {b.address && <p>{b.address}</p>}
          <p>{[b.abn && `ABN ${shownAbn(b.abn)}`, ...b.licences].filter(Boolean).join(" · ")}</p>
          <p>{contact.join(" · ")}</p>
        </div>
      </footer>
      {/* Last, so it stays at the foot of the screen all the way down the page, footer included. */}
      {chat}
    </div>
  );
}

/**
 * The systems on offer, side by side: what each is for, its size, what the customer pays, the estimated yearly saving
 * and payback. Choosing one shows it through the rest of the page; going ahead takes the one chosen. Estimates, as
 * everywhere else on the proposal.
 */
function ChooseSystem({ view, choice, locked }: { view: ProposalView; choice?: ProposalPageProps["choice"]; locked: boolean }) {
  const options = view.options ?? [];
  const chosen = choice?.chosen ?? recommendedGoal(view);
  return (
    <section aria-labelledby="choose-system">
      <h2 id="choose-system" className={h2}>
        {locked ? "The system you chose" : view.indicative ? "Compare your systems" : "Choose your system"}
      </h2>
      <p className={clsx(fine, "mt-1")}>Each is priced in full. Savings and payback are estimates from your bill.</p>
      <div
        className={clsx(
          "mt-5 grid gap-3",
          options.length === 2 || options.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
        role="radiogroup"
        aria-label="Systems"
      >
        {options.map((o) => {
          const on = o.goal === chosen;
          return (
            <button
              key={o.goal}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked || !choice?.onChoose}
              onClick={() => choice?.onChoose?.(o.goal)}
              className={clsx(
                "relative flex flex-col rounded-xl border bg-surface p-5 text-left transition-shadow",
                on ? "border-[var(--primary)] shadow-[0_0_0_2px_var(--primary)]" : "border-line",
                !locked && choice?.onChoose && !on && "hover:border-ink/40",
                locked && !on && "opacity-50",
              )}
            >
              {o.recommended && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-ink">
                  Recommended
                </span>
              )}
              <span className="text-[16px] font-semibold text-ink">{o.name}</span>
              <span className="mt-1 text-[13.5px] leading-snug text-muted">{o.promise}</span>
              {o.backup && (
                <span className="mt-2 w-fit rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] font-medium text-ink">
                  Blackout backup
                </span>
              )}
              <span className="mt-4 text-[13.5px] text-ink">
                {o.system.kw.toFixed(2)} kW solar{o.system.batteryKwh > 0 ? ` · ${o.system.batteryKwh} kWh battery` : ""}
              </span>
              {/* What is in it, a line each (as Primero's: comparing options page by page was slow). */}
              {o.system.details.length > 0 && (
                <span className="mt-2 block space-y-0.5 text-[12.5px] text-muted">
                  {o.system.details.slice(0, 4).map((x) => (
                    <span key={x.label} className="block">
                      {x.label}: <span className="text-ink">{x.value}</span>
                    </span>
                  ))}
                </span>
              )}
              <span className="mt-3 text-[24px] font-semibold tabular-nums tracking-tight text-ink">{dollars(o.price.youPay)}</span>
              <span className={fine}>You pay, after the federal rebate</span>
              {o.bill && (
                <span className="mt-3 space-y-0.5 text-[13.5px] text-ink">
                  <span className="block">Saves about {dollars(o.bill.saving)} a year</span>
                  {o.paybackYears !== null && <span className="block">Pays for itself in about {o.paybackYears} years</span>}
                </span>
              )}
              <span className={clsx("mt-4 text-[13px] font-medium", on ? "text-[color:var(--primary)]" : "text-muted")}>
                {on ? (locked ? "Chosen" : "Showing below") : "Show this one"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** What a link shows once its proposal has been taken back: who to contact, and nothing of the proposal. */
export function ProposalGone({ business }: { business: Pick<ProposalView["business"], "name" | "phone" | "email" | "website"> }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-ink">
      <h1 className="text-[26px] leading-tight tracking-tight">This proposal isn&apos;t available any more.</h1>
      <p className="mt-3 text-[15px] text-muted">
        For an up-to-date one, get in touch with {business.name}
        {[business.phone, business.email].filter(Boolean).length
          ? `: ${[business.phone, business.email].filter(Boolean).join(" or ")}`
          : ""}
        .
      </p>
    </main>
  );
}
