"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import { LAUNCH } from "@/lib/domain/design/sales-page";
import { DemoRequestButton } from "./demo-request";
import { useMotionOk } from "./living-hero";
import { LiveSun } from "./live-sun";

/**
 * The launch (18 Nov 2026, Martin: "it should feel like a landmark moment, somewhat like a rocket launching… joining
 * something", as adopting a Tesla does). Straight after the hero. A quiet countdown on black, then Sol lifts off from a
 * glowing horizon on a long trail of light, and the line comes: "Today, your business runs on AI." It plays once when it
 * comes into view and can be watched again; with reduced motion it holds at the end.
 *
 * The physics and mission control (18 Nov 2026, Martin): the motion is driven frame by frame. Ignition flares the
 * horizon and shudders the frame; the lift-off starts heavy and slow, accelerates, then settles high; a plume of fire and
 * smoke billows beneath (`Plume`, a small particle system on a canvas) and spreads where it meets the ground; and fine
 * readouts sit in the corners: the mission clock, altitude and velocity, and the status coming online.
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
const AT = { three: 500, two: 1300, one: 2100, ignite: 2900, rise: 3200, liftoff: 3500, words: 5900, more: 6700, end: 7400 } as const;
/** How long the climb takes, ms. */
const CLIMB_MS = 3200;
/** The climb's shape: a heavy, slow start, faster through the middle, settling at the top. */
const climb = (p: number) => {
  const x = Math.min(1, Math.max(0, p));
  return x * x * x * (x * (6 * x - 15) + 10);
};
const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

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
      if (now < AT.end) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  // With reduced motion, or before it starts on a still screen, show the end.
  const at = motion ? t : AT.end;
  const count = at >= AT.one ? (at < AT.ignite ? 1 : null) : at >= AT.two ? 2 : at >= AT.three ? 3 : null;
  const lit = at >= AT.ignite;
  const rising = at >= AT.rise;
  const words = at >= AT.words;
  const more = at >= AT.more;
  // Where he is in the climb, 0 on the pad to 1 at the top.
  const up = climb((at - AT.rise) / CLIMB_MS);
  // Ignition shudders the frame, fading as he climbs.
  const shake = lit && at < AT.rise + 1800 ? 3.5 * (1 - (at - AT.ignite) / (AT.rise + 1800 - AT.ignite)) : 0;
  const shakeAt =
    shake > 0 ? `translate(${(shake * Math.sin(at / 23)).toFixed(2)}px, ${(shake * Math.cos(at / 17)).toFixed(2)}px)` : "none";
  // The readouts.
  const secs = (at - AT.ignite) / 1000;
  const clock = at < 0 ? "T−00:00:03" : secs < 0 ? `T−00:00:${pad(Math.ceil(-secs))}` : `T+00:00:${pad(secs)}`;
  const alt = (up * 412.6).toFixed(1);
  const vel = Math.round(up * 27580).toLocaleString("en-AU");
  const statusOn = [at >= AT.liftoff, at >= AT.liftoff + 900, at >= AT.words];
  const sun = useRef<HTMLDivElement | null>(null);
  const emitting = rising && !words;

  return (
    <section
      ref={root}
      id="launch"
      className="relative isolate flex min-h-[38rem] flex-col items-center overflow-hidden bg-[#030304] px-5 text-white snap-start snap-always lg:h-[calc(100dvh-4rem)]"
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[42%] overflow-hidden"
        style={{ transform: shakeAt }}
      >
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

      {/* The plume: fire and smoke beneath him as he climbs. */}
      <Plume sun={sun} section={root} emitting={emitting && motion} style={{ transform: shakeAt }} />

      {/* Sol, lifting off. */}
      <div
        ref={sun}
        className="pointer-events-none absolute left-1/2 top-[14%]"
        style={{
          transform: `translate(-50%, ${((1 - up) * 62).toFixed(2)}vh) ${shakeAt === "none" ? "" : shakeAt}`,
          opacity: lit ? 1 : 0,
          transition: "opacity 400ms ease-out",
        }}
        aria-hidden
      >
        <div className="relative grid size-28 place-items-center sm:size-36">
          <span className="absolute -inset-1/2">
            <LiveSun energy={lit ? 1 : 0} />
          </span>
        </div>
      </div>

      {/* Mission control, in the corners. */}
      <Hud clock={clock} alt={alt} vel={vel} rising={rising} status={statusOn} />

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
          {LAUNCH.headline[0]} <span className="text-sun-line">{LAUNCH.headline[1]}</span>
        </h2>
        <div className={clsx("transition-all duration-700", more ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
          <p className="mx-auto mt-5 max-w-xl text-[clamp(16px,1.3vw,19px)] leading-relaxed text-white/70">{LAUNCH.sub}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {!signedIn && <DemoRequestButton look="main" label={LAUNCH.cta} />}
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

/** Fine corner brackets, as a webcast frames its readouts. */
function Corner({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "absolute size-3 border-white/30",
        at === "tl" && "left-0 top-0 border-l border-t",
        at === "tr" && "right-0 top-0 border-r border-t",
        at === "bl" && "bottom-0 left-0 border-b border-l",
        at === "br" && "bottom-0 right-0 border-b border-r",
      )}
    />
  );
}

/** The readouts in the four corners: who's flying, the mission clock, altitude and velocity, and what's online. */
function Hud({ clock, alt, vel, rising, status }: { clock: string; alt: string; vel: string; rising: boolean; status: boolean[] }) {
  const H = LAUNCH.hud;
  const box = "absolute z-30 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 sm:text-[11px]";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4 z-30 sm:inset-6">
      <div className={clsx(box, "left-0 top-0")}>
        <Corner at="tl" />
        <p className="text-white/75">{H.control}</p>
        <p className="mt-1 text-white/40">{H.mission}</p>
      </div>
      <div className={clsx(box, "right-0 top-0 text-right")}>
        <Corner at="tr" />
        <p className="text-[13px] tabular-nums tracking-[0.12em] text-white/85 sm:text-[15px]">{clock}</p>
      </div>
      <div className={clsx(box, "bottom-0 left-0 hidden sm:block")}>
        <Corner at="bl" />
        <p className="tabular-nums">
          <span className="text-white/40">{H.alt}</span> <span className="text-white/85">{rising ? alt : "0.0"}</span> km
        </p>
        <p className="mt-1 tabular-nums">
          <span className="text-white/40">{H.vel}</span> <span className="text-white/85">{rising ? vel : "0"}</span> km/h
        </p>
      </div>
      <div className={clsx(box, "bottom-0 right-0 hidden text-right sm:block")}>
        <Corner at="br" />
        {H.status.map((line, i) => (
          <p key={line} className={clsx("mt-1 first:mt-0 transition-opacity duration-500", status[i] ? "opacity-100" : "opacity-25")}>
            <span
              className={clsx(
                "mr-2 inline-block size-1.5 rounded-full align-middle",
                status[i] ? (i === 2 ? "bg-sun-line" : "bg-[#5fe0a0]") : "bg-white/30",
              )}
            />
            <span className={i === 2 && status[i] ? "text-[#ffb27a]" : ""}>{line}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
}

/**
 * The plume: a small particle system on a canvas over the section. While `emitting`, puffs leave the bottom of the sun,
 * white-hot then orange fire, cooling to grey smoke that slows, billows and spreads, flattening out where it meets the
 * planet's edge. Reads the sun's place on screen every frame, so it follows the climb exactly.
 */
function Plume({
  sun,
  section,
  emitting,
  style,
}: {
  sun: React.RefObject<HTMLDivElement | null>;
  section: React.RefObject<HTMLElement | null>;
  emitting: boolean;
  style?: React.CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const on = useRef(emitting);
  useEffect(() => {
    on.current = emitting;
  }, [emitting]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const puffs: Puff[] = [];
    let frame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const loop = () => {
      const box = section.current?.getBoundingClientRect();
      const s = sun.current?.getBoundingClientRect();
      if (box && s) {
        const w = Math.round(box.width * dpr);
        const h = Math.round(box.height * dpr);
        if (el.width !== w || el.height !== h) {
          el.width = w;
          el.height = h;
        }
        const ground = box.height * 0.86;
        const cx = s.left - box.left + s.width / 2;
        const cy = s.top - box.top + s.height * 0.92;
        if (on.current && puffs.length < 420) {
          for (let k = 0; k < 7; k++)
            puffs.push({
              x: cx + (Math.random() - 0.5) * s.width * 0.18,
              y: cy,
              vx: (Math.random() - 0.5) * 0.7,
              vy: 2.6 + Math.random() * 2.2,
              r: s.width * (0.06 + Math.random() * 0.06),
              life: 0,
              max: 70 + Math.random() * 60,
            });
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, box.width, box.height);
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i];
          p.life += 1;
          if (p.life > p.max) {
            puffs.splice(i, 1);
            continue;
          }
          p.vx += (Math.random() - 0.5) * 0.18;
          p.vy *= 0.975;
          if (p.y > ground) {
            p.vy *= 0.6;
            p.vx *= 1.04;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.r += 0.55;
          const a = p.life / p.max;
          if (a < 0.22) {
            // Fire: white-hot at the source, orange as it cools.
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            const k = 1 - a / 0.22;
            g.addColorStop(0, `rgba(255,240,210,${0.55 * k})`);
            g.addColorStop(0.45, `rgba(255,140,50,${0.35 * k})`);
            g.addColorStop(1, "rgba(255,90,31,0)");
            ctx.fillStyle = g;
          } else {
            // Smoke: grey, lit warm from below, thinning as it spreads.
            ctx.globalCompositeOperation = "source-over";
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            const k = (1 - a) * 0.16;
            g.addColorStop(0, `rgba(150,128,112,${k})`);
            g.addColorStop(1, "rgba(120,110,104,0)");
            ctx.fillStyle = g;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [sun, section]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 -z-[5] size-full" style={style} />;
}
