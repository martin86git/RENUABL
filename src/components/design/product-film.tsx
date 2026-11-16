"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Pause, Play } from "lucide-react";
import { FILM } from "@/lib/domain/design/sales-page";
import { ADD_ON_WORDS } from "@/lib/domain/design/add-ons";
import { MarketplaceMark } from "./marketplace-bar";
import { SolScene, SOL_SCENE_MS } from "./film-sol-scene";
import { TeamScene, TEAM_SCENE_MS } from "./film-team-scene";

/**
 * The hero's product film (16 Nov 2026, Martin: a real film of how the product works today, not misleading, and not so
 * much that a competitor could copy it). Real screens of the product on the made-up demo business
 * (`public/design/landing/film/`, taken by tools/demo/drive.mjs), each in a window on a dark stage lit by a slow sun; a
 * camera glides over each screen while a spotlight lights the part that matters and the rest dims. Nothing is drawn
 * over a screen that the screen doesn't show. Seven chapters (`FILM.chapters`), then the Marketplace, coming soon. The
 * rail under it shows where the film is and jumps to a chapter. It plays only while in view, pauses on its button, and
 * holds still with reduced motion.
 */

type Chapter = (typeof FILM.chapters)[number]["key"];
type Key = Chapter | "market";
/** A part of a screen, as fractions of its width and height: left, top, width, height. */
type Rect = readonly [number, number, number, number];
/** One move of the camera: how long it holds, and the part it lights (none: the whole screen). */
type Move = { ms: number; light?: Rect };
type Shot = { chapter: Key; src?: string; scene?: "sol" | "team"; moves: Move[] };

const TICK = 40;
const WHOLE = 1300;

/** The shots in order, with the parts of each screen the camera goes to (measured on the screens). */
const SHOTS: Shot[] = [
  { chapter: "sol", scene: "sol", moves: [{ ms: SOL_SCENE_MS }] },
  { chapter: "team", scene: "team", moves: [{ ms: TEAM_SCENE_MS }] },
  {
    chapter: "service",
    src: "/design/landing/film/service-case.webp",
    moves: [{ ms: WHOLE }, { ms: 2600, light: [0.128, 0.205, 0.478, 0.13] }, { ms: 2600, light: [0.652, 0.72, 0.252, 0.263] }],
  },
  {
    chapter: "service",
    src: "/design/landing/film/service-reply.webp",
    moves: [
      { ms: 2800, light: [0.13, 0.172, 0.475, 0.232] },
      { ms: 2600, light: [0.155, 0.417, 0.46, 0.262] },
    ],
  },
  {
    chapter: "voice",
    src: "/design/landing/film/voice-call.webp",
    moves: [{ ms: WHOLE }, { ms: 2400, light: [0.727, 0.43, 0.256, 0.075] }, { ms: 3400, light: [0.727, 0.5, 0.256, 0.36] }],
  },
  {
    chapter: "design",
    src: "/design/landing/film/design-sol.webp",
    moves: [{ ms: WHOLE }, { ms: 3200, light: [0.322, 0.506, 0.355, 0.366] }],
  },
  {
    chapter: "design",
    src: "/design/landing/film/design-string-1.webp",
    moves: [
      { ms: 2200, light: [0.176, 0.253, 0.71, 0.073] },
      { ms: 2400, light: [0.34, 0.525, 0.19, 0.19] },
      { ms: 2600, light: [0.326, 0.752, 0.345, 0.122] },
    ],
  },
  {
    chapter: "design",
    src: "/design/landing/film/design-string-2.webp",
    moves: [
      { ms: 2600, light: [0.334, 0.462, 0.6, 0.23] },
      { ms: 3000, light: [0.326, 0.738, 0.345, 0.14] },
    ],
  },
  {
    chapter: "design",
    src: "/design/landing/film/design-record.webp",
    moves: [{ ms: WHOLE }, { ms: 2800, light: [0.352, 0.922, 0.296, 0.066] }],
  },
  {
    chapter: "design",
    src: "/design/landing/film/design-share.webp",
    moves: [
      { ms: 2800, light: [0.265, 0.14, 0.47, 0.425] },
      { ms: 3200, light: [0.265, 0.565, 0.47, 0.375] },
    ],
  },
  {
    chapter: "proposal",
    src: "/design/landing/film/proposal-builder.webp",
    moves: [{ ms: WHOLE }, { ms: 2400, light: [0, 0.503, 0.236, 0.497] }, { ms: 2400, light: [0.326, 0.661, 0.581, 0.339] }],
  },
  {
    chapter: "proposal",
    src: "/design/landing/film/proposal-customer.webp",
    moves: [{ ms: 2800, light: [0.211, 0.31, 0.579, 0.507] }],
  },
  {
    chapter: "signed",
    src: "/design/landing/film/order.webp",
    moves: [
      { ms: 2400, light: [0.085, 0.276, 0.475, 0.07] },
      { ms: 2400, light: [0.1, 0.549, 0.801, 0.451] },
    ],
  },
  { chapter: "signed", src: "/design/landing/film/calendar.webp", moves: [{ ms: 2400, light: [0.465, 0.734, 0.107, 0.093] }] },
  { chapter: "signed", src: "/design/landing/film/job-card.webp", moves: [{ ms: 2800, light: [0.145, 0.119, 0.331, 0.642] }] },
  {
    chapter: "marketing",
    src: "/design/landing/film/marketing.webp",
    moves: [{ ms: WHOLE }, { ms: 2600, light: [0.072, 0.456, 0.855, 0.185] }, { ms: 2600, light: [0.064, 0.655, 0.866, 0.088] }],
  },
  { chapter: "market", moves: [{ ms: 4200 }] },
];

