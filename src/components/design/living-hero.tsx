"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp } from "lucide-react";
import { HERO_LIVE, SALES_HERO } from "@/lib/domain/design/sales-page";
import { BrandEyebrow, Sunrise } from "./business-brand";
import { TryDemoButton } from "./business-demo";
import { SolMark } from "./sol-icon";

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

function useMotionOk() {
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
function useSaying(lines: readonly string[], live: boolean, offset: number, hold = 3200) {
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
function BigSol({ busy, lean }: { busy: boolean; lean: { x: number; y: number } }) {
  return (
    <span
      className="relative grid size-28 place-items-center transition-transform duration-700 ease-out sm:size-36"
      style={{ transform: `translate(${lean.x}px, ${lean.y}px)` }}
    >
      <span
        aria-hidden
        className={clsx(
          "absolute -inset-8 rounded-full bg-sun-line/35 blur-3xl transition-opacity duration-700",
          busy ? "opacity-100" : "opacity-50",
        )}
      />
      <span aria-hidden className={clsx("absolute -inset-3 rounded-full ring-1 ring-sun-line/30", busy && "live-ring")} />
      <SolMark className="live-breathe relative size-full" />
    </span>
  );
}

/** A speech bubble, typed as it is said. */
function Bubble({ who, text, busy, tail }: { who: Who; text: string; busy: boolean; tail: "down" | "up" }) {
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

function answerFor(q: string) {
  const words = q.toLowerCase();
  const A = HERO_LIVE.ask;
  if (A.price.keys.some((k) => words.includes(k))) return A.price.answer;
  const hit = A.questions.find((x) => x.ask.toLowerCase() === words || x.keys.some((k) => words.includes(k)));
  return hit ? hit.answer : A.fallback;
}

/** The feed of work just done: a new line every few seconds at the top, the older ones ageing below. */
function Feed({ live }: { live: boolean }) {
  const items = HERO_LIVE.feed;
  const [head, setHead] = useState(0);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setHead((h) => (h + 1) % items.length), 3400);
    return () => window.clearInterval(timer);
  }, [live, items.length]);
  const rows = [0, 1, 2].map((k) => ({ ...items[(head - k + items.length) % items.length], k }));
  return (
    <ul className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2" aria-label="Work just done">
      {rows.map((r) => (
        <li
          key={`${head}-${r.k}`}
          className={clsx(
            "flex items-center gap-2.5 rounded-full bg-surface/80 py-1.5 pl-1.5 pr-4 text-left text-[13px] text-ink-2 ring-1 ring-line backdrop-blur transition-opacity",
            r.k === 0 && live && "live-in",
            r.k === 1 && "opacity-75",
            r.k === 2 && "opacity-45",
          )}
        >
          {r.who === "sol" ? <SolMark className="size-6 shrink-0" /> : <AgentWave who={r.who as Exclude<Who, "sol">} size={24} />}
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{NAMES[r.who as Who]}</span> · {r.text}
          </span>
          <span className="shrink-0 text-[12px] text-muted">{r.k === 0 ? HERO_LIVE.now : `${r.k * 2} ${HERO_LIVE.ago}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ask Sol: a box and four questions; he thinks, then types his answer in his bubble. */
function useAsk() {
  const [asked, setAsked] = useState<{ q: string; a: string; at: number } | null>(null);
  const ask = (q: string) => {
    const clean = q.trim().slice(0, 200);
    if (!clean) return;
    setAsked({ q: clean, a: answerFor(clean), at: Date.now() });
  };
  return { asked, ask };
}

function useTyped(text: string | null, key: number, live: boolean) {
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

export function LivingHero({ signedIn }: { signedIn: boolean }) {
  const live = useMotionOk();
  const root = useRef<HTMLElement | null>(null);
  const [lean, setLean] = useState({ x: 0, y: 0 });
  const [input, setInput] = useState("");
  const sol = useSaying(HERO_LIVE.says.sol, live, 0, 3600);
  const charlie = useSaying(HERO_LIVE.says.charlie, live, 1400);
  const alex = useSaying(HERO_LIVE.says.alex, live, 2600);
  const { asked, ask } = useAsk();
  const answer = useTyped(asked?.a ?? null, asked?.at ?? 0, live);

  useEffect(() => {
    if (!live) return;
    const el = root.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      setLean({ x: Math.max(-1, Math.min(1, x)) * 14, y: Math.max(-1, Math.min(1, y)) * 10 });
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [live]);

  const solText = asked ? answer.shown : sol.shown;
  const solBusy = asked ? answer.busy : sol.busy;

  return (
    <section
      ref={root}
      id="start"
      className="relative isolate overflow-hidden px-5 pb-14 pt-12 snap-start lg:min-h-[calc(100dvh-4rem)] lg:pt-14"
      aria-labelledby="hero"
    >
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
      <Sunrise light />
      <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
        <BrandEyebrow>{SALES_HERO.introducing}</BrandEyebrow>
        <p className="mt-3 text-balance text-[clamp(20px,1.9vw,28px)] font-medium leading-snug tracking-[-0.02em] text-ink">
          {SALES_HERO.newWay}
        </p>
        <h1 id="hero" className="mt-4 text-[clamp(44px,5.4vw,84px)] font-semibold leading-[0.95] tracking-[-0.045em]">
          {SALES_HERO.headline[0]} <span className="text-sun-line">{SALES_HERO.headline[1]}</span>
        </h1>

        {/* The team at work: Charlie, Sol, Alex. */}
        <div className="mt-10 grid w-full items-end gap-6 sm:grid-cols-[1fr_auto_1fr] lg:mt-12">
          <div className="hidden flex-col items-center gap-3 sm:flex">
            <Bubble who="charlie" text={charlie.shown} busy={charlie.busy} tail="down" />
            <AgentWave who="charlie" size={64} busy={charlie.busy || live} />
            <p className="text-[13px] text-muted">Sales calls</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div aria-live="polite">
              {answer.thinking ? (
                <div className="flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted ring-1 ring-sun-line/40">
                  {HERO_LIVE.ask.thinking}
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="live-dot size-1.5 rounded-full bg-sun-line" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </div>
              ) : (
                <Bubble who="sol" text={solText} busy={solBusy} tail="down" />
              )}
            </div>
            <BigSol busy={solBusy || answer.thinking} lean={lean} />
          </div>
          <div className="hidden flex-col items-center gap-3 sm:flex">
            <Bubble who="alex" text={alex.shown} busy={alex.busy} tail="down" />
            <AgentWave who="alex" size={64} busy={alex.busy || live} />
            <p className="text-[13px] text-muted">Post sale</p>
          </div>
        </div>

        {/* Ask Sol. */}
        <form
          className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-full bg-surface p-1.5 pl-5 shadow-[0_16px_40px_-20px_rgba(11,11,12,0.45)] ring-1 ring-line focus-within:ring-sun-line"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
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
              onClick={() => ask(q.ask)}
              className="rounded-full bg-surface/70 px-3.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink/30"
            >
              {q.ask}
            </button>
          ))}
        </div>
        {asked && <p className="mt-2 text-[12px] text-muted">{HERO_LIVE.ask.note}</p>}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="#pricing"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-sun-line px-7 text-[16px] font-semibold text-white shadow-lift hover:brightness-105"
          >
            {SALES_HERO.cta}
          </a>
          {!signedIn && <TryDemoButton look="quiet" label="Start demo" />}
        </div>

        <div className="mt-10 w-full">
          <Feed live={live} />
        </div>
      </div>
    </section>
  );
}
