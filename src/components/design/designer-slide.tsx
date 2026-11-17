"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { Check } from "lucide-react";
import { DESIGNER } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { LiveStyles, useMotionOk } from "./living-hero";
import { SolMark } from "./sol-icon";

/**
 * The assisted designer (17 Nov 2026, Martin: the page was missing the designer, "asking for confirmations and whether
 * to string, and then showing the stringing done, then with a card saying move on to quote"). A real roof from the
 * design tool with the panels laid (the address is never shown); Sol's cards come up one at a time in the designer's own words (`sol-nudges.ts`), each pressed, the
 * panels strung into A and B, each string checked, then the next step to the quote. Still with reduced motion.
 */

const LOOP = 15000;
/** Where the panels sit across the roof picture, as shares of its width: the strung frame wipes in across them. */
const PANELS_FROM = 0.22;
const PANELS_TO = 0.56;
const STRING_TINT = ["#f9a8d4", "#86efac"];

function useSceneClock(root: React.RefObject<HTMLElement | null>, live: boolean) {
  const [t, setT] = useState(LOOP - 1);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);
  useEffect(() => {
    if (!live || !inView) return;
    const start = window.setTimeout(() => setT(0), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) setT((v) => (v + 100) % LOOP);
    }, 100);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [live, inView]);
  return t;
}

export function DesignerSlide() {
  const root = useRef<HTMLElement | null>(null);
  const live = useMotionOk();
  const t = useSceneClock(root, live);
  const C = DESIGNER.cards;
  // The solar first (17 Nov 2026, Martin: don't open on backup when the panels are in focus): string them, check the
  // strings, then the question the quote needs, then on to the quote.
  const strung = Math.max(0, Math.min(1, (t - 2600) / 1800));
  const card = t < 900 ? null : t < 3200 ? "strings" : t < 5200 ? null : t < 8800 ? "backup" : "next";
  const pressed = (card === "strings" && t >= 2300) || (card === "backup" && t >= 7200) || (card === "next" && t >= 12600);
  const backup = t >= 7400;
  const checked = t >= 4600;
  const step = t < 4600 ? 0 : t < 5200 ? 1 : t < 8800 ? 2 : 3;
  // The strung frame shown up to here, from the left: across the panels as Sol strings them, then whole.
  const reveal = strung >= 1 ? 1 : strung <= 0 ? 0 : PANELS_FROM + (PANELS_TO - PANELS_FROM) * strung;
  const go = card === "backup" ? C.backup.yes : card === "strings" ? C.strings.go : C.next.go;

  return (
    <section
      ref={root}
      id="designer"
      className="relative isolate overflow-hidden bg-[#eceef2] px-5 py-16 snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8"
      aria-labelledby="designer-head"
    >
      <LiveStyles />
      <div className="mx-auto grid w-full max-w-[84rem] items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-14">
        {/* The scene. */}
        <div className="relative order-2 overflow-hidden rounded-[32px] bg-[#1d2127] shadow-[0_40px_90px_-40px_rgba(11,11,12,0.6)] ring-1 ring-black/10 lg:order-1">
          {/* The real roof (17 Nov 2026, Martin: the designer on a real aerial photo), from the design tool: the panels as
              laid, then the same view strung. */}
          <div className="relative aspect-[952/464] w-full">
            <Image
              src="/design/landing/designer-laid.webp"
              alt={DESIGNER.alt}
              fill
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)` }}>
              <Image
                src="/design/landing/designer-strung.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 900px, 100vw"
                className="object-cover"
              />
            </div>
            {strung > 0 && strung < 1 && (
              <span
                aria-hidden
                className="absolute inset-y-[18%] w-[2px] bg-white shadow-[0_0_12px_3px_rgba(255,255,255,0.8)]"
                style={{ left: `${reveal * 100}%` }}
              />
            )}
          </div>

          {/* The strings, checked. */}
          <div
            className={clsx(
              "absolute right-4 top-4 flex flex-col items-end gap-1.5 transition-all duration-500",
              checked ? "opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            {DESIGNER.strings.map((s, i) => (
              <span
                key={s.letter}
                className="inline-flex items-center gap-2 rounded-full bg-[#0b0b0d]/85 px-3 py-1 text-[12px] text-white ring-1 ring-white/15 backdrop-blur"
              >
                <span className="size-2.5 rounded-full" style={{ background: STRING_TINT[i] }} />
                String {s.letter} · {s.panels} panels
                <Check className="size-3.5 text-[#34d399]" aria-hidden />
              </span>
            ))}
            <span className="text-[11px] text-white/60">{DESIGNER.checked}</span>
          </div>
          {backup && (
            <span className="live-in absolute left-4 top-4 hidden rounded-full bg-[#0b0b0d]/85 px-3 py-1 text-[11px] text-white ring-1 ring-white/15 sm:inline">
              {DESIGNER.battery}
            </span>
          )}

          {/* Sol's card, in the designer's own words. */}
          <div className="absolute bottom-4 right-4 w-[min(22rem,calc(100%-2rem))]">
            {card && (
              <div
                key={card}
                className="live-in rounded-2xl bg-[#26292f]/95 p-4 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur"
              >
                <div className="flex items-start gap-3">
                  <SolMark className="size-7 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sun-bright">{C[card].kind}</p>
                    <p className="mt-1 text-[14px] leading-snug">{C[card].words}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-200",
                          pressed ? "scale-95 bg-white text-ink" : "bg-sun-line text-white",
                          card === "next" && !pressed && live && "animate-pulse",
                        )}
                      >
                        {go}
                      </span>
                      {card === "backup" && (
                        <span className="rounded-full px-3 py-1.5 text-[12px] text-white/70 ring-1 ring-white/20">{C.backup.no}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* The words. */}
        <div className="order-1 lg:order-2">
          <BrandEyebrow>{DESIGNER.eyebrow}</BrandEyebrow>
          <h2 id="designer-head" className="mt-4 text-[clamp(40px,4.8vw,76px)] font-semibold leading-[0.95] tracking-[-0.05em]">
            {DESIGNER.headline}
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{DESIGNER.sub}</p>
          <ol className="mt-7 space-y-2">
            {DESIGNER.steps.map((s, i) => (
              <li
                key={s}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition-all duration-500",
                  live && i === step ? "bg-white font-medium text-ink shadow-sm ring-1 ring-line" : "text-ink-2",
                )}
              >
                <span className={clsx("font-mono text-[12px]", live && i === step ? "text-sun-line" : "text-muted")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
