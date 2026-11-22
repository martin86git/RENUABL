"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AI_TEAM } from "@/lib/domain/design/sales-page";
import { SolMark } from "./sol-sun";

/**
 * RENUABL Business's brand on its own page (16 Nov 2026, Martin: "it feels very much like a brand… renuabl business
 * home page still is missing that brand feel", after xAI's Grok Bot and OpenAI's Dots). One device carries it from top
 * to bottom, as Dots is carried by its dots: Sol's sun. It rises behind the hero, leads every section's eyebrow and
 * rises again at the close. The AI team gives the page its characters, as Grok Bot gives its bots.
 */

/** A section's eyebrow, led by Sol's sun. */
export function BrandEyebrow({ children, dark, className }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <p
      className={clsx(
        "inline-flex items-center gap-2.5 text-[13px] font-medium uppercase tracking-[0.2em]",
        dark ? "text-white/70" : "text-ink-2",
        className,
      )}
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full bg-sun-line/40 blur-[5px]" aria-hidden />
        <SolMark className="relative size-4" />
      </span>
      {children}
    </p>
  );
}

/**
 * The sun rising from the foot of a dark section: a wide warm glow with the disc's rim over a fine horizon line.
 * Purely drawn, nothing to read; still with reduced motion. `light` is the softer glow for a white section (the hero,
 * 17 Nov 2026, Martin: the wordmark suits a white backdrop best).
 */
export function Sunrise({ className, size = "large", light }: { className?: string; size?: "large" | "small"; light?: boolean }) {
  return (
    <div aria-hidden className={clsx("pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full overflow-hidden", className)}>
      <style>{`
        @keyframes brand-rise { from { transform: translate(-50%, 12%); opacity: 0.3; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes brand-breathe { 0%,100% { opacity: 0.82; } 50% { opacity: 1; } }
        .brand-rise { animation: brand-rise 2.6s cubic-bezier(0.22, 1, 0.36, 1) both, brand-breathe 8s ease-in-out 2.6s infinite; }
        @media (prefers-reduced-motion: reduce) { .brand-rise { animation: none; } }
      `}</style>
      <div
        className="brand-rise absolute bottom-0 left-1/2 aspect-square rounded-full"
        style={{
          width: size === "large" ? "min(150vw, 120rem)" : "min(120vw, 80rem)",
          transform: "translate(-50%, 0)",
          marginBottom: size === "large" ? "-60%" : "-64%",
          background: light
            ? "radial-gradient(closest-side, rgba(255,170,100,0.5) 0%, rgba(255,90,31,0.28) 30%, rgba(255,90,31,0.1) 55%, rgba(255,90,31,0.03) 78%, rgba(255,90,31,0) 100%)"
            : "radial-gradient(closest-side, rgba(255,150,70,0.9) 0%, rgba(255,90,31,0.7) 30%, rgba(255,90,31,0.26) 55%, rgba(255,90,31,0.07) 78%, rgba(255,90,31,0) 100%)",
        }}
      />
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent",
          light ? "via-ink/15" : "via-white/35",
        )}
      />
    </div>
  );
}

