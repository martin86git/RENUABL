"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, Check, MousePointer2, Pause, Play } from "lucide-react";
import { ASK_DEMO, CRM_SHOT, FILM, SERVICE_SHOT } from "@/lib/domain/design/sales-page";
import { AskDesignDemo } from "./designer-showcase";
import { SolBadge } from "./sol-icon";

/**
 * The hero's product film (6 Nov 2026, Martin: "a video like the one on Stack AI, where it takes you through multiple
 * selling points"; then "it doesn't look like state of the art"). Not a recording: the product's own window on a dark
 * stage lit by a slow sun, tilting up flat as the film opens, then a camera that glides from one real screen to the
 * next while a spotlight moves over the part that matters and the rest of the screen dims. On it, the moments that make
 * each point: a question typed to Sol, the pointer pressing Design their roof, the designer laying a system from one
 * sentence (its own demo on the film's clock), Sol's write-up landing on the deal, and his issue and fix on a service
 * case. Four chapters (`FILM.chapters`), titles rising in as each begins; the rail under it shows where the film is and
 * jumps to a chapter. It plays only while in view, pauses on its button, and holds still with reduced motion.
 */

type Scene = "today" | "design" | "crm" | "service";
/** A part of the screen, as fractions of its width and height: left, top, width, height. */
type Rect = readonly [number, number, number, number];
/** Where the camera looks (a point on the screen, 0 to 1 each way), how far in, and what the spotlight lights. */
type Beat = { at: number; scene: Scene; x: number; y: number; zoom: number; light?: Rect };

const TOTAL = 33000;
const TICK = 40;

/** Each chapter's span on the film's clock, in step with `FILM.chapters`. */
const SPANS: Record<Scene, [number, number]> = {
  today: [0, 8400],
  design: [8400, 17400],
  crm: [17400, 24400],
  service: [24400, TOTAL],
};

/** The parts of the demo business's screens the film points at (measured on the screenshots). */
const PART = {
  solBox: [0.233, 0.914, 0.535, 0.066],
  upFirst: [0.263, 0.328, 0.506, 0.117],
  beforeCall: [0.263, 0.505, 0.506, 0.258],
  roofButton: [0.638, 0.362, 0.11, 0.049],
  olivia: [0.088, 0.436, 0.195, 0.18],
  oliviaAndNote: [0.088, 0.426, 0.49, 0.2],
  proposals: [0.508, 0.405, 0.194, 0.58],
  issue: [0.158, 0.192, 0.452, 0.178],
  solution: [0.655, 0.598, 0.248, 0.392],
} as const satisfies Record<string, Rect>;

/** The camera's moves: from each moment it eases to this shot. A zoom of 1 is the whole window. */
const BEATS: Beat[] = [
  { at: 0, scene: "today", x: 0.5, y: 0.5, zoom: 1 },
  { at: 1100, scene: "today", x: 0.5, y: 0.82, zoom: 1.7, light: PART.solBox },
  { at: 3500, scene: "today", x: 0.5, y: 0.36, zoom: 1.9, light: PART.upFirst },
  { at: 5300, scene: "today", x: 0.5, y: 0.6, zoom: 1.9, light: PART.beforeCall },
  { at: 6800, scene: "today", x: 0.56, y: 0.42, zoom: 2, light: PART.roofButton },
  { at: 8400, scene: "design", x: 0.5, y: 0.45, zoom: 1.12 },
  { at: 9100, scene: "design", x: 0.5, y: 0.28, zoom: 1.4 },
  { at: 12200, scene: "design", x: 0.5, y: 0.55, zoom: 1.2 },
  { at: 14600, scene: "design", x: 0.5, y: 0.3, zoom: 1.45 },
  { at: 17400, scene: "crm", x: 0.5, y: 0.5, zoom: 1.12 },
  { at: 18300, scene: "crm", x: 0.25, y: 0.53, zoom: 2.3, light: PART.olivia },
  { at: 19700, scene: "crm", x: 0.33, y: 0.53, zoom: 2.1, light: PART.oliviaAndNote },
  { at: 22000, scene: "crm", x: 0.6, y: 0.6, zoom: 1.75, light: PART.proposals },
  { at: 24400, scene: "service", x: 0.5, y: 0.5, zoom: 1.12 },
  { at: 25300, scene: "service", x: 0.38, y: 0.28, zoom: 2.2, light: PART.issue },
  { at: 27900, scene: "service", x: 0.78, y: 0.72, zoom: 2.2, light: PART.solution },
  { at: 30800, scene: "service", x: 0.5, y: 0.5, zoom: 1 },
];

