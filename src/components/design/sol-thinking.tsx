"use client";

import { useEffect, useState } from "react";

/**
 * What shows while Sol is working on an answer (as Primero's): a small drawing in the signal orange that changes every
 * few seconds (a turning sun, a battery filling, a panel catching rays, power running out to the grid, a home lighting
 * up), each with its own line. Purely a sign that he's busy: none of it says what he is doing.
 */
const STEPS: { draw: () => React.ReactElement; lines: string[] }[] = [
  { draw: Sun, lines: ["Catching rays…", "Chasing the midday peak…", "Following the sun…"] },
  { draw: Battery, lines: ["Charging the battery…", "Topping up the cells…", "Storing it for tonight…"] },
  { draw: Panel, lines: ["Generating kWh…", "Tilting towards the sun…", "Reading the irradiance…"] },
  { draw: Grid, lines: ["Exporting to the grid…", "Balancing the load…", "Checking the feed-in…"] },
  { draw: Home, lines: ["Powering the home…", "Optimising the strings…", "Running the numbers…"] },
];

// Each drawing and line stays a few seconds; five drawings, three lines each, so a minute passes before one repeats.
const EVERY_MS = 4000;

export function SolThinking({ say }: { say?: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), EVERY_MS);
    return () => window.clearInterval(t);
  }, []);
  const step = STEPS[tick % STEPS.length];
  const line = step.lines[Math.floor(tick / STEPS.length) % step.lines.length];
  const Draw = step.draw;
  return (
    <div className={`flex items-center gap-2.5 text-xs text-muted`} role="status" aria-live="polite">
      <span
        key={tick % STEPS.length}
        className={`inline-flex size-6 items-center justify-center text-sun-line motion-safe:animate-[sol-in_300ms_ease-out]`}
      >
        <Draw />
      </span>
      <span key={say ?? `l${tick}`} className="motion-safe:animate-[sol-in_300ms_ease-out]">
        {say ?? line}
      </span>
      <style>{`@keyframes sol-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}`}</style>
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
