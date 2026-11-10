"use client";

/**
 * A day with the system, on the customer's proposal (10 Nov 2026, Martin: what a customer is buying isn't where the
 * panels go, it is what happens in their home through a day). The system they are looking at, played through a
 * summer, autumn or winter day: the sun crossing their roof with each panel lighting as it turns to the sun, and
 * beside it what the panels make, what their home uses, the battery filling and emptying and what the grid still
 * supplies. Worked out in the page from the proposal's own customer copy (the panels, the month's estimated output,
 * the bill's daily use, the battery), so it follows the system they choose and holds nothing the copy doesn't.
 * An estimate, said so beside it; no shade in it, as the output it rests on has none.
 */
import { useEffect, useMemo, useRef } from "react";
import type { ProposalView } from "@/lib/domain/design/proposal";
import { TILT } from "@/lib/domain/design/tilt";
import { DayOverlay, HomeDayCard, useHomeDay } from "./home-day";

type Px = readonly [number, number];

/** Picture units in a metre: so lines keep a sensible weight whatever the roof's size. */
const PER_M = 10;
/** The least the picture shows either side of the panels' middle, metres: room for the sun's arc round a small array. */
const LEAST_HALF_M = 7;

/** Whether the proposal has what a day needs: panels on the roof and an output estimate for the home's state. */
export const hasDay = (view: Pick<ProposalView, "production" | "roof">) => view.production !== null && view.roof.panels.length > 0;

export function ProposalDay({ view }: { view: ProposalView }) {
  const panels = useMemo(() => {
    const each = view.system.panels > 0 ? view.system.kw / view.system.panels : 0;
    return view.roof.panels.map((flat, n) => {
      const corners: Px[] = [0, 1, 2, 3].map((i) => [flat[i * 2], flat[i * 2 + 1]] as const);
      const aspect = view.roof.aspects?.[n];
      return {
        corners,
        x: corners.reduce((sum, c) => sum + c[0], 0) / 4,
        y: corners.reduce((sum, c) => sum + c[1], 0) / 4,
        kw: each,
        // A proposal published before each panel's own tilt and facing were kept: a common roof, looking north.
        tilt: aspect?.[0] ?? TILT.roof,
        facing: aspect?.[1] ?? 0,
      };
    });
  }, [view.roof.panels, view.roof.aspects, view.system.kw, view.system.panels]);
  const battery = view.system.eveningKwh ?? view.system.batteryKwh;
  const state = useHomeDay(
    {
      latitude: view.roof.lat,
      panels,
      monthKwh: view.production?.monthlyKwh ?? [],
      homeDayKwh: view.bill?.dailyKwh ?? null,
      batteryKwh: battery,
      terrain: null,
    },
    true,
  );
  // It plays once it is scrolled to, the first time, unless the reader has asked for no motion.
  const box = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const { setAt, setPlaying } = state;
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const watch = new IntersectionObserver(
      (seen) => {
        if (played.current || !seen.some((s) => s.isIntersecting)) return;
        played.current = true;
        if (still) return;
        setAt(10);
        setPlaying(true);
      },
      { threshold: 0.5 },
    );
    watch.observe(el);
    return () => watch.disconnect();
    // The setters are the same from one render to the next in what they do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state.day || !state.step || panels.length === 0) return null;
  const xs = panels.flatMap((p) => p.corners.map((c) => c[0]));
  const ys = panels.flatMap((p) => p.corners.map((c) => c[1]));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(LEAST_HALF_M, (Math.max(...xs) - Math.min(...xs)) / 2 + 3, (Math.max(...ys) - Math.min(...ys)) / 2 + 3) * PER_M;
  const frame = { x: cx * PER_M - half, y: cy * PER_M - half, w: half * 2, h: half * 2 };
  const drawn = panels.map((p) => p.corners.map(([x, y]) => [x * PER_M, y * PER_M] as const));
  const u = Math.round((frame.w / 260) * 100) / 100;
  return (
    <div ref={box} className="grid items-start gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <svg
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        className="block aspect-square w-full max-w-[16rem] justify-self-center rounded-2xl"
        role="img"
        aria-label={`Your ${view.system.panels} panels from above, lit as the sun reaches them through the day. North is up.`}
      >
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="#2a313c" />
        {drawn.map((corners, n) => (
          <polygon
            key={n}
            points={corners.map((c) => c.join(",")).join(" ")}
            fill="#16263b"
            stroke="#c9d2dd"
            strokeWidth={0.7 * u}
            strokeLinejoin="round"
          />
        ))}
        <DayOverlay day={state.day} step={state.step} panels={drawn} view={frame} u={u} />
        <text
          x={frame.x + frame.w / 2}
          y={frame.y + 13 * u}
          textAnchor="middle"
          fontSize={9 * u}
          fontWeight={600}
          fill="#ffffff"
          opacity={0.55}
        >
          N
        </text>
      </svg>
      <HomeDayCard state={state} hasBattery={battery > 0} hasHome={(view.bill?.dailyKwh ?? 0) > 0} yours />
    </div>
  );
}
