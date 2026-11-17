"use client";

import { useEffect, useState } from "react";
import { SolBadge } from "./sol-icon";

/**
 * What shows while Sol is working on an answer. Three acts (18 Nov 2026, Martin: "it should always start with thinking…
 * at halfway say preparing to launch… with the sol sun logo spinning and then when its finishing… take off"):
 *
 * 1. **Thinking.** Always first, for `THINK_MS`, then the drawings in the signal orange take turns (rays, a battery
 *    charging, a panel catching light, power out to the grid, a home lighting up), each with its own line.
 * 2. **Preparing to launch.** From `LAUNCH_PREP_MS`, about halfway through a usual answer: Sol's sun, spinning.
 * 3. **Take off.** Once the answer is in (`launching`), the sun lifts away and the line goes with it. A place that shows
 *    the thinking only while it waits keeps it a moment longer with `useSolLaunch` (or uses `SolWorking`).
 *
 * Purely a sign that he's busy: none of it says what he is doing. Still with reduced motion; the words still change.
 */
const STEPS: { draw: () => React.ReactElement; lines: string[] }[] = [
  { draw: Sun, lines: ["Catching rays…", "Chasing the midday peak…", "Following the sun…"] },
  { draw: Battery, lines: ["Charging the battery…", "Topping up the cells…", "Storing it for tonight…"] },
  { draw: Panel, lines: ["Generating kWh…", "Tilting towards the sun…", "Reading the irradiance…"] },
  { draw: Grid, lines: ["Exporting to the grid…", "Balancing the load…", "Checking the feed-in…"] },
  { draw: Home, lines: ["Powering the home…", "Optimising the strings…", "Running the numbers…"] },
];

/** How long "Thinking…" holds before the drawings start. */
export const THINK_MS = 2200;
/** Each drawing and its line in the middle act. */
const EVERY_MS = 2600;
/** About halfway through a usual answer: "Preparing to launch…". */
export const LAUNCH_PREP_MS = 9000;
/** Once the answer is in: the sun spins for `COUNTDOWN_MS` (so a quick answer still prepares to launch), then lifts. */
const COUNTDOWN_MS = 500;
const LIFT_MS = 900;
export const TAKE_OFF_MS = COUNTDOWN_MS + LIFT_MS;

/**
 * Keeps the thinking on screen through its take off: `showing` stays true for `TAKE_OFF_MS` after `busy` ends, with
 * `launching` true for that time.
 */
export function useSolLaunch(busy: boolean): { showing: boolean; launching: boolean } {
  // Worked out in the render that sees `busy` end, so the thinking never blinks out before it takes off.
  const [was, setWas] = useState(busy);
  const [launching, setLaunching] = useState(false);
  if (was !== busy) {
    setWas(busy);
    setLaunching(was && !busy);
  }
  useEffect(() => {
    if (!launching) return;
    const t = window.setTimeout(() => setLaunching(false), TAKE_OFF_MS);
    return () => window.clearTimeout(t);
  }, [launching]);
  return { showing: busy || launching, launching };
}

/** The thinking while `busy`, taking off once it ends; nothing otherwise. */
export function SolWorking({ busy, say }: { busy: boolean; say?: string }) {
  const { showing, launching } = useSolLaunch(busy);
  return showing ? <SolThinking say={say} launching={launching} /> : null;
}

/**
 * `say` is the opening line in place of "Thinking…". `plain` keeps one quiet line with the sun for a wait that isn't
 * Sol thinking (opening a conversation, finding the past ones).
 */