/** Each move on the film's clock: when it starts, its shot, and where the camera looks. */
const TIMELINE = (() => {
  const out: { at: number; shot: number; light?: Rect }[] = [];
  let at = 0;
  SHOTS.forEach((s, shot) =>
    s.moves.forEach((m) => {
      out.push({ at, shot, light: m.light });
      at += m.ms;
    }),
  );
  return { moves: out, total: at };
})();
const TOTAL = TIMELINE.total;
/** When each shot starts on the clock. */
const SHOT_AT = SHOTS.map((_, i) => TIMELINE.moves.find((m) => m.shot === i)?.at ?? 0);

/** Each chapter's span on the clock. */
const SPANS = (() => {
  const spans = {} as Record<Key, [number, number]>;
  for (const m of TIMELINE.moves) {
    const key = SHOTS[m.shot].chapter;
    if (!spans[key]) spans[key] = [m.at, m.at];
  }
  const keys = Object.keys(spans) as Key[];
  keys.forEach((k, i) => (spans[k][1] = i + 1 < keys.length ? spans[keys[i + 1]][0] : TOTAL));
  return spans;
})();

/** The moment each chapter is held at when the film doesn't move: its first lit part. */
const STILL_AT = (() => {
  const at = {} as Record<Key, number>;
  const lit = new Set<Key>();
  for (const m of TIMELINE.moves) {
    const key = SHOTS[m.shot].chapter;
    if (lit.has(key)) continue;
    at[key] = m.at;
    if (m.light) lit.add(key);
  }
  for (const m of TIMELINE.moves) if (!lit.has(SHOTS[m.shot].chapter)) at[SHOTS[m.shot].chapter] = SPANS[SHOTS[m.shot].chapter][0];
  return at;
})();

function moveAt(t: number) {
  let move = TIMELINE.moves[0];
  for (const m of TIMELINE.moves) if (m.at <= t) move = m;
  return move;
}

/** The window's screen within the stage (the stage and the screen are both 16:10). */
const SCREEN = { left: 0.05, top: 0.075, size: 0.9 };
const BAR = 0.035;

