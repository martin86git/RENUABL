"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp } from "lucide-react";
import { HERO_LIVE, RAYS, SALES_HERO, VOICE_AGENTS } from "@/lib/domain/design/sales-page";

const RAYS_SOON = RAYS.soon;
import { BrandEyebrow, Sunrise } from "./business-brand";
import { TryDemoButton } from "./business-demo";
import { SolMark } from "./sol-icon";
import { LiveSun } from "./live-sun";
import { Ray, RayStyles } from "./rays";

/**
 * The living hero (17 Nov 2026, Martin: "the bots themselves are the marketing… it makes the software feel alive",
 * after xAI's Grok Bot and OpenAI's Dots). Sol in the middle, large, breathing and leaning towards the pointer, with
 * Charlie and Alex either side; each says what they're doing as they do it. Under them, a box to ask Sol (written
 * answers, matched by words: no AI is called from the open page) and a feed of the work they've just done. Copy in
 * `HERO_LIVE` (sales-page.ts, tested). Still with reduced motion: each shows its first line whole.
 */

type Who = "sol" | "charlie" | "alex";
const TINT: Record<Exclude<Who, "sol">, string> = { charlie: "#ff5a1f", alex: "#2bb5a0" };
const NAMES: Record<Who, string> = { sol: "Sol", charlie: "Charlie", alex: "Alex" };

export function useMotionOk() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setOk(!m.matches);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);
  return ok;
}

/** Types each line out, holds it, then the next; `busy` while typing. */
export function useSaying(lines: readonly string[], live: boolean, offset: number, hold = 3200) {
  const [state, setState] = useState({ line: 0, n: -1 });
  useEffect(() => {
    if (!live) return;
    let line = 0;
    let n = 0;
    let timer = 0;
    const step = () => {
      n += 1;
      setState({ line, n });
      if (n < lines[line].length) timer = window.setTimeout(step, 26);
      else
        timer = window.setTimeout(() => {
          line = (line + 1) % lines.length;
          n = 0;
          setState({ line, n: 0 });
          timer = window.setTimeout(step, 450);
        }, hold);
    };
    timer = window.setTimeout(step, 500 + offset);
    return () => window.clearTimeout(timer);
  }, [lines, live, offset, hold]);
  const text = lines[state.line];
  const shown = state.n < 0 ? text : text.slice(0, state.n);
  return { shown, busy: state.n >= 0 && state.n < text.length };
}

