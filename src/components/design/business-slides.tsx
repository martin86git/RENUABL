"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { KNOWLEDGE, MANIFESTO } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { AskBox, BigSol, Bubble, LiveStyles, useAsk, useLean, useMotionOk, useSaying, useTyped, useInView } from "./living-hero";
import { SolMark } from "./sol-sun";

/**
 * Two of the /business slides (17 Nov 2026, Martin: 90s direct statements, as clean as Apple, with no two slides laid
 * out alike). The manifesto: one statement at a time, huge, on black, lit as it is scrolled to. The brain: Sol in the
 * middle with what he knows circling him, and the box to ask him.
 */

export function Manifesto() {
  const lines = [...MANIFESTO.statements, ...MANIFESTO.finale];
  const refs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [lit, setLit] = useState(-1);
  const motion = useMotionOk();
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.i);
          setLit((n) => Math.max(n, i));
        }
      },
      { rootMargin: "-35% 0px -35% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const statements = MANIFESTO.statements.length;
  return (
    <section
      id="force"
      className="relative isolate overflow-hidden bg-[#050506] px-5 py-[16vh] text-white snap-start lg:px-8"
      aria-labelledby="force-head"
    >
      <div
        aria-hidden
        className="absolute left-[-10%] top-1/3 -z-10 size-[50rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,90,31,0.18), rgba(255,90,31,0))" }}
      />
      <div className="mx-auto max-w-6xl">
        <h2 id="force-head">
          <BrandEyebrow dark>{MANIFESTO.eyebrow}</BrandEyebrow>
        </h2>
        <div className="mt-[8vh] space-y-[9vh]">
          {lines.map((line, i) => {
            const finale = i >= statements;
            const on = !motion || i <= lit;
            return (
              <p
                key={line}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-i={i}
                className={clsx(
                  "font-semibold leading-[0.95] tracking-[-0.05em] transition-all duration-1000 ease-out",
                  finale ? "text-[clamp(48px,8vw,140px)]" : "text-[clamp(38px,6vw,104px)]",
                  i === statements && "pt-[6vh]",
                  on ? "translate-y-0 opacity-100 blur-0" : "translate-y-6 opacity-10 blur-[2px]",
                  finale && i === lines.length - 1 && "text-sun-line",
                  !finale && on && i < lit && motion && "text-white/40",
                )}
              >
                {line}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function KnowledgeOrbit() {
  const root = useRef<HTMLElement | null>(null);
  const seen = useInView(root);
  const live = useMotionOk() && seen;
  const lean = useLean(root, live, 10);
  const idle = useSaying(KNOWLEDGE.idle, live, 600, 4200);
  const { asked, ask } = useAsk();
  const answer = useTyped(asked?.a ?? null, asked?.at ?? 0, live);
  const text = asked ? answer.shown : idle.shown;
  const busy = asked ? answer.busy : idle.busy;
  const inner = KNOWLEDGE.orbit.slice(0, 6);
  const outer = KNOWLEDGE.orbit.slice(6);
  return (
    <section
      ref={root}
      id="brain"
      className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_center,#fff_0%,#f4f4f6_70%)] px-5 py-20 snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8"
      aria-labelledby="brain-head"
    >
      <LiveStyles />
      <div className="mx-auto w-full max-w-6xl text-center">
        <BrandEyebrow>{KNOWLEDGE.eyebrow}</BrandEyebrow>
        <h2 id="brain-head" className="mt-4 text-[clamp(44px,6vw,96px)] font-semibold leading-[0.95] tracking-[-0.05em]">
          {KNOWLEDGE.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[clamp(17px,1.5vw,21px)] leading-relaxed text-ink-2">{KNOWLEDGE.sub}</p>

        {/* Sol with what he knows circling him; on a phone the chips sit in a row instead. */}
        <div className="relative mx-auto mt-8 hidden aspect-[2/1] w-full max-w-5xl md:block">
          <Ring items={outer} rx={47} ry={45} speed={-0.05} live={live} />
          <Ring items={inner} rx={36} ry={30} speed={0.08} live={live} />
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="flex flex-col items-center gap-4">
              <div aria-live="polite" className="h-[5.5rem] flex items-end">
                {answer.thinking ? <Thinking /> : <Bubble who="sol" text={text} busy={busy} tail="down" />}
              </div>
              <BigSol busy={busy || answer.thinking} lean={lean} className="size-32" />
            </div>
          </div>
        </div>
        <div className="mt-8 md:hidden">
          <div className="flex flex-col items-center gap-4">
            <div aria-live="polite">{answer.thinking ? <Thinking /> : <Bubble who="sol" text={text} busy={busy} tail="down" />}</div>
            <BigSol busy={busy || answer.thinking} lean={lean} className="size-28" />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {KNOWLEDGE.orbit.map((k) => (
              <span key={k} className="rounded-full bg-surface px-3 py-1 text-[12px] text-ink-2 ring-1 ring-line">
                {k}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <AskBox onAsk={ask} asked={!!asked} />
        </div>
      </div>
    </section>
  );
}

function Ring({ items, rx, ry, speed, live }: { items: readonly string[]; rx: number; ry: number; speed: number; live: boolean }) {
  // Each chip moves along its ellipse, upright; a slow turn, still with reduced motion.
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setTurn((v) => v + speed * 0.05);
    }, 50);
    return () => window.clearInterval(timer);
  }, [live, speed]);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {items.map((k, i) => {
        const a = (i / items.length) * Math.PI * 2 + turn;
        return (
          <span
            key={k}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${50 + rx * Math.cos(a)}%`, top: `${50 + ry * Math.sin(a)}%` }}
          >
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface/90 px-3.5 py-1.5 text-[13px] text-ink-2 shadow-[0_8px_24px_-14px_rgba(11,11,12,0.4)] ring-1 ring-line backdrop-blur">
              <span className="size-1.5 rounded-full bg-sun-line" />
              {k}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted ring-1 ring-sun-line/40">
      <SolMark className="size-4" />
      Sol is thinking
      {[0, 1, 2].map((i) => (
        <span key={i} className="live-dot size-1.5 rounded-full bg-sun-line" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </div>
  );
}
