"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { LANDING_HERO } from "@/lib/domain/design/landing";

/** How long each "It's …" stays before the next takes its place. */
const FOLLOW_MS = 1700;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The front page's first screen, the way Apple would: the punchline alone,
 * and the line under it answering by itself how a roof becomes revenue, a
 * phrase at a time. Then the product rises into view as you scroll. Light,
 * never black (Martin: black is too harsh). With reduced motion the phrases
 * stand together and nothing moves.
 */
export function FrontHero({
  signInHref,
  tryHref,
  reveal,
}: {
  signInHref: string;
  tryHref: string;
  /** What rises into view below the first screen: the product at work, with its line above it. */
  reveal: { line: string; sub: string; demo: React.ReactNode };
}) {
  const follows = LANDING_HERO.follows;
  const [n, setN] = useState(0);
  const [still, setStill] = useState(true);
  useEffect(() => {
    if (reducedMotion()) return;
    // The phrases start turning once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStill(false);
    const timer = window.setInterval(() => setN((i) => (i + 1) % follows.length), FOLLOW_MS);
    return () => window.clearInterval(timer);
  }, [follows.length]);

  return (
    <section className="relative isolate overflow-hidden bg-canvas" aria-labelledby="hero">
      {/* A soft warmth behind the words, as morning light. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[90vh]"
        style={{ background: "radial-gradient(60% 55% at 50% 38%, rgba(255,90,31,0.10), rgba(255,90,31,0) 70%)" }}
      />
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

      <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="mb-7 text-[12px] font-medium uppercase tracking-[0.3em] text-muted">{LANDING_HERO.what}</p>
        <h1
          id="hero"
          className="max-w-5xl text-balance text-[clamp(56px,11vw,150px)] font-light leading-[0.92] tracking-[-0.045em] text-ink"
        >
          {LANDING_HERO.headline}
        </h1>
        <p className="mt-8 h-[1.3em] text-[clamp(24px,3.4vw,40px)] font-light tracking-[-0.02em] text-ink-2">
          {still ? (
            follows.join(" ")
          ) : (
            <span key={n} className="inline-block" style={{ animation: `follow-in ${FOLLOW_MS}ms ease-in-out` }}>
              {follows[n]}
            </span>
          )}
        </p>
        <p className="mt-6 max-w-2xl text-balance text-[16px] leading-relaxed text-ink-2">{LANDING_HERO.covers}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href={signInHref}
            className="inline-flex h-12 items-center rounded-full bg-ink px-8 text-[14px] font-medium text-white transition-colors hover:bg-ink/85"
          >
            Get started
          </a>
          <a
            href="#product"
            className="inline-flex h-12 items-center rounded-full border border-ink/20 px-8 text-[14px] font-medium text-ink transition-colors hover:border-ink/50"
          >
            See it work
          </a>
        </div>
        <p className="mt-6 text-[14px] text-muted">{LANDING_HERO.speed}</p>
      </div>

      <ProductReveal {...reveal} />
    </section>
  );
}

/** How far a block has come through the screen as it is scrolled: 0 as its top reaches the bottom, 1 once it sits a third of the way up. */
function useScrolledIn<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(1);
  useEffect(() => {
    if (reducedMotion()) return;
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const h = window.innerHeight;
      setP(Math.max(0, Math.min(1, (h - top) / (h * 0.66))));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return { ref, p };
}

/** The product at work, rising into view and settling flat as it is scrolled to, with its line above it. */
function ProductReveal({ line, sub, demo }: { line: string; sub: string; demo: React.ReactNode }) {
  const { ref, p } = useScrolledIn<HTMLDivElement>();
  return (
    <div id="product" className="px-4 pb-28 sm:px-8" style={{ perspective: "1800px" }}>
      <Reveal className="mx-auto mb-12 max-w-4xl text-center">
        <h2 className="text-[clamp(36px,6vw,76px)] font-light leading-[1.02] tracking-[-0.035em] text-ink">{line}</h2>
        <p className="mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-ink-2">{sub}</p>
      </Reveal>
      <div
        ref={ref}
        className="mx-auto w-full max-w-6xl"
        style={{
          transform: `rotateX(${(1 - p) * 22}deg) scale(${0.9 + p * 0.1}) translateY(${(1 - p) * 40}px)`,
          opacity: 0.35 + p * 0.65,
          transformOrigin: "50% 0%",
          willChange: "transform",
        }}
      >
        {demo}
      </div>
    </div>
  );
}

/** A block that fades and rises into view once, as it is scrolled to. */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={clsx("transition-all duration-1000 ease-out", seen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0", className)}
    >
      {children}
    </div>
  );
}
