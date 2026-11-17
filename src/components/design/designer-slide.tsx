"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { DESIGNER } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { LiveStyles, useMotionOk } from "./living-hero";
import { SolMark } from "./sol-icon";

/**
 * The assisted designer (17 Nov 2026, Martin: the page was missing the designer, "asking for confirmations and whether
 * to string, and then showing the stringing done, then with a card saying move on to quote"). A drawn roof with the
 * panels laid; Sol's cards come up one at a time in the designer's own words (`sol-nudges.ts`), each pressed, the
 * panels strung into A and B, each string checked, then the next step to the quote. Still with reduced motion.
 */

const LOOP = 15000;
const ROWS = 3;
const PER_ROW = 7;
/** The panels in the order a string runs: along the first row, back along the second, along the third. */
const SNAKE = Array.from({ length: ROWS * PER_ROW }, (_, k) => {
  const row = Math.floor(k / PER_ROW);
  const col = k % PER_ROW;
  return { row, col: row % 2 === 0 ? col : PER_ROW - 1 - col };
});
const PANEL = { w: 34, h: 50, gap: 4, x0: 188, y0: 118 };
const centre = (p: { row: number; col: number }) => ({
  x: PANEL.x0 + p.col * (PANEL.w + PANEL.gap) + PANEL.w / 2,
  y: PANEL.y0 + p.row * (PANEL.h + PANEL.gap) + PANEL.h / 2,
});
const STRING_TINT = ["#f472b6", "#34d399"];

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
  const aCount = DESIGNER.strings[0].panels;
  const strung = Math.max(0, Math.min(SNAKE.length, Math.floor(((t - 6200) / 1800) * SNAKE.length)));
  const card = t < 900 ? null : t < 4300 ? "backup" : t < 7200 ? "strings" : t < 8700 ? null : "next";
  const pressed = (card === "backup" && t >= 2800) || (card === "strings" && t >= 5800) || (card === "next" && t >= 12600);
  const backup = t >= 3000;
  const checked = t >= 8200;
  const step = t < 4300 ? 0 : t < 8000 ? 1 : t < 8700 ? 2 : 3;
  const wire = SNAKE.slice(0, strung).map(centre);
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
          <svg viewBox="0 0 640 400" className="block h-auto w-full" role="img" aria-label={DESIGNER.headline}>
            <defs>
              <pattern id="designer-lawn" width="6" height="6" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="#3a4a35" />
                <circle cx="2" cy="2" r="0.8" fill="#46583f" />
              </pattern>
            </defs>
            <rect width="640" height="400" fill="url(#designer-lawn)" />
            <rect x="0" y="356" width="640" height="44" fill="#4a4d52" />
            {/* A hip roof from above. */}
            <polygon points="140,80 500,80 552,300 88,300" fill="#5d636c" />
            <polygon points="140,80 500,80 440,190 200,190" fill="#6b727c" />
            <line x1="200" y1="190" x2="440" y2="190" stroke="#7c848f" strokeWidth="2" />
            <line x1="140" y1="80" x2="200" y2="190" stroke="#7c848f" strokeWidth="1.5" />
            <line x1="500" y1="80" x2="440" y2="190" stroke="#7c848f" strokeWidth="1.5" />
            <line x1="88" y1="300" x2="200" y2="190" stroke="#7c848f" strokeWidth="1.5" />
            <line x1="552" y1="300" x2="440" y2="190" stroke="#7c848f" strokeWidth="1.5" />
            {/* The panels, strung as they go. */}
            {SNAKE.map((p, k) => {
              const at = centre(p);
              const on = !live || t >= 200 + p.row * 280;
              const isStrung = k < strung;
              return (
                <rect
                  key={k}
                  x={at.x - PANEL.w / 2}
                  y={at.y - PANEL.h / 2}
                  width={PANEL.w}
                  height={PANEL.h}
                  rx="2"
                  fill={isStrung ? STRING_TINT[k < aCount ? 0 : 1] : "#1a2230"}
                  fillOpacity={isStrung ? 0.88 : 1}
                  stroke={isStrung ? "#ffffff" : "#8b95a5"}
                  strokeOpacity={isStrung ? 0.75 : 0.55}
                  strokeWidth="1"
                  style={{ opacity: on ? 1 : 0, transition: "opacity 400ms, fill 250ms" }}
                />
              );
            })}
            {wire.length > 1 && (
              <polyline
                points={wire.map((w) => `${w.x},${w.y}`).join(" ")}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeDasharray="4 3"
                strokeOpacity="0.85"
              />
            )}
            {checked &&
              DESIGNER.strings.map((s, i) => {
                const first = centre(SNAKE[i === 0 ? 0 : aCount]);
                return (
                  <g key={s.letter}>
                    <circle cx={first.x} cy={first.y} r="11" fill="#0b0b0d" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={first.x} y={first.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
                      {s.letter}
                    </text>
                  </g>
                );
              })}
            {/* The kit on the wall. */}
            <g transform="translate(470 318)">
              <rect width="36" height="26" rx="4" fill="#0b0b0d" stroke="#ff5a1f" strokeWidth="1.5" />
              <text x="18" y="17" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
                INV
              </text>
            </g>
            <g transform="translate(512 318)" style={{ opacity: backup ? 1 : 0, transition: "opacity 500ms" }}>
              <rect width="36" height="26" rx="4" fill="#0b0b0d" stroke="#ff5a1f" strokeWidth="1.5" />
              <text x="18" y="17" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
                BAT
              </text>
            </g>
          </svg>

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
            <span className="absolute bottom-4 right-4 hidden rounded-full bg-[#0b0b0d]/85 px-3 py-1 text-[11px] text-white ring-1 ring-white/15 sm:inline">
              {DESIGNER.battery}
            </span>
          )}

          {/* Sol's card, in the designer's own words. */}
          <div className="absolute bottom-4 left-4 w-[min(22rem,calc(100%-2rem))]">
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