/** The moments on screen, on the film's clock. */
const TYPE_FROM = 1700;
const TYPE_EVERY = 55;
const SENT_AT = TYPE_FROM + FILM.todayAsk.length * TYPE_EVERY + 300;
const CURSOR = { in: 6500, there: 6900, click: 7600 };
const NOTE_AT = 19500;
/** The window rises flat from a tilt as the film opens, and settles back as it ends. */
const TILTED = (t: number) => t < 500 || t >= 31800;

/** The window's screen within the stage (the stage and the screen are both 16:10). */
const SCREEN = { left: 0.08, top: 0.12, size: 0.84 };
const BAR = 0.035;

/** The moment each chapter is held at when the film doesn't move (reduced motion, or a chapter picked while paused). */
const STILL_AT: Record<Scene, number> = { today: 3600, design: 15200, crm: 20000, service: 25500 };

const SHOTS: Record<Exclude<Scene, "design">, { src: string }> = {
  today: { src: "/design/landing/today-sol.webp" },
  crm: CRM_SHOT,
  service: SERVICE_SHOT,
};

function beatAt(t: number) {
  let beat = BEATS[0];
  for (const b of BEATS) if (b.at <= t) beat = b;
  return beat;
}

/** The camera as a transform on the stage: the shot's point brought to the middle, never past the stage's edge. */
function cameraOf(beat: Beat) {
  const s = beat.zoom;
  const centre = (f: number) => (s <= 1 ? 0.5 - 0.5 * s : Math.min(0, Math.max(1 - s, 0.5 - f * s)));
  const fx = SCREEN.left + SCREEN.size * beat.x;
  const fy = SCREEN.top + SCREEN.size * beat.y;
  return `translate(${centre(fx) * 100}%, ${centre(fy) * 100}%) scale(${s})`;
}

