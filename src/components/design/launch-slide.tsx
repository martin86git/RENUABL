"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import { LAUNCH } from "@/lib/domain/design/sales-page";
import { TryDemoButton } from "./business-demo";
import { useMotionOk } from "./living-hero";
import { LiveSun } from "./live-sun";

/**
 * The launch (18 Nov 2026, Martin: "it should feel like a landmark moment, somewhat like a rocket launching… joining
 * something", as adopting a Tesla does). Straight after the hero. A quiet countdown on black, then Sol lifts off from a
 * glowing horizon on a long trail of light, and the line comes: "Today, your business runs on AI." It plays once when it
 * comes into view and can be watched again; with reduced motion it holds at the end.
 */

/** Stars at three depths: far and faint, middle, near and bright; each layer drifts at its own speed. */
const STARS = [
  {
    opacity: 0.45,
    drift: "160s",
    image:
      "radial-gradient(1px 1px at 8% 12%, #fff, transparent), radial-gradient(1px 1px at 22% 38%, #fff, transparent), radial-gradient(1px 1px at 37% 9%, #fff, transparent), radial-gradient(1px 1px at 51% 27%, #fff, transparent), radial-gradient(1px 1px at 63% 6%, #fff, transparent), radial-gradient(1px 1px at 74% 33%, #fff, transparent), radial-gradient(1px 1px at 86% 19%, #fff, transparent), radial-gradient(1px 1px at 93% 44%, #fff, transparent), radial-gradient(1px 1px at 15% 55%, #fff, transparent), radial-gradient(1px 1px at 44% 50%, #fff, transparent), radial-gradient(1px 1px at 69% 58%, #fff, transparent), radial-gradient(1px 1px at 30% 70%, #fff, transparent)",
  },
  {
    opacity: 0.6,
    drift: "110s",
    image:
      "radial-gradient(1.4px 1.4px at 12% 24%, #fff, transparent), radial-gradient(1.4px 1.4px at 33% 16%, #fff, transparent), radial-gradient(1.4px 1.4px at 58% 40%, #fff, transparent), radial-gradient(1.4px 1.4px at 81% 11%, #fff, transparent), radial-gradient(1.4px 1.4px at 90% 52%, #fff, transparent), radial-gradient(1.4px 1.4px at 6% 46%, #fff, transparent)",
  },
  {
    opacity: 0.85,
    drift: "70s",
    image:
      "radial-gradient(2px 2px at 18% 30%, #ffe9d6, transparent), radial-gradient(2px 2px at 71% 22%, #fff, transparent), radial-gradient(1.8px 1.8px at 46% 14%, #dfe8ff, transparent)",
  },
] as const;

/** Fine film grain: fractal noise, as an image. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** When each part comes, ms from the start. */
const AT = { three: 500, two: 1300, one: 2100, ignite: 2900, rise: 3100, liftoff: 3700, words: 5200, more: 6000 } as const;

