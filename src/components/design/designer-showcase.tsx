"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  CalendarDays,
  Check,
  FileSignature,
  Mail,
  MapPin,
  MessageCircle,
  ReceiptText,
  Send,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { AerialScene, PanelDefs, SolarPanel } from "./aerial-home";
import { AFTER_STEPS, AUTOMATIONS, COMING_SOON_LABEL, type FeatureStatus } from "@/lib/domain/design/landing";

/**
 * The front page's moving examples: the quote building itself as a drawn roof
 * is designed, a proposal sent and answered from the designer, and what a
 * signature sets going. Illustrations only: a made-up home and customer,
 * example figures, nothing to press. Each runs on its own loop; with reduced
 * motion each is shown finished and still.
 */

/** Milliseconds into a loop of `total`, ticking every `step`; the end, still, with reduced motion. */
function useTimeline(total: number, step = 100) {
  const [t, setT] = useState(total);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // It starts from the beginning once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setT(0);
    const timer = window.setInterval(() => setT((v) => (v + step >= total ? 0 : v + step)), step);
    return () => window.clearInterval(timer);
  }, [total, step]);
  return t;
}

export function SoonTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted",
        className,
      )}
    >
      {COMING_SOON_LABEL}
    </span>
  );
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

// ---------------------------------------------------------------------------
// 1. The quote that builds itself.

/** A panel portrait (as on the hip and the garage) and landscape (as on the north face, to fit more rows under the ridge). */
const WATTS = 475;
const PORTRAIT = { w: 30, h: 46 };
const LANDSCAPE = { w: 44, h: 28 };
const GAP = 2;
type Spot = { x: number; y: number; w: number; h: number };
/** A row of panels of one size, left to right. */
const row = (x: number, y: number, n: number, size: { w: number; h: number }): Spot[] =>
  Array.from({ length: n }, (_, i) => ({ x: x + i * (size.w + GAP), y, ...size }));
/**
 * Three arrays, laid as a designer would on this roof (the house in `aerial-home.tsx`): the north face in landscape rows that
 * shorten towards the ridge, the west hip where it is wide enough, and the flat garage roof.
 */
const ARRAYS = [
  {
    at: 1,
    spots: [...row(164, 66, 5, LANDSCAPE), ...row(188, 96, 4, LANDSCAPE), ...row(234, 126, 2, LANDSCAPE)],
    letter: "A",
    colour: "#86efac",
  },
  {
    at: 2,
    spots: [...row(126, 112, 1, PORTRAIT), ...row(126, 160, 1, PORTRAIT), ...row(158, 136, 1, PORTRAIT)],
    letter: "B",
    colour: "#7dd3fc",
  },
  { at: 3, spots: row(470, 200, 4, PORTRAIT), letter: "C", colour: "#fcd34d" },
] as const;
/** The way a string runs through an array: row by row, turning back at the end of each. */
function snake(spots: readonly Spot[]): { x: number; y: number }[] {
  const rows = new Map<number, Spot[]>();
  for (const p of spots) rows.set(p.y, [...(rows.get(p.y) ?? []), p]);
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, r], i) => (i % 2 ? [...r].sort((p, q) => q.x - p.x) : [...r].sort((p, q) => p.x - q.x)))
    .map((p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 }));
}

/** The steps of the loop, each with the line the picture shows while it happens. */
const STEPS: { at: number; text: string; status: FeatureStatus; icon: typeof Sparkles }[] = [
  { at: 0, text: "Site created from the lead's address", status: "live", icon: MapPin },
  { at: 3300, text: "Array A: rails, splices and roof kits counted", status: "live", icon: Sparkles },
  { at: 6600, text: "Array B: the quote keeps up, panel by panel", status: "live", icon: Sparkles },
  { at: 9900, text: "Array C on the flat garage: split array cost added", status: "live", icon: Sparkles },
  { at: 13200, text: "Tilted 10°: tilt kits and tilt frames added", status: "live", icon: Sparkles },
  { at: 16500, text: "Suggested for 8.55 kW of panels: 8 kW three-phase hybrid (107%)", status: "live", icon: Zap },
  { at: 19800, text: "Three-phase inverter: installation fee and meter added", status: "live", icon: Zap },
  { at: 23100, text: "From output and the bill: 16 kWh battery recommended", status: "live", icon: BatteryCharging },
  { at: 26400, text: "Strings drawn and checked against the inverter", status: "live", icon: Sparkles },
];
const AUTO_TOTAL = 31500;