/** The camera as a transform on the stage: the lit part brought to the middle and filling most of it. */
function cameraOf(light?: Rect) {
  if (!light) return "none";
  const [x, y, w, h] = light;
  // Never so close that the lit part, or the words round it, run off the frame (16 Nov 2026, Martin).
  const s = Math.min(1.8, Math.max(1.05, 0.7 / (SCREEN.size * Math.max(w, h))));
  const centre = (f: number) => Math.min(0, Math.max(1 - s, 0.5 - f * s));
  const fx = SCREEN.left + SCREEN.size * (x + w / 2);
  const fy = SCREEN.top + SCREEN.size * (y + h / 2);
  return `translate(${centre(fx) * 100}%, ${centre(fy) * 100}%) scale(${s})`;
}

const pct = (n: number) => `${n * 100}%`;
const RAIL: { key: Key; title: string }[] = [
  ...FILM.chapters.map((c) => ({ key: c.key as Key, title: c.title })),
  { key: "market", title: FILM.marketplace.title },
];

export function ProductFilm() {
  const stage = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(reduce.matches);
      if (reduce.matches) setT(STILL_AT.sol);
    };
    apply();
    reduce.addEventListener("change", apply);
    return () => reduce.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const playing = inView && !paused && !still;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setT((v) => (v + TICK >= TOTAL ? 0 : v + TICK));
    }, TICK);
    return () => window.clearInterval(timer);
  }, [playing]);

  const move = moveAt(t);
  const shot = SHOTS[move.shot];
  const key = shot.chapter;
  const chapter = FILM.chapters.find((c) => c.key === key);
  const index = RAIL.findIndex((r) => r.key === key);
  const market = key === "market";
  const tilted = !still && (t < 500 || t >= TOTAL - 900);
  const ease = "ease-[cubic-bezier(0.65,0,0.35,1)]";
  const addOn = chapter && "addOn" in chapter ? ADD_ON_WORDS[chapter.addOn].name : null;
  /** The chapter card says itself in full as the chapter begins, then folds to a small label out of the way. */
  const folded = !still && t - SPANS[key][0] > 2800;

  const goTo = (k: Key) => setT(still || paused ? STILL_AT[k] : SPANS[k][0]);

  return (
    <figure className="w-full" aria-label={FILM.label}>
      <style>{`
        @keyframes film-sun { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-6%,4%) scale(1.12); } }
        @keyframes film-rise { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        @keyframes film-pop { from { opacity: 0; transform: translateY(0.8cqw) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes film-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes film-wave { 0%,100% { transform: scaleY(0.5); } 50% { transform: scaleY(1.1); } }
        .film-pop { animation: film-pop 500ms cubic-bezier(0.2,0.8,0.2,1) both; }
        .film-pulse { animation: film-pulse 1.1s ease-in-out infinite; }
        .film-wave { animation: film-wave 0.9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .film-sun, .film-rise, .film-pop, .film-pulse, .film-wave { animation: none !important; } }
      `}</style>
      <div
        ref={stage}
        className="relative isolate aspect-[16/10] w-full select-none overflow-hidden rounded-[28px] bg-[#0d0e11] shadow-[0_50px_120px_-40px_rgba(11,11,12,0.6)] ring-1 ring-black/10 [container-type:inline-size]"
      >
        {/* The stage: graphite, lit by a slow sun from the top right, fine grain over it. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div
            className="film-sun absolute -right-[20%] -top-[45%] h-[120%] w-[85%] rounded-full opacity-90 blur-[6cqw]"
            style={{
              background: "radial-gradient(closest-side, rgba(255,110,40,0.75), rgba(255,90,31,0.25) 55%, rgba(255,90,31,0) 100%)",
              animation: "film-sun 16s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -bottom-[40%] -left-[15%] h-[90%] w-[70%] rounded-full blur-[6cqw]"
            style={{ background: "radial-gradient(closest-side, rgba(120,140,255,0.16), rgba(120,140,255,0) 100%)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </div>

        {/* The window rising flat out of a tilt. */}
        <div
          className={clsx("absolute inset-0 transition-[transform,opacity] duration-[1400ms]", ease, market && "opacity-0")}
          style={{
            transform: tilted ? "perspective(140cqw) rotateX(12deg) translateY(2%) scale(0.94)" : "none",
            transformOrigin: "50% 70%",
          }}
        >
          {/* The camera. */}
          <div
            aria-hidden
            className={clsx("absolute inset-0 origin-top-left", !still && `transition-transform duration-[1500ms] ${ease}`)}
            style={{ transform: cameraOf(move.light) }}
          >
            <div
              className="absolute overflow-hidden rounded-[1.1cqw] bg-[#f7f7f8] shadow-[0_3cqw_8cqw_-2cqw_rgba(0,0,0,0.75)] ring-1 ring-white/15"
              style={{ left: pct(SCREEN.left), top: pct(SCREEN.top - BAR), width: pct(SCREEN.size), height: pct(SCREEN.size + BAR) }}
            >
              <div className="flex items-center gap-[0.55cqw] px-[1.1cqw]" style={{ height: `${(BAR / (SCREEN.size + BAR)) * 100}%` }}>
                <span className="size-[0.75cqw] rounded-full bg-[#ff5f57]" />
                <span className="size-[0.75cqw] rounded-full bg-[#febc2e]" />
                <span className="size-[0.75cqw] rounded-full bg-[#28c840]" />
                <span className="mx-auto rounded-full bg-black/[0.05] px-[2.5cqw] py-[0.2cqw] text-[0.75cqw] text-black/45">
                  renuabl.com.au
                </span>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 overflow-hidden bg-canvas"
                style={{ top: `${(BAR / (SCREEN.size + BAR)) * 100}%` }}
              >
                {SHOTS.map((s, i) =>
                  s.src ? (
                    <div
                      key={s.src}
                      className={clsx("absolute inset-0 transition-opacity duration-700", move.shot === i ? "opacity-100" : "opacity-0")}
                    >
                      <Image
                        src={s.src}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 1800px, 640px"
                        quality={85}
                        priority={i === 0}
                        loading={i === 0 ? undefined : "eager"}
                        className="object-cover object-top"
                      />
                    </div>
                  ) : s.scene ? (
                    <div
                      key={s.scene}
                      className={clsx("absolute inset-0 transition-opacity duration-700", move.shot === i ? "opacity-100" : "opacity-0")}
                    >
                      {move.shot === i &&
                        (s.scene === "team" ? (
                          <TeamScene ms={t - SHOT_AT[i]} still={still} />
                        ) : (
                          <SolScene ms={t - SHOT_AT[i]} still={still} />
                        ))}
                    </div>
                  ) : null,
                )}

                {/* The spotlight: the screen dims round the part that matters, lit with a fine orange edge. */}
                <div
                  aria-hidden
                  className={clsx("pointer-events-none absolute rounded-[0.9cqw] transition-all duration-[1100ms]", ease)}
                  style={
                    move.light
                      ? {
                          left: pct(move.light[0]),
                          top: pct(move.light[1]),
                          width: pct(move.light[2]),
                          height: pct(move.light[3]),
                          boxShadow:
                            "0 0 0 200cqw rgba(11,12,16,0.42), 0 0 0 0.18cqw rgba(255,90,31,0.9), 0 0 3cqw 0.4cqw rgba(255,90,31,0.35)",
                        }
                      : { left: "0%", top: "0%", width: "100%", height: "100%", boxShadow: "0 0 0 200cqw rgba(11,12,16,0)" }
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* The last card: the Marketplace, coming soon. */}
        <div
          aria-hidden={!market}
          className={clsx(
            "absolute inset-0 grid place-items-center text-center transition-opacity duration-700",
            market ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="px-[6%]">
            <span className="mx-auto grid size-[7cqw] place-items-center rounded-full bg-market text-white shadow-[0_0_6cqw_rgba(40,90,255,0.45)]">
              <MarketplaceMark className="size-[3.6cqw]" />
            </span>
            <p className="mt-[2.4cqw] text-[clamp(20px,3.6cqw,44px)] font-semibold tracking-[-0.03em] text-white">
              {FILM.marketplace.title}
            </p>
            <p className="mx-auto mt-[1cqw] max-w-[36ch] text-[clamp(12px,1.5cqw,18px)] text-white/65">{FILM.marketplace.line}</p>
            <span className="mt-[2cqw] inline-block rounded-full bg-white/10 px-[1.6cqw] py-[0.5cqw] text-[clamp(11px,1.1cqw,14px)] font-medium text-white ring-1 ring-white/20">
              {FILM.marketplace.soon}
            </span>
          </div>
        </div>

        {/* The chapter, rising in as it begins. */}
        {chapter && (
          <div className="pointer-events-none absolute left-[2%] top-[2.5%] max-w-[60%]" aria-live="polite">
            <div
              key={index}
              className={clsx(
                "film-rise rounded-[1.2cqw] bg-[#0d0e11]/80 shadow-[0_1cqw_3cqw_-1cqw_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl transition-all duration-700",
                folded ? "px-[1cqw] py-[0.5cqw] opacity-80" : "px-[1.6cqw] py-[1.2cqw]",
              )}
              style={{ animation: still ? undefined : "film-rise 700ms cubic-bezier(0.2,0.8,0.2,1) both" }}
            >
              <p
                className={clsx(
                  "flex items-center gap-[0.8cqw] text-[clamp(10px,1cqw,13px)] font-semibold uppercase tracking-[0.2em] text-sun-line",
                  folded && "hidden",
                )}
              >
                {FILM.introducing}
                {addOn && (
                  <span className="rounded-full bg-white/10 px-[0.8cqw] py-[0.15cqw] text-[clamp(9px,0.9cqw,12px)] font-medium tracking-normal text-white/80 ring-1 ring-white/15">
                    {FILM.addOn} · {addOn}
                  </span>
                )}
              </p>
              <p
                className={clsx(
                  "font-semibold leading-tight tracking-[-0.02em] text-white transition-all duration-700",
                  folded ? "text-[clamp(10px,1cqw,14px)]" : "mt-[0.4cqw] text-[clamp(15px,2.1cqw,26px)]",
                )}
              >
                {chapter.title}
              </p>
              {!folded && <p className="mt-[0.3cqw] hidden text-[clamp(11px,1.15cqw,15px)] text-white/60 sm:block">{chapter.line}</p>}
            </div>
          </div>
        )}

        {!still && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? FILM.play : FILM.pause}
            className="absolute right-[3%] top-[4%] grid size-9 place-items-center rounded-full bg-[#0d0e11]/70 text-white ring-1 ring-white/15 backdrop-blur-xl hover:bg-[#0d0e11]/85"
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        )}
      </div>

      {/* The chapters: where the film is, and a way to any of them. */}
      <ol className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5 lg:grid-cols-9">
        {RAIL.map((c, i) => {
          const [from, to] = SPANS[c.key];
          const share = still ? (i === index ? 1 : 0) : Math.min(1, Math.max(0, (t - from) / (to - from)));
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => goTo(c.key)}
                aria-current={i === index ? "step" : undefined}
                className="group w-full text-left"
              >
                {/* On the hero's dark ground (16 Nov 2026): white words, the progress in the signal orange. */}
                <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full rounded-full bg-sun-line" style={{ width: `${share * 100}%` }} />
                </span>
                <span
                  className={clsx(
                    "mt-2 flex items-baseline gap-2 text-[12px] font-medium leading-snug transition-colors",
                    i === index ? "text-white" : "text-white/45 group-hover:text-white/80",
                  )}
                >
                  <span className="tabular-nums text-[11px]">{String(i + 1).padStart(2, "0")}</span>
                  {c.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