const pct = (n: number) => `${n * 100}%`;

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
      if (reduce.matches) setT(STILL_AT.today);
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

  const beat = beatAt(t);
  const scene = beat.scene;
  const chapter = FILM.chapters.findIndex((c) => c.key === scene);
  const designClock = Math.max(0, Math.min(t - SPANS.design[0], SPANS.design[1] - SPANS.design[0]));
  const typed = scene === "today" ? Math.max(0, Math.min(FILM.todayAsk.length, Math.floor((t - TYPE_FROM) / TYPE_EVERY))) : 0;
  const sent = scene === "today" && t >= SENT_AT;
  const cursorOn = scene === "today" && t >= CURSOR.in;
  const clicking = t >= CURSOR.click && t < CURSOR.click + 450;
  const noteOn = scene === "crm" && t >= NOTE_AT;
  const tilted = !still && TILTED(t);
  const ease = "ease-[cubic-bezier(0.65,0,0.35,1)]";

  const goTo = (key: Scene) => setT(still || paused ? STILL_AT[key] : SPANS[key][0]);

  return (
    <figure className="w-full" aria-label={FILM.label}>
      <style>{`
        @keyframes film-sun { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-6%,4%) scale(1.12); } }
        @keyframes film-rise { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        @media (prefers-reduced-motion: reduce) { .film-sun, .film-rise { animation: none !important; } }
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
          className={clsx("absolute inset-0 transition-transform duration-[1400ms]", ease)}
          style={{
            transform: tilted ? "perspective(140cqw) rotateX(12deg) translateY(2%) scale(0.94)" : "none",
            transformOrigin: "50% 70%",
          }}
        >
          {/* The camera. */}
          <div
            aria-hidden
            className={clsx("absolute inset-0 origin-top-left", !still && `transition-transform duration-[1500ms] ${ease}`)}
            style={{ transform: cameraOf(beat) }}
          >
            {/* The window: its bar, then the screen. */}
            <div
              className="absolute overflow-hidden rounded-[1.1cqw] bg-[#f7f7f8] shadow-[0_3cqw_8cqw_-2cqw_rgba(0,0,0,0.75)] ring-1 ring-white/15"
              style={{
                left: pct(SCREEN.left),
                top: pct(SCREEN.top - BAR),
                width: pct(SCREEN.size),
                height: pct(SCREEN.size + BAR),
              }}
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
                {(Object.keys(SHOTS) as (keyof typeof SHOTS)[]).map((key) => (
                  <div
                    key={key}
                    className={clsx("absolute inset-0 transition-opacity duration-700", scene === key ? "opacity-100" : "opacity-0")}
                  >
                    <Image
                      src={SHOTS[key].src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 1800px, 640px"
                      quality={85}
                      priority={key === "today"}
                      className="object-cover object-top"
                    />
                  </div>
                ))}
                <div
                  className={clsx(
                    "absolute inset-0 flex items-start justify-center bg-canvas pt-[1.5%] transition-opacity duration-700",
                    scene === "design" ? "opacity-100" : "opacity-0",
                  )}
                >
                  <div className="w-[90%]">
                    <AskDesignDemo label={ASK_DEMO.label} request={ASK_DEMO.request} reply={ASK_DEMO.reply} clock={designClock} />
                  </div>
                </div>

                {/* The question typed to Sol on Today. */}
                <div
                  className={clsx(
                    "absolute flex items-center gap-[1.2%] rounded-full bg-surface px-[1.6%] ring-1 transition-[box-shadow,opacity] duration-300",
                    scene === "today" ? "opacity-100" : "opacity-0",
                    sent ? "ring-line" : "ring-sun-line/60 shadow-[0_0_0_0.4cqw_rgba(255,90,31,0.12)]",
                  )}
                  style={{ left: pct(PART.solBox[0]), top: pct(PART.solBox[1] + 0.004), width: pct(PART.solBox[2]), height: pct(0.058) }}
                >
                  <SolBadge className="size-[1.3cqw] shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[1.2cqw] text-ink">
                    {typed && !sent ? (
                      <>
                        {FILM.todayAsk.slice(0, typed)}
                        <span className="ml-px inline-block h-[1.3cqw] w-[0.12cqw] animate-pulse bg-ink align-middle" />
                      </>
                    ) : (
                      <span className="text-muted">Ask Sol about your deals, your day, or what to say to a customer</span>
                    )}
                  </span>
                  <span
                    className={clsx(
                      "grid size-[2.2cqw] shrink-0 place-items-center rounded-full text-white transition-colors",
                      typed === FILM.todayAsk.length && !sent ? "bg-sun-line" : "bg-line-strong",
                    )}
                  >
                    <ArrowUp className="size-[1.1cqw]" />
                  </span>
                </div>

                {/* Sol's write-up landing beside Olivia's deal. */}
                <div
                  className={clsx(
                    "absolute flex w-[27%] items-start gap-[2.5%] rounded-[0.9cqw] bg-surface p-[1.1%] shadow-[0_1.4cqw_3cqw_-1cqw_rgba(11,11,12,0.45)] ring-1 ring-sun-line/40 transition-all duration-700",
                    ease,
                    noteOn ? "translate-x-0 opacity-100" : "-translate-x-[12%] opacity-0",
                  )}
                  style={{ left: "29.6%", top: "45%" }}
                >
                  <SolBadge className="mt-[1%] size-[1.6cqw] shrink-0" />
                  <span className="min-w-0 leading-tight">
                    <span className="flex items-center gap-[4%] text-[0.95cqw] font-semibold text-ink">
                      {FILM.crmToast.title}
                      <Check className="size-[1cqw] text-sun-line" />
                    </span>
                    <span className="mt-[3%] block text-[0.8cqw] text-ink-2">{FILM.crmToast.body}</span>
                  </span>
                </div>

                {/* The spotlight: the screen dims round the part that matters, lit with a fine orange edge. */}
                <div
                  aria-hidden
                  className={clsx("pointer-events-none absolute rounded-[0.9cqw] transition-all duration-[1100ms]", ease)}
                  style={
                    beat.light
                      ? {
                          left: pct(beat.light[0]),
                          top: pct(beat.light[1]),
                          width: pct(beat.light[2]),
                          height: pct(beat.light[3]),
                          boxShadow:
                            "0 0 0 200cqw rgba(11,12,16,0.42), 0 0 0 0.18cqw rgba(255,90,31,0.9), 0 0 3cqw 0.4cqw rgba(255,90,31,0.35)",
                        }
                      : { left: "0%", top: "0%", width: "100%", height: "100%", boxShadow: "0 0 0 200cqw rgba(11,12,16,0)" }
                  }
                />

                {/* The pointer pressing Design their roof. */}
                <div
                  className={clsx("absolute transition-[left,top,opacity] duration-[900ms]", ease, cursorOn ? "opacity-100" : "opacity-0")}
                  style={{ left: t >= CURSOR.there ? "69.4%" : "52%", top: t >= CURSOR.there ? "38.9%" : "62%" }}
                >
                  <span
                    className={clsx(
                      "absolute -left-[1.4cqw] -top-[1.4cqw] size-[2.8cqw] rounded-full border-[0.18cqw] border-sun-line transition-all duration-500",
                      clicking ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                  />
                  <MousePointer2 className="relative size-[1.6cqw] fill-ink text-white drop-shadow-[0_0.3cqw_0.5cqw_rgba(0,0,0,0.35)]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The chapter, rising in as it begins. */}
        <div className="pointer-events-none absolute left-[3.5%] top-[4%] max-w-[60%]" aria-live="polite">
          <div
            key={chapter}
            className="film-rise rounded-[1.2cqw] bg-[#0d0e11]/70 px-[1.6cqw] py-[1.2cqw] shadow-[0_1cqw_3cqw_-1cqw_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl"
            style={{ animation: still ? undefined : "film-rise 700ms cubic-bezier(0.2,0.8,0.2,1) both" }}
          >
            <p className="text-[clamp(10px,1cqw,13px)] font-semibold tabular-nums tracking-[0.2em] text-sun-line">
              {String(chapter + 1).padStart(2, "0")}
            </p>
            <p className="mt-[0.4cqw] text-[clamp(15px,2.1cqw,26px)] font-semibold leading-tight tracking-[-0.02em] text-white">
              {FILM.chapters[chapter].title}
            </p>
            <p className="mt-[0.3cqw] hidden text-[clamp(11px,1.15cqw,15px)] text-white/60 sm:block">{FILM.chapters[chapter].line}</p>
          </div>
        </div>

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
      <ol className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        {FILM.chapters.map((c, i) => {
          const [from, to] = SPANS[c.key];
          const share = still ? (i === chapter ? 1 : 0) : Math.min(1, Math.max(0, (t - from) / (to - from)));
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => goTo(c.key)}
                aria-current={i === chapter ? "step" : undefined}
                className="group w-full text-left"
              >
                <span className="block h-[3px] w-full overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${share * 100}%` }} />
                </span>
                <span
                  className={clsx(
                    "mt-2 flex items-baseline gap-2 text-[13px] font-medium leading-snug transition-colors lg:truncate",
                    i === chapter ? "text-ink" : "text-muted group-hover:text-ink-2",
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