/** Where the eye goes at each step: the part of the picture lit (x, y, width, height), the quote lines and the overlays that go with it. */
type Overlay = "lead" | "stats" | "kit" | "supply" | "bill";
const FOCUS: { area: [number, number, number, number] | null; keys: string[]; overlays: Overlay[] }[] = [
  { area: [108, 46, 508, 240], keys: [], overlays: ["lead"] },
  { area: [156, 58, 252, 104], keys: ["panels", "rails", "splices", "tile", "install"], overlays: ["stats"] },
  { area: [118, 104, 76, 112], keys: ["panels", "rails", "splices", "tile", "install"], overlays: ["stats"] },
  { area: [450, 176, 166, 110], keys: ["tin", "kliplok", "split"], overlays: ["stats"] },
  { area: [450, 176, 166, 110], keys: ["tiltKit", "tilt"], overlays: [] },
  { area: [430, 232, 32, 36], keys: ["inverter"], overlays: ["kit"] },
  { area: [430, 232, 32, 36], keys: ["phase", "meter"], overlays: ["supply"] },
  { area: [430, 204, 32, 64], keys: ["battery", "batteryInstall"], overlays: ["kit", "bill"] },
  { area: [114, 56, 500, 230], keys: [], overlays: [] },
];
/** The spotlight's move from one part of the picture to the next. */
const SPOT_MOVE = "x 700ms ease, y 700ms ease, width 700ms ease, height 700ms ease, opacity 500ms ease";
/** An overlay that isn't part of what is being shown steps back. */
const dim = (on: boolean) => (on ? "opacity-100" : "opacity-35");
/** How long after its step begins the inverter (or battery) is chosen from the dropdown and goes on the design. */
const CHOSEN_AFTER = 2200;

const railLengths = (n: number) => Math.ceil((n * (1.134 + 0.1) * 2 * 1.05) / 4.8);

interface QuoteLine {
  key: string;
  group: string;
  label: string;
  amount: number;
  /** The step it first appeared at, and the last step it changed at. */
  from: number;
  changed: number;
}

/** The quote at a step, line by line, with example prices. */
function quoteAt(step: number, chosen: { inverter: boolean; battery: boolean }): QuoteLine[] {
  const panels = step >= 3 ? 18 : step >= 2 ? 14 : step >= 1 ? 11 : 0;
  if (!panels) return [];
  const counted = Math.min(step, 3);
  const kw = (panels * WATTS) / 1000;
  const tiled = Math.min(panels, 14);
  const lines: QuoteLine[] = [
    { key: "panels", group: "Panels", label: `${panels} × ${WATTS} W panels`, amount: panels * 168, from: 1, changed: counted },
    {
      key: "rails",
      group: "Racking",
      label: `Rails (${railLengths(panels)} lengths)`,
      amount: railLengths(panels) * 58,
      from: 1,
      changed: counted,
    },
    {
      key: "splices",
      group: "Racking",
      label: `Rail splices (${railLengths(panels)})`,
      amount: railLengths(panels) * 9,
      from: 1,
      changed: counted,
    },
    {
      key: "tile",
      group: "Racking",
      label: `Roof kits, tile (${Math.ceil((tiled * WATTS) / 2000)})`,
      amount: Math.ceil((tiled * WATTS) / 2000) * 62,
      from: 1,
      changed: Math.min(step, 2),
    },
  ];
  if (step >= 3)
    lines.push(
      { key: "tin", group: "Racking", label: "Roof kit, tin, flat garage (1)", amount: 64, from: 3, changed: 3 },
      { key: "kliplok", group: "Racking", label: "Kliplok interfaces (10)", amount: 10 * 6, from: 3, changed: 3 },
    );
  if (step >= 4) lines.push({ key: "tiltKit", group: "Racking", label: "Tilt kit, 10 to 15° (1)", amount: 95, from: 4, changed: 4 });
  if (chosen.inverter)
    lines.push({ key: "inverter", group: "Inverter", label: "8 kW three-phase hybrid inverter", amount: 2450, from: 5, changed: 5 });
  if (chosen.battery)
    lines.push({ key: "battery", group: "Battery", label: "16 kWh battery (2 modules)", amount: 6400, from: 7, changed: 7 });
  lines.push({
    key: "install",
    group: "Installation",
    label: `Solar installation: ${kw.toFixed(2)} kW`,
    amount: kw * 300,
    from: 1,
    changed: counted,
  });
  if (step >= 3) lines.push({ key: "split", group: "Installation", label: "Split array: a third array", amount: 150, from: 3, changed: 3 });
  if (step >= 4) lines.push({ key: "tilt", group: "Installation", label: "Tilt frames: 4 panels", amount: 60, from: 4, changed: 4 });
  if (step >= 6)
    lines.push(
      { key: "phase", group: "Installation", label: "Three-phase installation", amount: 150, from: 6, changed: 6 },
      { key: "meter", group: "Electrical", label: "Smart meter, three phase", amount: 310, from: 6, changed: 6 },
    );
  if (chosen.battery)
    lines.push({ key: "batteryInstall", group: "Installation", label: "Battery installation", amount: 1800, from: 7, changed: 7 });
  return lines;
}

