"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Eye, Phone } from "lucide-react";
import { SALES_LOOP } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { useMotionOk } from "./living-hero";
import { Ray, RayStyles } from "./rays";
import { SolMark } from "./sol-icon";

/**
 * The sales loop (17 Nov 2026, Martin: lead with the sales team; "in the multi tile slides, each slide isn't engaging.
 * we need some sort of motion"). Four tiles, each a small scene that plays on its own loop while the slide is in view:
 * Charlie ringing a new lead (speed to lead), Sol's follow-up counting down (programmed follow-up), a customer pressing Call me on their proposal, a proposal signed (Martin's phrases, 17 Nov 2026). Drawn,
 * made-up names; still at the end of each scene with reduced motion.
 */

const LOOP_MS = 8000;
const TICK = 100;

function useLoop(live: boolean) {
  const [t, setT] = useState(LOOP_MS - 1);
  useEffect(() => {
    if (!live) return;
    const start = window.setTimeout(() => setT(0), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) setT((v) => (v + TICK) % LOOP_MS);
    }, TICK);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [live]);
  return t;
}

const pop = "transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]";
const shown = (on: boolean) => (on ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2");

function CallScene({ t }: { t: number }) {
  const s = SALES_LOOP.tiles[0].scene;
  const ringing = t >= 1200 && t < 3200;
  const talking = t >= 3200 && t < 5600;
  const booked = t >= 5600;
  const secs = talking ? Math.floor(((t - 3200) / 2400) * 134) : booked ? 134 : 0;
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className={clsx(pop, shown(t >= 200), "rounded-xl bg-surface px-3.5 py-2.5 text-[13px] ring-1 ring-line")}>
        <span className="mr-2 inline-block size-2 rounded-full bg-sun-line" />
        {s.lead}
      </div>
      <div className={clsx(pop, shown(t >= 1200), "flex items-center gap-3 rounded-xl bg-[#202227] px-3.5 py-3 text-white")}>
        <Ray i={1} size={36} live={ringing || talking} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-bright">A Ray</p>
          <p className="text-[13px]">{ringing ? s.ringing : s.talking}</p>
        </div>
        {ringing ? (
          <Phone className="size-4 animate-pulse text-sun-bright" aria-hidden />
        ) : (
          <span className="font-mono text-[13px] tabular-nums text-sun-bright">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <div
        className={clsx(pop, shown(booked), "flex items-center gap-2 rounded-xl bg-positive/10 px-3.5 py-2.5 text-[13px] text-positive")}
      >
        <Check className="size-4 shrink-0" aria-hidden />
        {s.booked}
      </div>
    </div>
  );
}

function FollowScene({ t }: { t: number }) {
  const s = SALES_LOOP.tiles[1].scene;
  const drafting = t >= 1800;
  const sent = t >= 6200;
  const left = Math.max(0, 1 - (t - 2400) / 3800);
  const mins = Math.round(112 * left);
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div
        className={clsx(pop, shown(t >= 200), "flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 text-[13px] ring-1 ring-line")}
      >
        <Eye className="size-4 shrink-0 text-sun-line" aria-hidden />
        {s.opened}
      </div>
      <div className={clsx(pop, shown(drafting), "flex items-center gap-3 rounded-xl bg-sun px-3.5 py-3 ring-1 ring-sun-line/40")}>
        <SolMark className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">{s.drafted}</p>
          <p className={clsx("flex items-center gap-1 text-[12px]", sent ? "font-medium text-positive" : "text-ink-2")}>
            {sent && <Check className="size-3.5" aria-hidden />}
            {sent ? s.sent : `${s.goes} ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`}
          </p>
        </div>
        <svg viewBox="0 0 36 36" className="size-9 shrink-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-sun-line/20" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className={clsx("transition-[stroke-dashoffset] duration-100", sent ? "stroke-positive" : "stroke-sun-line")}
            strokeDasharray={94.2}
            strokeDashoffset={sent ? 0 : 94.2 * left}
          />
        </svg>
      </div>
    </div>
  );
}

function CallMeScene({ t }: { t: number }) {
  const s = SALES_LOOP.tiles[2].scene;
  const pressed = t >= 1400;
  const ringing = t >= 1800 && t < 3600;
  const talking = t >= 3600;
  const said = s.said.slice(0, Math.max(0, Math.floor((t - 3800) / 45)));
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Proposal</p>
        <p className="mt-0.5 text-[13px] font-semibold text-ink">{s.title}</p>
        <span
          className={clsx(
            "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-300",
            pressed ? "scale-95 bg-ink text-white" : "bg-sun-line text-white",
          )}
        >
          <Phone className="size-3.5" aria-hidden />
          {s.button}
        </span>
      </div>
      <div className={clsx(pop, shown(pressed), "flex items-start gap-3 rounded-xl bg-[#202227] px-3.5 py-3 text-white")}>
        <Ray i={3} size={34} live={ringing || talking} />
        <p className="min-w-0 flex-1 text-[13px] leading-snug">
          {talking ? said : s.ringing}
          {talking && said.length < s.said.length && (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-sun-bright" aria-hidden />
          )}
        </p>
      </div>
    </div>
  );
}

