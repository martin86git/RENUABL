"use client";

import { useEffect, useState } from "react";
import {
  BatteryCharging,
  Cable,
  Eraser,
  Hand,
  LayoutGrid,
  Maximize,
  MessageCircle,
  MousePointer2,
  PenTool,
  ReceiptText,
  Redo2,
  Ruler,
  SquarePlus,
  Tag,
  Undo2,
  WandSparkles,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import clsx from "clsx";

// The roof is drawn, not a photo: a made-up home, so no real one is shown. Everything on and around it is the design
// tool's own look: the figures strip, the pads of rounds in the corners, the kit top centre, the dock, the panels.
const COLS = 6;
const ROWS = 2;
const PANEL = { w: 30, h: 48, gap: 2 };
const ORIGIN = { x: 222, y: 142 };
const PANELS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { x: ORIGIN.x + col * (PANEL.w + PANEL.gap), y: ORIGIN.y + row * (PANEL.h + PANEL.gap) };
});
const mid = (p: { x: number; y: number }) => ({ x: p.x + PANEL.w / 2, y: p.y + PANEL.h / 2 });
const INVERTER = { x: 452, y: 262 };
/** The order the string takes the panels in: along the top row, then back along the bottom. */
const WIRED = [...PANELS.slice(0, COLS), ...PANELS.slice(COLS).reverse()];
const STRING = WIRED.map(mid)
  .map((c) => `${c.x},${c.y}`)
  .join(" ");
const STRING_COLOUR = "#86efac";

// One turn of the loop, in ticks: the array goes down a panel a tick, the inverter is added, the string is run, and it rests.
const TICK_MS = 260;
const AT = { inverter: PANELS.length + 3, string: PANELS.length + 8, done: PANELS.length + 24, end: PANELS.length + 38 };
const WATTS = 475;
/** The figures strip's own look, cell by cell, as in the tool. */
const cell = "flex min-w-0 flex-1 flex-col justify-center border-r border-white/15 px-[2.2cqw] py-[1.2cqw] last:border-r-0";
const stepLabel = "text-[1.15cqw] font-medium uppercase tracking-[0.2em] text-white/50";
const under = "truncate text-[1.5cqw] tabular-nums text-white/60";
/** A round or half-round on the picture, as the tool's are: a soft plate, dark when its tool is the one in hand. */
const plate = (on: boolean) =>
  clsx(
    "absolute flex items-center border shadow-lift backdrop-blur-md",
    on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface/90 text-ink",
  );
const icon = "size-[2.9cqw]";

/**
 * The design tool at work, for the front page, looking as the tool itself
 * does: the figures strip above the picture, the pads of rounds in its
 * corners, the kit top centre, the dock and Suggest a layout along its foot.
 * On a loop, an array is laid on the roof a panel at a time (Add a panel in
 * hand), an inverter is added, and a string is run through the panels
 * (String panels in hand), with the figures keeping up. An illustration:
 * nothing on it can be pressed, the roof is drawn rather than a real home,
 * and it says it is an example. With reduced motion it is shown finished and still.
 */