export function AutomationDemo() {
  const t = useTimeline(AUTO_TOTAL);
  const step = STEPS.reduce((s, x, i) => (t >= x.at ? i : s), 0);
  const now = STEPS[step];
  const into = t - now.at;
  // The inverter and the battery are chosen from their dropdowns a moment into their steps, as a person would.
  const chosen = { inverter: step > 5 || (step === 5 && into >= CHOSEN_AFTER), battery: step > 7 || (step === 7 && into >= CHOSEN_AFTER) };
  const menu = step === 5 && into < CHOSEN_AFTER + 600 ? "inverter" : step === 7 && into < CHOSEN_AFTER + 600 ? "battery" : null;
  const pressing = menu !== null && into >= CHOSEN_AFTER - 450;
  const focus = FOCUS[step];
  const lit = (o: Overlay) => focus.overlays.includes(o);
  const [fx, fy, fw, fh] = focus.area ?? [0, 0, 640, 400];
  const lines = quoteAt(step, chosen);
  const price = lines.reduce((s, l) => s + l.amount, 0) * 1.2 * 1.1;
  const panels = ARRAYS.filter((a) => step >= a.at).reduce((s, a) => s + a.spots.length, 0);
  const strung = step >= 8;
  const Icon = now.icon;

  return (
    <figure className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]" aria-label="The quote building itself: an example">
      <div
        aria-hidden
        className="pointer-events-none relative select-none overflow-hidden rounded-xl border border-line bg-canvas p-2 [container-type:inline-size]"
      >
        <div className="relative overflow-hidden rounded-lg">
          <svg viewBox="0 0 640 400" className="block w-full">
            {/* A made-up home from above, drawn to read like an aerial photograph (`aerial-home.tsx`). */}
            <AerialScene />
            <PanelDefs />

            {ARRAYS.map((a, ai) =>
              a.spots.map((p, i) => {
                const on = step >= a.at;
                const tilted = ai === 2 && step >= 4;
                return (
                  <g
                    key={`${ai}-${i}`}
                    style={{ transitionDelay: on ? `${i * 90}ms` : "0ms" }}
                    className={clsx("transition-opacity duration-300", on ? "opacity-100" : "opacity-0")}
                  >
                    {tilted && <rect x={p.x + 2} y={p.y + p.h - 2} width={p.w - 2} height={9} fill="#000" fillOpacity="0.28" />}
                    <SolarPanel
                      x={p.x}
                      y={tilted ? p.y - 3 : p.y}
                      w={p.w}
                      h={tilted ? p.h - 6 : p.h}
                      tint={strung ? a.colour : undefined}
                      picked={step === a.at || (tilted && step === 4)}
                    />
                  </g>
                );
              }),
            )}
            {/* The strings, once drawn: a line through each array and its letter. */}
            {strung &&
              ARRAYS.map((a) => {
                const order = snake(a.spots);
                return (
                  <g key={a.letter}>
                    <polyline
                      points={order.map((c) => `${c.x},${c.y}`).join(" ")}
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <circle cx={order[0].x} cy={order[0].y} r="7" fill="#0b0c0e" stroke={a.colour} strokeWidth="1.2" />
                    <text x={order[0].x} y={order[0].y + 3.2} fontSize="9" fontWeight="700" fill="#fff" textAnchor="middle">
                      {a.letter}
                    </text>
                  </g>
                );
              })}
            {/* The inverter and battery on the wall once added. */}
            {chosen.inverter && (
              <g transform="translate(446 250)">
                <rect x="-11" y="-14" width="22" height="28" rx="3" fill="#0b0c0e" stroke="var(--sun-line)" strokeWidth="1.2" />
                <path d="M1,-8 L-4,1 H0 L-1.5,8 L4,-1.5 H0 Z" fill="var(--sun-line)" />
              </g>
            )}
            {chosen.battery && (
              <g transform="translate(446 222)">
                <rect x="-10" y="-14" width="20" height="28" rx="3" fill="#0b0c0e" stroke="#86efac" strokeWidth="1.2" />
                <rect x="-5" y="-6" width="10" height="14" rx="1" fill="none" stroke="#86efac" strokeWidth="1" />
              </g>
            )}

            {/* The spotlight: everything but the part being worked on is dimmed, and that part is ringed. It moves smoothly from one step to the next. */}
            <defs>
              <filter id="dm-soft" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
              <mask id="dm-spot" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="400">
                <rect width="640" height="400" fill="white" />
                <rect
                  rx="12"
                  fill="black"
                  filter="url(#dm-soft)"
                  style={{ x: fx - 6, y: fy - 6, width: fw + 12, height: fh + 12, transition: SPOT_MOVE }}
                />
              </mask>
            </defs>
            <rect
              width="640"
              height="400"
              fill="#05070a"
              mask="url(#dm-spot)"
              style={{ opacity: focus.area ? 0.6 : 0, transition: "opacity 500ms ease" }}
            />
            <rect
              rx="10"
              fill="none"
              stroke="var(--sun-line)"
              strokeWidth="1.6"
              style={{ x: fx - 4, y: fy - 4, width: fw + 8, height: fh + 8, opacity: focus.area ? 0.95 : 0, transition: SPOT_MOVE }}
            />
          </svg>

          {/* The kit, top centre, as in the designer: the inverter, the panels (with how many) and the battery. Each opens its choices beneath it. */}
          <div className={clsx("absolute left-1/2 top-[1.5cqw] z-10 -translate-x-1/2 transition-opacity duration-500", dim(lit("kit")))}>
            <div className="flex items-center">
              <span
                className={clsx(
                  "-mr-[3cqw] flex h-[5cqw] w-[8cqw] items-center justify-start rounded-l-full border pl-[1.4cqw] shadow-lift",
                  menu === "inverter" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface/95 text-ink",
                )}
              >
                <Zap className="size-[2.3cqw]" />
              </span>
              <span className="relative z-10 flex size-[7.4cqw] flex-col items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lift">
                <svg
                  viewBox="0 0 24 24"
                  className="size-[2.8cqw]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                >
                  <path d="M5.2 4h13.6l2.7 12H2.5z" />
                  <path d="M3.9 10h16.2M9.4 4 8 16M14.6 4 16 16" strokeWidth="1.2" />
                </svg>
                <span className="text-[1.25cqw] font-medium leading-none tabular-nums">{panels}</span>
              </span>
              <span
                className={clsx(
                  "-ml-[3cqw] flex h-[5cqw] w-[8cqw] items-center justify-end rounded-r-full border pr-[1.4cqw] shadow-lift",
                  menu === "battery" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface/95 text-ink",
                )}
              >
                <BatteryCharging className="size-[2.3cqw]" />
              </span>
            </div>
            {menu === "inverter" && (
              <div className="absolute left-1/2 top-full mt-[1cqw] w-[44cqw] -translate-x-1/2 animate-[fade-up_250ms_ease-out] rounded-lg border border-line bg-surface p-[1.2cqw] shadow-lift">
                <p className="flex items-center justify-center gap-[0.8cqw] rounded-md border border-forest px-[1cqw] py-[0.9cqw] text-[1.45cqw] font-medium text-ink">
                  <Sparkles className="size-[1.8cqw] text-sun-ink" /> Suggest one for these panels
                </p>
                <div className="mt-[0.8cqw] space-y-[0.6cqw] rounded-md border border-sun-line bg-sun p-[0.8cqw]">
                  <div className="rounded-md bg-surface p-[1cqw]">
                    <p className="text-[1.05cqw] font-medium uppercase tracking-[0.16em] text-muted">
                      Three phase hybrid (takes a battery)
                    </p>
                    <p className="mt-[0.3cqw] text-[1.5cqw] font-semibold text-ink">8 kW three-phase hybrid inverter</p>
                    <p className="mt-[0.3cqw] text-[1.25cqw] leading-snug text-ink-2">
                      8.55 kW of panels is 107% of its 8 kW, within the 133% it takes. 2 inputs: strings can be checked.
                    </p>
                    <span
                      className={clsx(
                        "mt-[0.6cqw] inline-block rounded px-[0.8cqw] py-[0.3cqw] text-[1.35cqw] font-semibold underline underline-offset-4 transition-colors",
                        pressing ? "bg-sun-line text-white no-underline" : "text-ink",
                      )}
                    >
                      Use this one
                    </span>
                  </div>
                  <div className="rounded-md bg-surface/70 p-[1cqw] opacity-70">
                    <p className="text-[1.05cqw] font-medium uppercase tracking-[0.16em] text-muted">Single phase hybrid</p>
                    <p className="mt-[0.3cqw] text-[1.4cqw] font-semibold text-ink">10 kW single-phase hybrid inverter</p>
                  </div>
                </div>
              </div>
            )}
            {menu === "battery" && (
              <div className="absolute left-1/2 top-full mt-[1cqw] w-[44cqw] -translate-x-1/2 animate-[fade-up_250ms_ease-out] rounded-lg border border-line bg-surface p-[1.2cqw] shadow-lift">
                <p className="text-[1.05cqw] font-medium uppercase tracking-[0.16em] text-muted">On this design</p>
                <p className="mt-[0.3cqw] text-[1.35cqw] text-muted">None: this design is solar only.</p>
                <div className="mt-[0.8cqw] rounded-md border border-sun-line bg-sun p-[1cqw]">
                  <p className="flex items-center gap-[0.6cqw] text-[1.5cqw] font-semibold text-sun-ink">
                    <Sparkles className="size-[1.8cqw]" /> Recommended for this home: about 16 kWh
                  </p>
                  <p className="mt-[0.3cqw] text-[1.25cqw] leading-snug text-ink-2">
                    Sized from what the panels spare on a middling day and the evenings on the customer&apos;s bill.
                  </p>
                  <div className="mt-[0.6cqw] rounded-md bg-surface p-[1cqw]">
                    <p className="text-[1.45cqw] font-semibold text-ink">2 × 8 kWh battery module</p>
                    <p className="text-[1.2cqw] text-ink-2">Same maker as the inverter on the design.</p>
                    <span
                      className={clsx(
                        "mt-[0.5cqw] inline-block rounded px-[0.8cqw] py-[0.3cqw] text-[1.35cqw] font-semibold underline underline-offset-4 transition-colors",
                        pressing ? "bg-sun-line text-white no-underline" : "text-ink",
                      )}
                    >
                      Use this
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* What the design adds up to, top left. */}
          <div
            className={clsx(
              "absolute left-[1.5cqw] top-[1.5cqw] flex items-stretch overflow-hidden rounded-lg bg-ink text-white shadow-lift transition-opacity duration-500",
              dim(lit("stats")),
            )}
          >
            <div className="px-[1.8cqw] py-[1cqw]">
              <p className="text-[1.15cqw] font-medium uppercase tracking-[0.2em] text-white/50">Solar</p>
              <p className="text-[2.6cqw] font-medium tabular-nums leading-tight text-sun-line">
                {((panels * WATTS) / 1000).toFixed(2)} kW
              </p>
            </div>
            <div className="border-l border-white/15 px-[1.8cqw] py-[1cqw]">
              <p className="text-[1.15cqw] font-medium uppercase tracking-[0.2em] text-white/50">Arrays</p>
              <p className="text-[2.6cqw] font-medium tabular-nums leading-tight">{ARRAYS.filter((a) => step >= a.at).length}</p>
            </div>
            <div className="border-l border-white/15 px-[1.8cqw] py-[1cqw]">
              <p className="text-[1.15cqw] font-medium uppercase tracking-[0.2em] text-white/50">Stores</p>
              <p className="text-[2.6cqw] font-medium tabular-nums leading-tight">{step >= 7 ? "16 kWh" : "–"}</p>
            </div>
          </div>
          {/* The lead it came from, top right; the supply and bill once known. */}
          <div className="absolute right-[1.5cqw] top-[1.5cqw] flex flex-col items-end gap-[0.8cqw]">
            <span
              className={clsx(
                "flex items-center gap-[0.8cqw] rounded-full border bg-surface/95 px-[1.6cqw] py-[0.8cqw] text-[1.5cqw] text-ink shadow-lift transition-opacity duration-500",
                lit("lead") ? "border-sun-line ring-2 ring-sun-line" : "border-line",
                dim(lit("lead")),
              )}
            >
              <MapPin className="size-[1.8cqw] text-sun-line" /> Sarah N. · 14 Sample Street
            </span>
            {step >= 6 && (
              <span
                className={clsx(
                  "rounded-full bg-ink px-[1.6cqw] py-[0.6cqw] text-[1.4cqw] font-medium text-white shadow-lift transition-opacity duration-500",
                  lit("supply") ? "ring-2 ring-sun-line" : "",
                  dim(lit("supply")),
                )}
              >
                Supply: three phase
              </span>
            )}
            {step >= 7 && (
              <span
                className={clsx(
                  "rounded-full bg-ink px-[1.6cqw] py-[0.6cqw] text-[1.4cqw] font-medium text-white shadow-lift transition-opacity duration-500",
                  lit("bill") ? "ring-2 ring-sun-line" : "",
                  dim(lit("bill")),
                )}
              >
                Bill: $620 a quarter
              </span>
            )}
          </div>
          {/* What just happened, bottom centre. */}
          <div
            key={step}
            className="absolute bottom-[2.5cqw] left-1/2 flex max-w-[92%] -translate-x-1/2 animate-[fade-up_300ms_ease-out] items-center gap-[1cqw] rounded-full border border-line bg-surface/95 py-[0.9cqw] pl-[1.2cqw] pr-[1.8cqw] text-[1.75cqw] text-ink shadow-lift backdrop-blur-md"
          >
            <span className="flex size-[3.4cqw] shrink-0 items-center justify-center rounded-full bg-sun-line text-white">
              <Icon className="size-[1.9cqw]" />
            </span>
            <span className="truncate">{now.text}</span>
            {now.status === "soon" && <SoonTag className="shrink-0 !text-[1.2cqw]" />}
          </div>
        </div>
      </div>

      {/* The quote, beside the picture, line by line as the design grows. */}
      <div aria-hidden className="pointer-events-none flex min-h-[22rem] select-none flex-col rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Quote</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-sun-ink">
            <Sparkles className="size-3" /> Builds itself
          </span>
        </div>
        <ul className="mt-3 flex-1 space-y-1">
          {lines.length === 0 && <li className="py-6 text-center text-[13px] text-muted">Waiting for the first panel…</li>}
          {lines.map((l) => {
            const fresh = focus.keys.length ? focus.keys.includes(l.key) : l.changed === step;
            const back = focus.keys.length > 0 && !fresh;
            return (
              <li
                key={l.key}
                className={clsx(
                  "flex items-baseline justify-between gap-3 rounded px-2 py-1 text-[12.5px] transition-all duration-500",
                  fresh ? "bg-sun text-ink ring-1 ring-sun-line" : "text-ink-2",
                  back && "opacity-35",
                )}
              >
                <span className="min-w-0 truncate">
                  {fresh && <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sun-ink">Auto</span>}
                  {l.label}
                </span>
                <span className="shrink-0 tabular-nums">{money(l.amount)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[12px] text-muted">With your margin and GST</span>
          <span className="text-[20px] font-medium tabular-nums text-ink">{lines.length ? money(price) : "–"}</span>
        </div>
      </div>
      <figcaption className="text-xs text-muted lg:col-span-2">
        An example on a drawn roof, with example prices. In the tool, the prices are your own and the roof is the real one from above.
      </figcaption>
    </figure>
  );
}

/** The automations, as a list beside the demo. */
export function AutomationList() {
  return (
    <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      {AUTOMATIONS.map((a) => (
        <li key={a.key} className="border-t border-line-strong pt-3">
          <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium text-ink">
            {a.title}
            {a.status === "soon" && <SoonTag />}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 2. A note and the proposal sent from the designer, answered like a text.

const NOTE = "Hi Sarah, here's your design with the battery we spoke about. Any questions, just reply here.";
const ASK = "Thanks! Could we add an EV charger too?";
const ANSWER = "Yes, added and your proposal's updated.";
/** The conversation's beats: the note typed and sent, the email arriving, the proposal opened, a question and its answer, the signature. */
const TALK = {
  typed: 3200,
  sent: 4000,
  emailed: 4800,
  opening: 6600,
  delivered: 7200,
  opened: 7800,
  asking: 9200,
  asked: 10600,
  answered: 12600,
  signed: 14800,
  total: 19000,
};

function Bubble({ mine, children, show = true }: { mine?: boolean; children: React.ReactNode; show?: boolean }) {
  if (!show) return null;
  return (
    <div className={clsx("flex animate-[fade-up_300ms_ease-out]", mine ? "justify-end" : "justify-start")}>
      <p
        className={clsx(
          "max-w-[85%] rounded-2xl px-3 py-1.5 text-[12.5px] leading-snug",
          mine ? "rounded-br-md bg-[#0a84ff] text-white" : "rounded-bl-md bg-surface-2 text-ink",
        )}
      >
        {children}
      </p>
    </div>
  );
}

/** The roof on the proposal: the demo home with its panels, cropped to the house and garage. */
function ProposalRoof() {
  return (
    <svg viewBox="104 40 516 250" className="mt-1.5 block w-full overflow-hidden rounded-md">
      <AerialScene />
      <PanelDefs />
      {ARRAYS.flatMap((a) => a.spots).map((p, i) => (
        <SolarPanel key={i} x={p.x} y={p.y} w={p.w} h={p.h} />
      ))}
    </svg>
  );
}

export function ConversationDemo() {
  const t = useTimeline(TALK.total);
  const typed = NOTE.slice(0, Math.round(Math.min(1, t / TALK.typed) * NOTE.length));
  const sent = t >= TALK.sent;
  const record = [
    { at: TALK.sent, icon: Send, text: "Proposal sent with a note" },
    { at: TALK.emailed, icon: Mail, text: "Note emailed to Sarah, with her link" },
    { at: TALK.opened, icon: Check, text: "Opened by Sarah" },
    { at: TALK.asked, icon: MessageCircle, text: `Sarah: "${ASK}"` },
    { at: TALK.answered, icon: MessageCircle, text: "You replied (emailed to Sarah too)" },
    { at: TALK.signed, icon: FileSignature, text: "Signed. Moved to Won" },
  ].filter((r) => t >= r.at);

  return (
    <figure
      className="grid w-full gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)_minmax(0,0.85fr)]"
      aria-label="A proposal sent and answered from the designer: an example"
    >
      {/* In the designer: the chat beside the roof, and Send proposal. */}
      <div aria-hidden className="pointer-events-none flex min-h-[21rem] select-none flex-col rounded-xl border border-line bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">In the designer</p>
        <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
          <Bubble mine show={sent}>
            {NOTE}
          </Bubble>
          <Bubble show={t >= TALK.asked}>{ASK}</Bubble>
          <Bubble mine show={t >= TALK.answered}>
            {ANSWER}
          </Bubble>
        </div>
        <div className="mt-3 rounded-lg border border-line bg-canvas p-2.5">
          <p className="min-h-[3.4em] text-[12.5px] leading-snug text-ink">
            {sent ? <span className="text-muted">Message Sarah…</span> : typed}
            {!sent && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-ink align-middle" />}
          </p>
          <div className="mt-2 flex justify-end">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                t >= TALK.typed && !sent ? "scale-95 bg-sun-line text-white" : "bg-primary text-primary-ink",
              )}
            >
              <Send className="size-3.5" /> Send proposal
            </span>
          </div>
        </div>
      </div>

      {/* What the customer sees: the email with the note and their link, then the proposal in the business's own colours with the chat beside it. */}
      <div aria-hidden className="pointer-events-none min-w-0 select-none">
        <div className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
          <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <span className="flex gap-1">
              <span className="size-2 rounded-full bg-line-strong" />
              <span className="size-2 rounded-full bg-line-strong" />
              <span className="size-2 rounded-full bg-line-strong" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-0.5 text-[11px] text-muted">
              {t >= TALK.delivered ? "Your solar proposal" : "Sarah's inbox"}
            </span>
          </div>
          {t < TALK.emailed && <div className="flex flex-1 items-center justify-center text-[12.5px] text-muted">Sarah&apos;s inbox</div>}
          {t >= TALK.emailed && t < TALK.delivered && (
            <div className="flex-1 animate-[fade-up_300ms_ease-out] p-4">
              <p className="flex items-center gap-2 text-[11px] text-muted">
                <Mail className="size-3.5" /> New email · just now
              </p>
              <p className="mt-2 text-[14px] font-medium text-ink">Your Business Solar sent you a message</p>
              <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px] leading-snug text-ink-2">{NOTE}</p>
              <span
                className={clsx(
                  "mt-3 inline-flex rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-transform",
                  t >= TALK.opening ? "scale-95 bg-sun-line" : "bg-[#0f4c5c]",
                )}
              >
                Open your proposal
              </span>
              <p className="mt-2 text-[10.5px] text-muted">Sent by email. Sarah answers on her proposal.</p>
            </div>
          )}
          {t >= TALK.delivered && (
            <div className="grid flex-1 animate-[fade-up_300ms_ease-out] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* Some of the proposal: the business's brand, the roof with its panels, the system and the price. */}
              <div className="min-w-0 border-line sm:border-r">
                <div className="bg-[#0f4c5c] px-3 py-2.5 text-white">
                  <p className="text-[9.5px] uppercase tracking-[0.16em] text-white/70">Your logo · your colours</p>
                  <p className="text-[13.5px] font-medium">Your Business Solar</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Proposal for Sarah</p>
                  <ProposalRoof />
                  <ul className="mt-2 space-y-0.5 text-[11.5px] text-ink-2">
                    <li className="flex justify-between gap-2">
                      <span>Solar</span>
                      <span className="tabular-nums text-ink">8.55 kW · 18 panels</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>Battery</span>
                      <span className="tabular-nums text-ink">16 kWh</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>Saving a year (estimate)</span>
                      <span className="tabular-nums text-ink">about $2,350</span>
                    </li>
                  </ul>
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
                    <span className="text-[11px] text-muted">You pay, after STCs</span>
                    <span className="text-[16px] font-medium tabular-nums text-ink">$21,480</span>
                  </div>
                  <span
                    className={clsx(
                      "mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium",
                      t >= TALK.signed ? "bg-positive-soft text-positive" : "bg-[#0f4c5c] text-white",
                    )}
                  >
                    {t >= TALK.signed ? (
                      <>
                        <Check className="size-3.5" /> Signed by Sarah
                      </>
                    ) : (
                      "I'd like to go ahead"
                    )}
                  </span>
                </div>
              </div>
              {/* The chat, beside the proposal. */}
              <div className="flex min-w-0 flex-col">
                <p className="border-b border-line px-3 py-2 text-[11px] font-medium text-ink">Questions? Message Your Business Solar</p>
                <div className="flex flex-1 flex-col justify-end gap-2 px-2.5 py-2.5">
                  <Bubble>{NOTE}</Bubble>
                  {t >= TALK.asking && t < TALK.asked && (
                    <div className="flex justify-end">
                      <span className="rounded-2xl rounded-br-md bg-surface-2 px-3 py-2 text-[14px] leading-none text-muted">•••</span>
                    </div>
                  )}
                  <Bubble mine show={t >= TALK.asked}>
                    {ASK}
                  </Bubble>
                  <Bubble show={t >= TALK.answered}>{ANSWER}</Bubble>
                </div>
                <p className="mx-2.5 mb-2.5 rounded-full border border-line px-3 py-1.5 text-[11px] text-muted">Write a message</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In the CRM: every step on the deal's record. */}
      <div aria-hidden className="pointer-events-none flex min-h-[21rem] select-none flex-col rounded-xl border border-line bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">In your CRM · Sarah Nguyen</p>
        <ol className="mt-3 space-y-2.5">
          {record.length === 0 && <li className="text-[12.5px] text-muted">Nothing yet.</li>}
          {record.map((r, i) => {
            const Ico = r.icon;
            return (
              <li key={r.text} className="flex animate-[fade-up_300ms_ease-out] items-start gap-2.5">
                <span
                  className={clsx(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    i === record.length - 1 ? "bg-sun-line text-white" : "bg-surface-2 text-ink-2",
                  )}
                >
                  <Ico className="size-3.5" />
                </span>
                <span className="text-[12.5px] leading-snug text-ink">{r.text}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="text-xs text-muted lg:col-span-3">An example, with a made-up business and customer.</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// 3. What a signature sets going.

const BOM = [
  ["475 W panels", 18],
  ["Rails, 4.8 m", 10],
  ["Rail splices", 10],
  ["Roof kits, tile", 4],
  ["Roof kit, tin", 1],
  ["Kliplok interfaces", 10],
  ["Tilt kit, 10 to 15°", 1],
  ["8 kW three-phase hybrid", 1],
  ["Battery module, 8 kWh", 2],
] as const;
const COSTED = [
  ["Solar installation", 2565],
  ["Split array", 150],
  ["Tilt frames", 60],
  ["Three-phase", 150],
  ["Battery", 1800],
] as const;
/** The order things happen in: signed, ordered, booked (with reminders), installed, and only then the installer's invoice. */
const AFTER = { signed: 0, order: 3000, schedule: 7000, installed: 11400, invoice: 12600, billed: 14200, total: 19500 };

function Stage({
  on,
  icon: Icon,
  title,
  status,
  children,
}: {
  on: boolean;
  icon: typeof Truck;
  title: string;
  status: FeatureStatus;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex min-h-[19rem] flex-col rounded-xl border bg-surface p-4 transition-all duration-500",
        on ? "border-sun-line shadow-lift" : "border-line opacity-60",
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink">
        <Icon className={clsx("size-4", on ? "text-sun-line" : "text-muted")} /> {title}
        {status === "soon" && <SoonTag />}
      </p>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

export function AfterSigningDemo() {
  const t = useTimeline(AFTER.total);
  const status = (key: string) => AFTER_STEPS.find((s) => s.key === key)?.status ?? "live";
  const expected = COSTED.reduce((s, [, n]) => s + n, 0);
  return (
    <figure className="w-full" aria-label="What a signed proposal sets going: an example">
      <div aria-hidden className="pointer-events-none grid select-none gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stage on={t >= AFTER.signed} icon={FileSignature} title="Signed proposals" status={status("signed")}>
          <ul className="space-y-1.5 text-[12.5px]">
            <li className="flex items-center justify-between rounded bg-sun px-2 py-1.5 text-ink">
              <span>Sarah N. · 8.55 kW + 16 kWh</span>
              <Check className="size-3.5 text-positive" />
            </li>
            <li className="flex justify-between px-2 py-1 text-ink-2">
              <span>Tom R. · 6.65 kW</span>
              <span className="text-muted">Mon</span>
            </li>
            <li className="flex justify-between px-2 py-1 text-ink-2">
              <span>Priya K. · 10 kWh</span>
              <span className="text-muted">Fri</span>
            </li>
          </ul>
        </Stage>
        <Stage on={t >= AFTER.order} icon={Truck} title="Ordering Station" status={status("order")}>
          <ul className="space-y-0.5 text-[12px]">
            {BOM.map(([name, qty], i) => (
              <li
                key={name}
                style={{ transitionDelay: `${i * 120}ms` }}
                className={clsx("flex justify-between transition-opacity duration-300", t >= AFTER.order ? "opacity-100" : "opacity-0")}
              >
                <span className="text-ink-2">{name}</span>
                <span className="tabular-nums text-ink">{qty}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-ink">
              <Send className="size-3" /> Send to supplier
            </span>
            {status("send-order") === "soon" && <SoonTag />}
          </p>
        </Stage>
        <Stage on={t >= AFTER.schedule} icon={CalendarDays} title="Install Scheduler" status={status("scheduler")}>
          <div className="grid grid-cols-5 gap-1 text-center text-[10.5px] text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <div key={d}>
                <p>{d}</p>
                <div
                  className={clsx(
                    "mt-1 h-12 rounded",
                    d === "Thu" && t >= AFTER.installed
                      ? "bg-positive text-[10px] leading-tight text-white"
                      : d === "Thu" && t >= AFTER.schedule
                        ? "bg-sun-line text-[10px] leading-tight text-white"
                        : "bg-surface-2",
                  )}
                >
                  {d === "Thu" && t >= AFTER.schedule && (
                    <span className="block px-0.5 pt-1.5">
                      Sarah N.{t >= AFTER.installed && <Check className="mx-auto mt-0.5 size-3" />}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-[11.5px]">
            {[
              { at: AFTER.schedule + 1500, text: "Reminder sent: install on Thursday" },
              { at: AFTER.schedule + 3000, text: "Reminder sent: clear the way to the switchboard" },
              { at: AFTER.installed, text: "Installed. Waiting for the installer's invoice" },
            ]
              .filter((r) => t >= r.at)
              .map((r) => (
                <li key={r.text} className="flex animate-[fade-up_300ms_ease-out] items-start gap-1.5 text-ink-2">
                  <Bell className="mt-0.5 size-3.5 shrink-0 text-sun-line" /> {r.text}
                </li>
              ))}
          </ul>
        </Stage>
        <Stage on={t >= AFTER.invoice} icon={ReceiptText} title="Installer Invoices" status={status("invoices")}>
          <ul className="space-y-0.5 text-[12px]">
            {COSTED.map(([name, n]) => (
              <li key={name} className="flex justify-between">
                <span className="text-ink-2">{name}</span>
                <span className="tabular-nums text-ink">{money(n)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-0.5 border-t border-line pt-2 text-[12px]">
            <p className="flex justify-between">
              <span className="text-muted">Allowed in the quote</span>
              <span className="tabular-nums">{money(expected)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted">Their invoice</span>
              <span className="tabular-nums">{t >= AFTER.billed ? money(expected + 200) : "After the install"}</span>
            </p>
            {t >= AFTER.billed && (
              <p className="mt-1 animate-[fade-up_300ms_ease-out] rounded bg-warning-soft px-2 py-1 text-warning">
                +$200: switchboard work, not on the quote
              </p>
            )}
          </div>
        </Stage>
      </div>
      <div aria-hidden className="mt-3 hidden items-center justify-center gap-2 text-[12px] text-muted lg:flex">
        Signed <ArrowRight className="size-3.5" /> ordered <ArrowRight className="size-3.5" /> booked <ArrowRight className="size-3.5" />{" "}
        installed <ArrowRight className="size-3.5" /> invoice checked
      </div>
      <figcaption className="mt-2 text-xs text-muted">An example, with made-up customers and example prices.</figcaption>
    </figure>
  );
}