function SignedScene({ t }: { t: number }) {
  const s = SALES_LOOP.tiles[3].scene;
  const pressed = t >= 1400;
  const typed = s.name.slice(0, Math.max(0, Math.floor((t - 2000) / 140)));
  const signed = t >= 4200;
  const deposit = t >= 5600;
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="relative rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Proposal</p>
        <p className="mt-0.5 pr-20 text-[13px] font-semibold text-ink">{s.title}</p>
        <div className="mt-3 flex items-end gap-3">
          <span
            className={clsx(
              "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-300",
              pressed ? "bg-ink text-white" : "bg-sun-line text-white",
            )}
          >
            {s.going}
          </span>
          <span className="min-w-0 flex-1 border-b border-ink/30 pb-0.5 font-serif text-[16px] italic text-ink">
            {pressed ? typed : ""}
          </span>
        </div>
        <span
          className={clsx(
            "absolute right-3 top-3 rounded-md border-2 border-positive px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.12em] text-positive transition-all duration-300",
            signed ? "rotate-[-8deg] scale-100 opacity-100" : "scale-150 opacity-0",
          )}
        >
          {s.signed}
        </span>
      </div>
      <div
        className={clsx(
          pop,
          shown(deposit),
          "flex items-center gap-2 rounded-xl bg-sun px-3.5 py-2.5 text-[13px] text-sun-ink ring-1 ring-sun-line/40",
        )}
      >
        <span className="font-mono">$</span>
        {s.deposit}
      </div>
    </div>
  );
}

/** Every tile lays its words beside its scene on a wide screen, in a 2 × 2 grid that fits one fold. */
const wide = (i: number) => i >= 0;

const SCENES = { call: CallScene, follow: FollowScene, callme: CallMeScene, signed: SignedScene } as const;

export function SalesLoop() {
  const root = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const motion = useMotionOk();
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const t = useLoop(inView && motion);
  return (
    <section
      ref={root}
      id="sales"
      className="snap-start scroll-mt-16 px-5 py-14 lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8"
      aria-labelledby="sales-loop"
    >
      <RayStyles />
      <div className="mx-auto w-full max-w-[84rem]">
        <div className="text-center">
          <BrandEyebrow>{SALES_LOOP.eyebrow}</BrandEyebrow>
          <h2 id="sales-loop" className="mt-3 text-[clamp(34px,4vw,60px)] font-semibold leading-[0.98] tracking-[-0.045em]">
            {SALES_LOOP.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-relaxed text-ink-2">{SALES_LOOP.sub}</p>
        </div>
        {/* Two by two, each tile a colour of its own, so the slide holds in one fold (17 Nov 2026, Martin). */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {SALES_LOOP.tiles.map((tile, i) => {
            const Scene = SCENES[tile.key];
            // Each tile on the same clock, a step behind the one before, so they don't all move at once.
            const at = (t + LOOP_MS - i * 700) % LOOP_MS;
            return (
              <article
                key={tile.key}
                className={clsx(
                  "flex flex-col overflow-hidden rounded-[32px] ring-1",
                  wide(i) ? "lg:flex-row lg:items-center" : "",
                  i === 0
                    ? "bg-[#0b0b0d] text-white ring-white/10"
                    : i === 3
                      ? "bg-sun/60 ring-sun-line/30"
                      : i === 1
                        ? "bg-surface ring-line"
                        : "bg-[#eef0f4] ring-line",
                )}
              >
                <div className={clsx("px-7 pt-7", wide(i) && "lg:w-[46%] lg:py-6 lg:pl-8 lg:pr-2")}>
                  <p className={clsx("font-mono text-[12px]", i === 0 ? "text-white/50" : "text-muted")}>
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className={clsx("mt-2 font-semibold leading-[1.02] tracking-[-0.035em]", "text-[clamp(26px,2.2vw,36px)]")}>
                    {tile.title}
                  </h3>
                  <p className={clsx("mt-2 text-[15px] leading-relaxed", i === 0 ? "text-white/70" : "text-ink-2")}>{tile.body}</p>
                </div>
                <div className={clsx("mt-auto px-6 pb-7 pt-6", wide(i) && "lg:flex-1 lg:py-5 lg:pl-2 lg:pr-5")}>
                  <div className="h-[12.5rem] rounded-2xl bg-canvas p-3 text-ink ring-1 ring-line">
                    <Scene t={motion ? at : LOOP_MS - 1} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