/** A phone agent: the sound wave on graphite, beating while it talks. */
export function AgentWave({ who, size, busy }: { who: Exclude<Who, "sol">; size: number; busy?: boolean }) {
  const tint = TINT[who];
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full bg-[#202227] shadow-[0_18px_40px_-18px_rgba(11,11,12,0.6)] ring-1 ring-black/10"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className={clsx("absolute -inset-3 rounded-full blur-xl transition-opacity duration-700", busy ? "opacity-100" : "opacity-40")}
        style={{ background: `${tint}40` }}
      />
      <span className="relative flex items-center gap-[3px]" style={{ height: size * 0.42 }}>
        {[0.45, 0.8, 1, 0.65, 0.4].map((v, i) => (
          <span
            key={i}
            className={clsx("w-[3px] rounded-full", busy && "live-wave")}
            style={{ height: `${v * 100}%`, background: tint, animationDelay: `${i * 110}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Sol, large: his sun breathing, glowing brighter while he talks or thinks, leaning a touch towards the pointer. */
export function BigSol({
  busy,
  lean,
  className = "size-28 sm:size-36",
}: {
  busy: boolean;
  lean: { x: number; y: number };
  className?: string;
}) {
  return (
    <span
      className={clsx("relative grid place-items-center transition-transform duration-700 ease-out", className)}
      style={{ transform: `translate(${lean.x}px, ${lean.y}px)` }}
    >
      {/* The live sun (18 Nov 2026, Martin: the glossy orb read as an entry-level tool): its canvas twice the disc, for the
          corona round it. */}
      <span aria-hidden className="pointer-events-none absolute -inset-1/2">
        <LiveSun energy={busy ? 1 : 0} />
      </span>
    </span>
  );
}

/** A speech bubble, typed as it is said. */
export function Bubble({ who, text, busy, tail }: { who: Who; text: string; busy: boolean; tail: "down" | "up" }) {
  return (
    <div
      className={clsx(
        "relative w-[16rem] max-w-full rounded-2xl bg-surface px-4 py-3 text-left shadow-[0_12px_30px_-16px_rgba(11,11,12,0.35)] ring-1 ring-line",
        who === "sol" && "w-[min(22rem,calc(100vw-2.5rem))] ring-sun-line/40",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sun-line">{NAMES[who]}</p>
      <p className="mt-1 min-h-[2.8em] text-[14px] leading-snug text-ink sm:text-[15px]">
        {text}
        {busy && <span className="live-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-sun-line" aria-hidden />}
      </p>
      <span
        aria-hidden
        className={clsx(
          "absolute left-1/2 size-3 -translate-x-1/2 rotate-45 bg-surface ring-1 ring-line [clip-path:polygon(100%_0,100%_100%,0_100%)]",
          tail === "down" ? "-bottom-1.5" : "-top-1.5 [clip-path:polygon(0_0,100%_0,0_100%)]",
          who === "sol" && "ring-sun-line/40",
        )}
      />
    </div>
  );
}

export function answerFor(q: string) {
  const words = q.toLowerCase();
  const A = HERO_LIVE.ask;
  if (A.price.keys.some((k) => words.includes(k))) return A.price.answer;
  const hit = A.questions.find((x) => x.ask.toLowerCase() === words || x.keys.some((k) => words.includes(k)));
  return hit ? hit.answer : A.fallback;
}

/** Ask Sol: a box and four questions; he thinks, then types his answer in his bubble. */
export function useAsk() {
  const [asked, setAsked] = useState<{ q: string; a: string; at: number } | null>(null);
  const ask = (q: string) => {
    const clean = q.trim().slice(0, 200);
    if (!clean) return;
    setAsked({ q: clean, a: answerFor(clean), at: Date.now() });
  };
  return { asked, ask };
}

export function useTyped(text: string | null, key: number, live: boolean) {
  const [n, setN] = useState(0);
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    if (!text) return;
    let timer = 0;
    let i = 0;
    const step = () => {
      i += 2;
      setN(i);
      if (i < text.length) timer = window.setTimeout(step, 22);
    };
    // The answer is set from a press, not from the effect itself, so the thinking pause runs on a timer.
    timer = window.setTimeout(() => {
      setThinking(true);
      setN(0);
      timer = window.setTimeout(
        () => {
          setThinking(false);
          if (live) step();
          else setN(text.length);
        },
        live ? 1100 : 0,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [text, key, live]);
  return { shown: text ? text.slice(0, n) : "", thinking, busy: !!text && (thinking || n < text.length) };
}

/** The box to ask Sol, with the ready questions under it. */
export function AskBox({ onAsk, asked }: { onAsk: (q: string) => void; asked: boolean }) {
  const [input, setInput] = useState("");
  return (
    <div className="flex w-full flex-col items-center">
      <form
        className="flex w-full max-w-xl items-center gap-2 rounded-full bg-surface p-1.5 pl-5 shadow-[0_16px_40px_-20px_rgba(11,11,12,0.45)] ring-1 ring-line focus-within:ring-sun-line"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(input);
          setInput("");
        }}
      >
        <SolMark className="size-5 shrink-0" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={HERO_LIVE.ask.placeholder}
          aria-label={HERO_LIVE.ask.placeholder}
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={HERO_LIVE.ask.send}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-sun-line text-white hover:brightness-105"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
      <div className="mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
        {HERO_LIVE.ask.questions.map((q) => (
          <button
            key={q.ask}
            type="button"
            onClick={() => onAsk(q.ask)}
            className="rounded-full bg-surface/70 px-3.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink/30"
          >
            {q.ask}
          </button>
        ))}
      </div>
      {asked && <p className="mt-2 text-[12px] text-muted">{HERO_LIVE.ask.note}</p>}
    </div>
  );
}

/** The motion the living parts share: Sol breathing, his ring, the waves, the caret. Put once per section. */
export function LiveStyles() {
  return (
    <style>{`
        @keyframes live-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }
        @keyframes live-ring { 0% { transform: scale(0.9); opacity: 0.9; } 100% { transform: scale(1.35); opacity: 0; } }
        @keyframes live-wave { 0%,100% { transform: scaleY(0.45); } 50% { transform: scaleY(1.1); } }
        @keyframes live-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @keyframes live-in { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes live-dots { 0%,80%,100% { opacity: 0.25; } 40% { opacity: 1; } }
        .live-breathe { animation: live-breathe 4.5s ease-in-out infinite; }
        .live-ring { animation: live-ring 1.6s ease-out infinite; }
        .live-wave { animation: live-wave 0.9s ease-in-out infinite; transform-origin: center; }
        .live-caret { animation: live-blink 1s step-end infinite; }
        .live-in { animation: live-in 600ms cubic-bezier(0.2,0.8,0.2,1) both; }
        .live-dot { animation: live-dots 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .live-breathe, .live-ring, .live-wave, .live-caret, .live-in, .live-dot { animation: none; } }
      `}</style>
  );
}

/** Whether an element is on screen, so its motion runs only while it can be seen. */
export function useInView(root: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);
  return on;
}

/** Follows the pointer over an element, for Sol to lean towards it. */
export function useLean(root: React.RefObject<HTMLElement | null>, live: boolean, reach = 14) {
  const [lean, setLean] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!live) return;
    const move = (e: PointerEvent) => {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      setLean({ x: Math.max(-1, Math.min(1, x)) * reach, y: Math.max(-1, Math.min(1, y)) * reach * 0.7 });
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [live, root, reach]);
  return lean;
}

/**
 * The announcement (17 Nov 2026, Martin: keep "Solar just got a brain", announce something huge, as clean as Apple's
 * product pages): "Introducing Sol", the headline as large as the screen allows, what he is in one line, and Sol
 * himself, large and alive, saying what he's doing.
 */
export function LivingHero({ signedIn }: { signedIn: boolean }) {
  const motion = useMotionOk();
  const root = useRef<HTMLElement | null>(null);
  const seen = useInView(root);
  const live = motion && seen;
  const lean = useLean(root, live, 18);
  const sol = useSaying(HERO_LIVE.says.sol, live, 900, 3600);
  return (
    <section
      ref={root}
      id="start"
      className="relative isolate overflow-hidden px-5 pb-16 pt-14 snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:pt-10"
      aria-labelledby="hero"
    >
      <LiveStyles />
      <Sunrise light />
      <div className="mx-auto grid max-w-[90rem] items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6">
        <div className="text-center lg:text-left">
          <BrandEyebrow>{SALES_HERO.introducing}</BrandEyebrow>
          <h1 id="hero" className="mt-6 text-[clamp(56px,8vw,148px)] font-semibold leading-[0.88] tracking-[-0.055em]">
            <span className="block">{SALES_HERO.headline[0]}</span>
            <span className="block text-sun-line">{SALES_HERO.headline[1]}</span>
          </h1>
          {/* …and a voice: the voice agents, the sales agent's wave speaking beside it. */}
          <p className="mt-4 inline-flex items-center gap-3 text-[clamp(28px,3.4vw,56px)] font-semibold leading-none tracking-[-0.04em] text-ink-2">
            {SALES_HERO.andVoice}
            <Ray i={0} size={48} live={live} />
          </p>
          <p className="mt-7 text-[clamp(22px,2.3vw,36px)] font-medium leading-tight tracking-[-0.025em] text-ink">{SALES_HERO.sub}</p>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-relaxed text-ink-2 lg:mx-0">{SALES_HERO.line}</p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <a
              href="#pricing"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-sun-line px-7 text-[16px] font-semibold text-white shadow-lift hover:brightness-105"
            >
              {SALES_HERO.cta}
            </a>
            {!signedIn && <TryDemoButton look="quiet" label="Start demo" />}
          </div>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div aria-live="polite">
            <Bubble who="sol" text={sol.shown} busy={sol.busy} tail="down" />
          </div>
          <BigSol busy={sol.busy} lean={lean} className="size-44 sm:size-56 lg:size-[17rem]" />
          <p className="text-[14px] text-muted">
            <span className="font-medium text-ink">Sol</span> · {HERO_LIVE.jobs.sol}
          </p>
          {/* His voice agents beside him, one a role (18 Nov 2026, Martin: the product's audio icons, a colour each). */}
          <RayStyles />
          <div className="mt-2 flex items-start justify-center gap-6">
            {VOICE_AGENTS.map((v, i) => (
              <div key={v.key} className="flex w-24 flex-col items-center text-center">
                <Ray i={i} size={52} live={live && i === 0} />
                <p className="mt-2 text-[13px] font-medium text-ink">{v.role}</p>
                {"soon" in v && v.soon && <p className="text-[11px] text-muted">{RAYS_SOON}</p>}
              </div>
            ))}
          </div>
          <p className="text-[14px] text-muted">{HERO_LIVE.jobs.rays}</p>
        </div>
      </div>
    </section>
  );
}