export function DesignerDemo() {
  const [tick, setTick] = useState(AT.done);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // It starts from an empty roof once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTick(0);
    const timer = window.setInterval(() => setTick((t) => (t >= AT.end ? 0 : t + 1)), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const laid = Math.min(PANELS.length, tick);
  const inverter = tick >= AT.inverter;
  const run = Math.max(0, Math.min(1, (tick - AT.string) / (AT.done - AT.string)));
  const strung = Math.min(PANELS.length, Math.floor(run * (PANELS.length + 0.5)));
  const tool = tick < PANELS.length ? "panel" : tick >= AT.string && run < 1 ? "string" : "select";
  const choosing = tick >= AT.inverter - 2 && tick < AT.string - 1;
  const last = laid > 0 && laid < PANELS.length ? PANELS[laid - 1] : null;
  const kw = (laid * WATTS) / 1000;

  return (
    <figure
      className="w-full min-w-0 rounded-xl border border-line bg-canvas p-2 [container-type:inline-size] sm:p-3"
      aria-label="The design tool at work: an example"
    >
      <div aria-hidden className="pointer-events-none select-none">
        {/* The figures, in one dark strip above the picture. */}
        <div className="mb-[1cqw] flex rounded-lg bg-ink text-white">
          <div className={cell}>
            <p className={stepLabel}>1 · Solar</p>
            <p className="whitespace-nowrap leading-tight">
              <span className="text-[3cqw] font-medium tabular-nums tracking-[-0.02em] text-sun-line">{kw.toFixed(2)}</span>
              <span className="ml-[0.6cqw] text-[1.5cqw] text-white/60">kW</span>
            </p>
            <p className={under}>
              {laid} panels of {WATTS} W
            </p>
          </div>
          <div className={cell}>
            <p className={stepLabel}>2 · Makes</p>
            <p className="whitespace-nowrap leading-tight">
              <span className="text-[3cqw] font-medium tabular-nums tracking-[-0.02em]">{(kw * 3.8).toFixed(1)}</span>
              <span className="ml-[0.6cqw] text-[1.5cqw] text-white/60">kWh a day</span>
            </p>
            <p className={under}>{Math.round(kw * 3.8 * 365).toLocaleString("en-AU")} kWh a year</p>
          </div>
          <div className={cell}>
            <p className={stepLabel}>3 · Stores</p>
            <p className="whitespace-nowrap leading-tight">
              <span className="text-[3cqw] font-medium">–</span>
              <span className="ml-[0.6cqw] text-[1.5cqw] text-white/60">no battery</span>
            </p>
            <p className={under}>{inverter ? "5 kW of inverter" : "no inverter chosen"}</p>
          </div>
          <div className={cell}>
            <p className={stepLabel}>4 · For this home</p>
            <p className="mt-[0.5cqw]">
              <span className="inline-flex items-center gap-[0.6cqw] rounded-full bg-sun-line px-[1.4cqw] py-[0.5cqw] text-[1.5cqw] font-medium text-white">
                <ReceiptText className="size-[1.7cqw]" /> Add bill
              </span>
            </p>
            <p className={under}>For the saving and payback.</p>
          </div>
        </div>

        {/* The picture, with the tool's controls resting on it. */}
        <div className="relative overflow-hidden rounded-lg">
          <svg viewBox="0 0 640 400" className="block w-full">
            {/* A made-up home from above: lawn, a drive, and a hipped roof. */}
            <rect width="640" height="400" fill="#4c6b45" />
            <rect x="0" y="330" width="640" height="70" fill="#8d8f8c" />
            <rect x="470" y="150" width="70" height="180" fill="#a9a7a1" />
            <circle cx="90" cy="110" r="46" fill="#3a5636" />
            <circle cx="560" cy="70" r="34" fill="#3a5636" />
            <circle cx="70" cy="270" r="30" fill="#41603c" />
            <polygon points="180,110 460,110 460,300 180,300" fill="#7e838a" />
            <polygon points="180,110 460,110 400,205 240,205" fill="#8a8f96" />
            <polygon points="180,300 460,300 400,205 240,205" fill="#70757c" />
            <polygon points="180,110 240,205 180,300" fill="#787d84" />
            <polygon points="460,110 400,205 460,300" fill="#84898f" />
            <line x1="240" y1="205" x2="400" y2="205" stroke="#5b6067" strokeWidth="2" />
            <polygon points="180,110 460,110 460,300 180,300" fill="none" stroke="#565b62" strokeWidth="1.5" />

            {/* Where a click would put the next panel: the outline the tool shows. */}
            {tool === "panel" && PANELS[laid] && (
              <rect
                x={PANELS[laid].x}
                y={PANELS[laid].y}
                width={PANEL.w}
                height={PANEL.h}
                fill="#ffffff"
                fillOpacity="0.18"
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            )}
            {/* The panels: dark glass with a thin grey edge and the arrow of the way each faces; on a string, its colour. */}
            {PANELS.slice(0, laid).map((p, i) => {
              const wired = WIRED.indexOf(p) < strung;
              const c = mid(p);
              return (
                <g key={i}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={PANEL.w}
                    height={PANEL.h}
                    fill={wired ? STRING_COLOUR : "#0d1219"}
                    fillOpacity={wired ? 0.72 : 0.9}
                    stroke={wired ? STRING_COLOUR : last === p ? "var(--sun-line)" : "#93a0b1"}
                    strokeWidth={last === p ? 0.9 : 0.5}
                  />
                  <path
                    d={`M${c.x},${c.y + 8} L${c.x},${c.y - 8} M${c.x - 4},${c.y - 3.5} L${c.x},${c.y - 8} L${c.x + 4},${c.y - 3.5}`}
                    fill="none"
                    stroke={wired ? "#0b0c0e" : "#93a0b1"}
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
            {/* The string's own line through the panels it has taken, and its letter. */}
            {strung > 1 && (
              <polyline
                points={WIRED.slice(0, strung)
                  .map(mid)
                  .map((c) => `${c.x},${c.y}`)
                  .join(" ")}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {strung > 0 && (
              <g transform={`translate(${mid(WIRED[0]).x} ${mid(WIRED[0]).y})`}>
                <circle r="7" fill="#0b0c0e" stroke={STRING_COLOUR} strokeWidth="1.2" />
                <text y="3.2" fontSize="9" fontWeight="700" fill="#ffffff" textAnchor="middle">
                  A
                </text>
              </g>
            )}
            {run >= 1 && <polyline points={STRING} fill="none" stroke="none" />}
            {/* The inverter, standing where it was put. */}
            {inverter && (
              <g transform={`translate(${INVERTER.x} ${INVERTER.y})`}>
                <rect x="-11" y="-14" width="22" height="28" rx="3" fill="#0b0c0e" stroke="var(--sun-line)" strokeWidth="1.2" />
                <path d="M1,-8 L-4,1 H0 L-1.5,8 L4,-1.5 H0 Z" fill="var(--sun-line)" />
                <rect x="-24" y="-31" width="48" height="13" rx="6.5" fill="#0b0c0e" stroke="var(--sun-line)" strokeWidth="0.8" />
                <text y="-21.6" fontSize="7.5" fontWeight="600" fill="#ffffff" textAnchor="middle">
                  5 kW
                </text>
              </g>
            )}
            {/* The size of the array, as the arrays list writes it, once it is whole. */}
            {laid === PANELS.length && (
              <g transform={`translate(${ORIGIN.x + (COLS * (PANEL.w + PANEL.gap)) / 2} ${ORIGIN.y - 8})`}>
                <rect x="-27" y="-13" width="54" height="13" rx="6.5" fill="#0b0c0e" stroke="var(--sun-line)" strokeWidth="1" />
                <text y="-3.6" fontSize="7.5" fontWeight="600" fill="#ffffff" textAnchor="middle">
                  1 · {kw.toFixed(2)} kW
                </text>
              </g>
            )}
            {/* The pointer, where the work is. */}
            {(last || (run > 0 && run < 1 && strung > 0)) && (
              <g
                transform={`translate(${(last ? mid(last) : mid(WIRED[Math.max(0, strung - 1)])).x + 5} ${(last ? mid(last) : mid(WIRED[Math.max(0, strung - 1)])).y + 6})`}
              >
                <path
                  d="M0,0 L0,13 L3.6,9.6 L6,15 L8,14 L5.6,8.8 L10,8.6 Z"
                  fill="#ffffff"
                  stroke="#0b0c0e"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </svg>

          {/* Top left: Select in the orange circle, Add a panel to its right, Erase beneath, and the arrays round under that. */}
          <div className="absolute left-[1.5cqw] top-[1.5cqw] size-[15.5cqw]">
            <span
              className={clsx(
                plate(tool === "panel"),
                "left-[6cqw] top-[1.5cqw] h-[6.5cqw] w-[9.5cqw] justify-end rounded-r-full pr-[1.8cqw]",
              )}
            >
              <SquarePlus className={icon} />
            </span>
            <span
              className={clsx(
                plate(false),
                "left-[1.5cqw] top-[6cqw] h-[9.5cqw] w-[6.5cqw] items-end justify-center rounded-b-full pb-[1.8cqw]",
              )}
            >
              <Eraser className={icon} />
            </span>
            <span
              className={clsx(
                "absolute left-0 top-0 flex size-[9.5cqw] items-center justify-center rounded-full bg-sun-line text-white shadow-lift",
                tool === "select" ? "ring-[0.4cqw] ring-white" : "ring-1 ring-white/40",
              )}
            >
              <MousePointer2 className="size-[4cqw]" />
            </span>
            <span className={clsx(plate(false), "left-[1.5cqw] top-[16.2cqw] size-[6.5cqw] justify-center rounded-full")}>
              <LayoutGrid className={icon} />
            </span>
          </div>

          {/* Top centre: the kit as three rounds, the panel the largest with its count, the inverter and battery either side. */}
          <div className="absolute left-1/2 top-[1.5cqw] flex -translate-x-1/2 items-center">
            <span
              className={clsx(
                "-mr-[4cqw] flex h-[6.5cqw] w-[10cqw] items-center justify-start rounded-l-full border pl-[1.8cqw] shadow-lift backdrop-blur-md",
                choosing
                  ? "border-primary bg-primary text-primary-ink"
                  : inverter
                    ? "border-line bg-surface/90 text-ink"
                    : "border-line bg-surface/90 text-muted",
              )}
            >
              <Zap className={icon} />
            </span>
            <span className="relative z-10 flex size-[9.5cqw] flex-col items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lift">
              <svg viewBox="0 0 24 24" className="size-[3.5cqw]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                <path d="M5.2 4h13.6l2.7 12H2.5z" />
                <path d="M3.9 10h16.2M9.4 4 8 16M14.6 4 16 16" strokeWidth="1.2" />
                <path d="M12 16v4M8.5 20h7" strokeLinecap="round" />
              </svg>
              <span className="mt-[0.2cqw] text-[1.4cqw] font-medium leading-none tabular-nums">{laid}</span>
            </span>
            <span className="-ml-[4cqw] flex h-[6.5cqw] w-[10cqw] items-center justify-end rounded-r-full border border-line bg-surface/90 pr-[1.8cqw] text-muted shadow-lift backdrop-blur-md">
              <BatteryCharging className={icon} />
            </span>
          </div>
          {/* The inverter's choices, open beneath the kit while one is being picked. */}
          {choosing && (
            <div className="absolute left-1/2 top-[12.2cqw] w-[40cqw] -translate-x-1/2 rounded-lg border border-line bg-surface p-[1.4cqw] shadow-lift">
              <p className="text-[1.25cqw] font-medium uppercase tracking-[0.14em] text-muted">Add one</p>
              <p className="mt-[0.8cqw] rounded-md bg-surface-2 px-[1.2cqw] py-[0.9cqw] text-[1.6cqw] font-medium text-ink">
                + 5 kW single phase inverter
              </p>
              <p className="mt-[0.5cqw] px-[1.2cqw] text-[1.3cqw] text-muted">5 kW · 2 inputs · strings can be checked</p>
            </div>
          )}

          {/* Top right: String panels in the circle, Trace a roof face to its left, the guide line beneath. */}
          <div className="absolute right-[1.5cqw] top-[1.5cqw] size-[15.5cqw]">
            <span
              className={clsx(plate(false), "right-[6cqw] top-[1.5cqw] h-[6.5cqw] w-[9.5cqw] justify-start rounded-l-full pl-[1.8cqw]")}
            >
              <PenTool className={icon} />
            </span>
            <span
              className={clsx(
                plate(false),
                "right-[1.5cqw] top-[6cqw] h-[9.5cqw] w-[6.5cqw] items-end justify-center rounded-b-full pb-[1.8cqw]",
              )}
            >
              <Ruler className={icon} />
            </span>
            <span
              className={clsx(
                "absolute right-0 top-0 flex size-[9.5cqw] items-center justify-center rounded-full border shadow-lift",
                tool === "string" ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink",
              )}
            >
              <Cable className="size-[4cqw]" />
            </span>
          </div>

          {/* Bottom left: the hand, with the zoom either side of it. */}
          <div className="absolute bottom-[3.5cqw] left-[1.5cqw] size-[15.5cqw]">
            <span
              className={clsx(plate(false), "bottom-[1.5cqw] left-[6cqw] h-[6.5cqw] w-[9.5cqw] justify-end rounded-r-full pr-[1.8cqw]")}
            >
              <ZoomIn className={icon} />
            </span>
            <span
              className={clsx(
                plate(false),
                "bottom-[6cqw] left-[1.5cqw] h-[9.5cqw] w-[6.5cqw] items-start justify-center rounded-t-full pt-[1.8cqw]",
              )}
            >
              <ZoomOut className={icon} />
            </span>
            <span className="absolute bottom-0 left-0 flex size-[9.5cqw] items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lift">
              <Hand className="size-[4cqw]" />
            </span>
          </div>

          {/* The dock, centred, with the comment round standing proud of it; Suggest a layout in the corner. */}
          <div className="absolute bottom-[3.5cqw] left-1/2 flex -translate-x-1/2 items-center gap-[0.6cqw] rounded-2xl border border-line bg-surface/90 p-[0.8cqw] text-ink shadow-lift backdrop-blur-md">
            <span className="flex size-[5cqw] items-center justify-center">
              <Undo2 className="size-[2.5cqw]" />
            </span>
            <span className="flex size-[5cqw] items-center justify-center">
              <Redo2 className="size-[2.5cqw]" />
            </span>
            <span className="-my-[2cqw] mx-[0.5cqw] flex size-[8cqw] items-center justify-center rounded-full border border-line bg-surface shadow-lift">
              <MessageCircle className="size-[3.5cqw]" />
            </span>
            <span className="flex size-[5cqw] items-center justify-center">
              <Maximize className="size-[2.5cqw]" />
            </span>
            <span className="flex size-[5cqw] items-center justify-center">
              <Tag className="size-[2.5cqw]" />
            </span>
          </div>
          <span className="absolute bottom-[3.5cqw] right-[1cqw] flex h-[5.5cqw] items-center gap-[1cqw] rounded-2xl border border-line bg-surface/90 px-[1.8cqw] text-[1.7cqw] font-medium text-sun-ink shadow-lift backdrop-blur-md">
            <WandSparkles className="size-[2.5cqw]" /> Suggest a layout
          </span>
        </div>
      </div>
      <figcaption className="px-1 pt-2 text-xs text-muted">
        An example of the design tool at work, on a drawn roof. In the tool you work on the real roof from above, and the quote builds
        beside it as you go.
      </figcaption>
    </figure>
  );
}