export function LaunchSlide({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement | null>(null);
  // Starts only once the slide is mostly on screen, not when a sliver shows under the hero.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const motion = useMotionOk();
  const [t, setT] = useState(-1);
  const [run, setRun] = useState(0);
  const started = useRef(false);

  // Start once, when it's first in view; again when asked.
  useEffect(() => {
    if (!motion || !seen || started.current) return;
    started.current = true;
    const go = window.setTimeout(() => setRun((n) => n + 1), 0);
    return () => window.clearTimeout(go);
  }, [motion, seen]);

  useEffect(() => {
    if (!run) return;
    const begun = performance.now();
    let frame = 0;
    const tick = () => {
      const now = performance.now() - begun;
      setT(now);
      if (now < AT.more + 400) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  // With reduced motion, or before it starts on a still screen, show the end.
  const at = motion ? t : AT.more + 400;
  const count = at >= AT.one ? (at < AT.ignite ? 1 : null) : at >= AT.two ? 2 : at >= AT.three ? 3 : null;
  const lit = at >= AT.ignite;
  const rising = at >= AT.rise;
  const words = at >= AT.words;
  const more = at >= AT.more;

  return (
    <section
      ref={root}
      id="launch"
      className="relative isolate flex min-h-[38rem] flex-col items-center overflow-hidden bg-[#030304] px-5 text-white snap-start lg:h-[calc(100dvh-4rem)]"
      aria-labelledby="launch-head"
    >
      {/* Depth (18 Nov 2026, Martin: take the feel up a notch): stars at three depths drifting at their own speeds, the
          curve of a planet with a thin atmosphere (blue, warming to the sun's orange where he rises), film grain and a
          vignette over it all. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {STARS.map((layer, i) => (
          <div
            key={i}
            className="launch-stars absolute -inset-[10%]"
            style={{ backgroundImage: layer.image, opacity: layer.opacity, animationDuration: layer.drift, animationDelay: `-${i * 13}s` }}
          />
        ))}
      </div>

      {/* The planet's curve and its atmosphere. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[42%] overflow-hidden">
        <div
          className={clsx("absolute inset-x-0 bottom-0 h-full transition-opacity duration-[1600ms]", lit ? "opacity-100" : "opacity-30")}
          style={{ background: "radial-gradient(55% 80% at 50% 100%, rgba(255,110,40,0.42), rgba(255,90,31,0.08) 50%, transparent 78%)" }}
        />
        <div
          className="absolute left-1/2 top-[72%] aspect-square w-[640vw] -translate-x-1/2 rounded-full bg-[#040507]"
          style={{
            boxShadow: lit
              ? "0 -1px 0 rgba(255,190,140,0.75), 0 -3px 14px rgba(255,140,60,0.45), 0 -18px 60px rgba(80,140,255,0.22), 0 -50px 120px rgba(255,110,40,0.18)"
              : "0 -1px 0 rgba(160,200,255,0.45), 0 -16px 50px rgba(80,140,255,0.16)",
            transition: "box-shadow 1600ms ease",
          }}
        />
      </div>

      {/* Grain and vignette, over everything. */}
      <div
        aria-hidden
        className="launch-grain pointer-events-none absolute -inset-[50%] z-20 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20"
        style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
      />

      {/* The countdown. */}
      <div aria-live="polite" className="pointer-events-none absolute inset-0 grid place-items-center">
        {count && (
          <div key={count} className="launch-count text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em] text-white/50">{LAUNCH.countdown}</p>
            <p className="mt-2 font-mono text-[clamp(96px,14vw,200px)] font-light leading-none tabular-nums">{count}</p>
          </div>
        )}
      </div>

      {/* Sol, lifting off on a trail of light. */}
      <div
        className="pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 transition-transform ease-[cubic-bezier(0.55,0,0.2,1)]"
        style={{
          transform: `translate(-50%, ${rising ? "0" : "62vh"})`,
          transitionDuration: motion ? "2200ms" : "0ms",
          opacity: lit ? 1 : 0,
        }}
        aria-hidden
      >
        <div className="relative grid size-28 place-items-center sm:size-36">
          <span className="absolute -inset-1/2">
            <LiveSun energy={lit ? 1 : 0} />
          </span>
          {/* The trail. */}
          <span
            className="absolute left-1/2 top-[70%] -z-10 w-6 -translate-x-1/2 rounded-full blur-md transition-[height,opacity] ease-out"
            style={{
              height: rising ? "70vh" : "0vh",
              opacity: words ? 0 : 1,
              transitionDuration: motion ? (words ? "1400ms" : "2600ms") : "0ms",
              background: "linear-gradient(to bottom, rgba(255,200,120,0.95), rgba(255,110,40,0.55) 30%, rgba(255,90,31,0) 100%)",
            }}
          />
          <span
            className="absolute left-1/2 top-[70%] -z-10 w-1.5 -translate-x-1/2 rounded-full transition-[height,opacity] ease-out"
            style={{
              height: rising ? "60vh" : "0vh",
              opacity: words ? 0 : 1,
              transitionDuration: motion ? (words ? "1400ms" : "2600ms") : "0ms",
              background: "linear-gradient(to bottom, #fff, rgba(255,180,110,0.6) 35%, rgba(255,140,60,0) 100%)",
            }}
          />
        </div>
      </div>

      {/* The line. */}
      <div className="relative mt-auto mb-[12vh] w-full max-w-4xl pt-[46vh] text-center lg:pt-0">
        <p
          className={clsx(
            "text-[12px] font-semibold uppercase tracking-[0.4em] text-[#ffb27a] transition-opacity duration-700",
            at >= AT.liftoff ? "opacity-100" : "opacity-0",
          )}
        >
          {LAUNCH.liftoff}
        </p>
        <h2
          id="launch-head"
          className={clsx(
            "mt-4 text-[clamp(40px,5.6vw,92px)] font-semibold leading-[0.95] tracking-[-0.05em] transition-all duration-1000",
            words ? "translate-y-0 opacity-100 blur-0" : "translate-y-4 opacity-0 blur-sm",
          )}
        >
          <span className="block">{LAUNCH.headline[0]}</span>
          <span className="block text-sun-line">{LAUNCH.headline[1]}</span>
        </h2>
        <div className={clsx("transition-all duration-700", more ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
          <p className="mx-auto mt-5 max-w-xl text-[clamp(16px,1.3vw,19px)] leading-relaxed text-white/70">{LAUNCH.sub}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {!signedIn && <TryDemoButton look="main" label={LAUNCH.cta} />}
            <a href="#pricing" className="text-[15px] font-medium text-white/75 underline-offset-4 hover:text-white hover:underline">
              {LAUNCH.plans}
            </a>
          </div>
          {motion && (
            <button
              type="button"
              onClick={() => {
                setT(-1);
                setRun((n) => n + 1);
              }}
              className="mx-auto mt-6 inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {LAUNCH.replay}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes launch-count { from { opacity: 0; transform: scale(1.25); filter: blur(6px); } 30% { opacity: 1; transform: scale(1); filter: blur(0); } to { opacity: 0; transform: scale(0.92); } }
        .launch-count { animation: launch-count 800ms ease-out both; }
        @keyframes launch-stars { from { transform: translateY(0); } to { transform: translateY(8%); } }
        .launch-stars { animation: launch-stars linear infinite alternate; }
        @keyframes launch-grain { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-2%,1%); } 50% { transform: translate(1%,-2%); } 75% { transform: translate(2%,2%); } }
        .launch-grain { animation: launch-grain 0.6s steps(3) infinite; }
        @media (prefers-reduced-motion: reduce) { .launch-stars, .launch-grain { animation: none; } }
      `}</style>
    </section>
  );
}
