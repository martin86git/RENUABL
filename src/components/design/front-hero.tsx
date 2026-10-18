"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { LANDING_HERO } from "@/lib/domain/design/landing";
import { AerialScene, PanelDefs, SolarPanel } from "./aerial-home";

/** The panels on the hero's roof: the north face in landscape rows, the west hip, and the garage (as the demo lays them). */
const HERO_PANELS = [
  ...[0, 1, 2, 3, 4].map((i) => ({ x: 164 + i * 46, y: 66, w: 44, h: 28 })),
  ...[0, 1, 2, 3].map((i) => ({ x: 188 + i * 46, y: 96, w: 44, h: 28 })),
  ...[0, 1].map((i) => ({ x: 234 + i * 46, y: 126, w: 44, h: 28 })),
  { x: 126, y: 112, w: 30, h: 46 },
  { x: 126, y: 160, w: 30, h: 46 },
  { x: 158, y: 136, w: 30, h: 46 },
  ...[0, 1, 2, 3].map((i) => ({ x: 470 + i * 32, y: 200, w: 30, h: 46 })),
];

/** One stage of the sequence a beat, then a pause with every stage lit, then again. */
const BEAT_MS = 700;
const HOLD_BEATS = 5;

/**
 * The front page's first screen. Less is more: the punchline, one line,
 * two ways in, and the sequence one design sets going, lit stage by stage
 * like a launch. Light, not black (Martin: black is too harsh). Behind it, the demo home from above, a pale wash, drifting
 * slowly. With reduced motion everything is shown lit and still.
 */
export function FrontHero({ signInHref, tryHref }: { signInHref: string; tryHref: string }) {
  const stages = LANDING_HERO.sequence.length;
  const [beat, setBeat] = useState(stages + HOLD_BEATS);
  const [still, setStill] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The sequence starts from the beginning once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStill(false);
    setBeat(0);
    const timer = window.setInterval(() => setBeat((b) => (b >= stages + HOLD_BEATS ? 0 : b + 1)), BEAT_MS);
    return () => window.clearInterval(timer);
  }, [stages]);
  const lit = Math.min(beat, stages);

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-canvas text-ink" aria-labelledby="hero">
      {/* Behind: the home from above, its panels on, slowly drifting. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <svg
          viewBox="60 20 600 300"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
          style={{ opacity: 0.7, filter: "saturate(0.85)", animation: still ? undefined : "hero-drift 28s ease-in-out infinite alternate" }}
        >
          <AerialScene />
          <PanelDefs />
          {HERO_PANELS.map((p, i) => (
            <SolarPanel key={i} {...p} />
          ))}
        </svg>
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(244,244,245,0.9), rgba(244,244,245,0.6) 50%, var(--canvas))" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 30% 45%, rgba(244,244,245,0.55) 0%, var(--canvas) 78%)" }}
        />
      </div>

      <header className="flex h-16 items-center justify-between px-6 lg:px-12">
        <Wordmark />
        <nav className="flex items-center gap-6 text-[13px] text-ink-2">
          <Link href={tryHref} className="hidden hover:text-ink sm:inline">
            Design tool
          </Link>
          <a href={signInHref} className="hover:text-ink">
            Sign in
          </a>
        </nav>
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.32em] text-muted">{LANDING_HERO.eyebrow}</p>
          <h1 id="hero" className="mt-6 text-[clamp(46px,9vw,124px)] font-light leading-[0.94] tracking-[-0.035em]">
            {LANDING_HERO.headline[0]}
            <br />
            <span className="text-ink/40">{LANDING_HERO.headline[1]}</span>
          </h1>
          <p className="mt-8 max-w-md text-[17px] leading-relaxed text-ink-2">{LANDING_HERO.body}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={signInHref}
              className="inline-flex h-12 items-center rounded-full bg-ink px-7 text-[14px] font-medium text-white transition-colors hover:bg-ink/85"
            >
              Get started
            </a>
            <a
              href="#automation"
              className="inline-flex h-12 items-center rounded-full border border-ink/25 px-7 text-[14px] font-medium text-ink transition-colors hover:border-ink/60"
            >
              Watch it work
            </a>
          </div>
        </div>
      </div>

      {/* The sequence: what one design sets going, lit stage by stage. */}
      <div aria-hidden className="px-6 pb-10 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          {/* The line runs from the first stage's dot to the last's: each stage sits in the middle of an equal share. */}
          <div className="relative h-px" style={{ marginLeft: `${50 / stages}%`, marginRight: `${50 / stages}%` }}>
            <div className="absolute inset-0 bg-ink/15" />
            <div
              className="absolute inset-y-0 left-0 bg-sun-line shadow-[0_0_10px_var(--sun-line)] transition-[width] duration-700 ease-out"
              style={{ width: `${(Math.max(0, lit - 1) / (stages - 1)) * 100}%` }}
            />
          </div>
          <ol className="-mt-[5px] grid" style={{ gridTemplateColumns: `repeat(${stages}, minmax(0, 1fr))` }}>
            {LANDING_HERO.sequence.map((stage, i) => {
              const on = i < lit;
              return (
                <li key={stage} className="flex flex-col items-center text-center">
                  <span
                    className={clsx(
                      "size-[9px] rounded-full border transition-all duration-500",
                      on ? "border-sun-line bg-sun-line shadow-[0_0_10px_var(--sun-line)]" : "border-ink/25 bg-canvas",
                    )}
                  />
                  <span
                    className={clsx(
                      "mt-3 hidden text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-500 sm:block",
                      on ? "text-ink" : "text-ink/35",
                    )}
                  >
                    {stage}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