export function SolThinking({ say, launching = false, plain = false }: { say?: string; launching?: boolean; plain?: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  // When the take off began, read against `elapsed`, so the countdown and the lift follow each other.
  const [launchAt, setLaunchAt] = useState<number | null>(null);
  if (launching && launchAt === null) setLaunchAt(elapsed);
  if (!launching && launchAt !== null) setLaunchAt(null);
  const lifting = launchAt !== null && elapsed - launchAt >= COUNTDOWN_MS;
  useEffect(() => {
    const from = Date.now();
    const t = window.setInterval(() => setElapsed(Date.now() - from), 100);
    return () => window.clearInterval(t);
  }, []);

  const act = plain
    ? "think"
    : lifting
      ? "launch"
      : launching || elapsed >= LAUNCH_PREP_MS
        ? "prep"
        : elapsed >= THINK_MS
          ? "draw"
          : "think";
  let mark: React.ReactElement;
  let line: string;
  let key: string;
  if (act === "think") {
    mark = <Sun />;
    line = say ?? "Thinking…";
    key = "think";
  } else if (act === "draw") {
    const tick = Math.floor((elapsed - THINK_MS) / EVERY_MS);
    const step = STEPS[(tick + 1) % STEPS.length];
    const Draw = step.draw;
    mark = <Draw />;
    line = step.lines[Math.floor(tick / STEPS.length) % step.lines.length];
    key = `d${tick}`;
  } else if (act === "prep") {
    mark = (
      <span className="inline-flex motion-safe:animate-[spin_1.4s_linear_infinite]">
        <SolBadge className="size-6" />
      </span>
    );
    line = "Preparing to launch…";
    key = "prep";
  } else {
    mark = (
      <span className="relative inline-flex motion-safe:animate-[sol-lift_900ms_cubic-bezier(.5,0,.75,0)_forwards]">
        <SolBadge className="size-6" />
        <span aria-hidden className="absolute left-1/2 top-full h-3 w-px -translate-x-1/2 bg-gradient-to-b from-sun-line to-transparent" />
      </span>
    );
    line = "…and take off";
    key = "launch";
  }

  return (
    <div className="flex items-center gap-2.5 text-xs text-muted" role="status" aria-live="polite">
      <span
        key={`m${key}`}
        className="inline-flex size-6 items-center justify-center text-sun-line motion-safe:animate-[sol-in_300ms_ease-out]"
      >
        {mark}
      </span>
      <span
        key={`l${key}`}
        className={
          act === "launch"
            ? "font-medium text-ink-2 motion-safe:animate-[sol-away_900ms_ease-in_forwards]"
            : "motion-safe:animate-[sol-in_300ms_ease-out]"
        }
      >
        {line}
      </span>
      <style>{`@keyframes sol-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}@keyframes sol-lift{0%{transform:translateY(0) rotate(0)}25%{transform:translateY(2px) rotate(90deg)}100%{transform:translateY(-34px) scale(.6) rotate(360deg);opacity:0}}@keyframes sol-away{0%,40%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-6px)}}`}</style>
    </div>
  );
}

const svg = {
  viewBox: "0 0 24 24",
  className: "size-6",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
};

function Sun() {
  return (
    <svg {...svg}>
      <g className="origin-center motion-safe:animate-[spin_3s_linear_infinite]" style={{ transformBox: "fill-box" }}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line key={i} x1={12 + 6.5 * Math.cos(a)} y1={12 + 6.5 * Math.sin(a)} x2={12 + 9.5 * Math.cos(a)} y2={12 + 9.5 * Math.sin(a)} />
          );
        })}
      </g>
      <circle cx="12" cy="12" r="3.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Battery() {
  return (
    <svg {...svg}>
      <rect x="4" y="6" width="14" height="12" rx="2" />
      <line x1="20.5" y1="10" x2="20.5" y2="14" strokeWidth="2" />
      <rect x="6" y="8" height="8" rx="0.8" fill="currentColor" stroke="none" width="10">
        <animate attributeName="width" values="1;10;10" keyTimes="0;0.8;1" dur="1.8s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function Panel() {
  return (
    <svg {...svg}>
      <path d="M5 19 8 11h12l-3 8z" />
      <path d="M9.5 15h9M12 11l-1.5 8M16 11l-1.5 8" strokeWidth="1" />
      {[
        [5, 4, 7, 7],
        [10, 2.5, 10.5, 6],
        [2.5, 7.5, 5.5, 9],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}>
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
        </line>
      ))}
    </svg>
  );
}

function Grid() {
  return (
    <svg {...svg}>
      <path d="M17 21 19 4M21 21 19 4M16 9h6M15.5 13h7" strokeWidth="1.2" />
      <path d="M3 14h12" strokeDasharray="1.5 2" strokeWidth="1" />
      <circle r="1.6" cy="14" fill="currentColor" stroke="none">
        <animate attributeName="cx" values="3;15" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Home() {
  return (
    <svg {...svg}>
      <path d="M4 11 12 4l8 7M6 10v10h12V10" />
      <rect x="10" y="13" width="4" height="4" fill="currentColor" stroke="none">
        <animate attributeName="opacity" values="0.15;1;0.15" dur="1.6s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}