/** One agent's round: Sol's sun, or a phone agent's sound wave in its colour, beating while at work. */
function Face({ k }: { k: string }) {
  if (k === "sol")
    return (
      <span className="relative grid size-16 place-items-center">
        <span className="absolute inset-0 rounded-full bg-sun-line/40 blur-xl" aria-hidden />
        <SolMark className="relative size-16" />
      </span>
    );
  const tint = k === "charlie" ? "#ff5a1f" : "#2bb5a0";
  return (
    <span className="relative grid size-16 place-items-center rounded-full bg-[#202227] ring-1 ring-white/10">
      <span className="absolute inset-0 rounded-full blur-xl" style={{ background: `${tint}33` }} aria-hidden />
      <span className="relative flex h-7 items-center gap-[3px]">
        {[0.45, 0.8, 1, 0.65, 0.4].map((v, i) => (
          <span
            key={i}
            className="team-wave w-[3px] rounded-full"
            style={{ height: `${v * 100}%`, background: tint, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

/** What an agent is doing now: each line typed out, held, then the next. */
function Doing({ lines, offset, live }: { lines: readonly string[]; offset: number; live: boolean }) {
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    let n = 0;
    let line = 0;
    let timer = 0;
    const type = () => {
      n += 1;
      setShown(n);
      if (n < lines[line].length) timer = window.setTimeout(type, 28);
      else
        timer = window.setTimeout(() => {
          line = (line + 1) % lines.length;
          n = 0;
          setAt(line);
          setShown(0);
          timer = window.setTimeout(type, 250);
        }, 2600);
    };
    timer = window.setTimeout(type, 600 + offset);
    return () => window.clearTimeout(timer);
  }, [lines, offset, live]);
  const text = lines[at];
  return (
    <p className="min-h-[3em] font-mono text-[13px] leading-relaxed text-white/85">
      <span className="mr-2 text-sun-line">›</span>
      {shown === null ? text : text.slice(0, shown)}
      {live && <span className="team-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-sun-line" aria-hidden />}
    </p>
  );
}

/** The AI team: Sol and the phone agents as characters, each at work. */
export function AiTeam() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    // Only once it can be seen, and never with reduced motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = document.getElementById("team");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setLive(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section
      id="team"
      className="relative isolate overflow-hidden bg-[#0b0b0d] px-5 pb-28 pt-24 text-white snap-start lg:px-8 lg:pb-32 lg:pt-28"
      aria-labelledby="ai-team"
    >
      <style>{`
        @keyframes team-wave { 0%,100% { transform: scaleY(0.45); } 50% { transform: scaleY(1.1); } }
        @keyframes team-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @keyframes team-dot { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); } 70% { box-shadow: 0 0 0 7px rgba(52,211,153,0); } }
        .team-wave { animation: team-wave 0.9s ease-in-out infinite; transform-origin: center; }
        .team-caret { animation: team-blink 1s step-end infinite; }
        .team-dot { animation: team-dot 2s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .team-wave, .team-caret, .team-dot { animation: none; } }
      `}</style>
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,90,31,0.16), rgba(255,90,31,0))" }}
      />
      <div className="mx-auto max-w-[84rem]">
        <div className="text-center">
          <BrandEyebrow dark>{AI_TEAM.eyebrow}</BrandEyebrow>
          <h2 id="ai-team" className="mt-6 text-[clamp(40px,5.6vw,88px)] font-semibold leading-[0.95] tracking-[-0.045em]">
            {AI_TEAM.headline.map((line, i) => (
              <span key={line} className={clsx("block", i === AI_TEAM.headline.length - 1 && "text-sun-line")}>
                {line}
              </span>
            ))}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[18px] leading-relaxed text-white/65">{AI_TEAM.sub}</p>
        </div>
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {AI_TEAM.agents.map((a, i) => (
            <article
              key={a.key}
              className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 ring-1 ring-white/10 transition-colors hover:ring-white/25"
            >
              <div className="flex items-start justify-between">
                <Face k={a.key} />
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-white/75 ring-1 ring-white/10">
                  <span className="team-dot size-2 rounded-full bg-emerald-400" aria-hidden />
                  {AI_TEAM.working}
                </span>
              </div>
              <h3 className="mt-7 text-[30px] font-semibold tracking-[-0.03em]">{a.name}</h3>
              <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-sun-line">{a.job}</p>
              <p className="mt-4 text-[16px] leading-relaxed text-white/65">{a.what}</p>
              <div className="mt-7 rounded-2xl bg-black/40 px-4 py-3.5 ring-1 ring-white/[0.08]">
                <Doing lines={a.doing} offset={i * 900} live={live} />
              </div>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[14px] leading-relaxed text-white/50">{AI_TEAM.note}</p>
      </div>
    </section>
  );
}
