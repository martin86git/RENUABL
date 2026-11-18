"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { INTERFACE } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { useInView, useMotionOk } from "./living-hero";

/** How long each screen stays before the next, ms (18 Nov 2026, Martin: 1.5 seconds a slide). */
const HOLD_MS = 1500;

/**
 * The interface (17 Nov 2026, Martin: "one slide that allows the user to see what the actual interface looks like").
 * Real screens of the product, large in a browser window: Today, Deals, the designer, a proposal, installs and service.
 * They carousel by themselves while the slide is in view (18 Nov 2026, Martin: no clicking through, no film), the name of
 * the one on show lit above the window with a bar filling as it waits.
 */
export function InterfaceSlide() {
  const root = useRef<HTMLElement | null>(null);
  const seen = useInView(root);
  const motion = useMotionOk();
  const [at, setAt] = useState(0);
  const screens = INTERFACE.screens;
  const playing = motion && seen;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setAt((n) => (n + 1) % screens.length), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [playing, at, screens.length]);

  return (
    <section
      ref={root}
      id="interface"
      className="relative isolate overflow-hidden bg-canvas px-5 py-8 snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8"
      aria-labelledby="interface-head"
    >
      <style>{"@keyframes ui-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>
      <div className="mx-auto w-full max-w-[76rem]">
        <div className="text-center">
          <BrandEyebrow>{INTERFACE.eyebrow}</BrandEyebrow>
          <h2 id="interface-head" className="mt-3 text-[clamp(30px,3.4vw,52px)] font-semibold leading-[1] tracking-[-0.045em]">
            {INTERFACE.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-2">{INTERFACE.sub}</p>
        </div>

        {/* Which screen is on show: names, not buttons. */}
        <div className="mt-6 flex flex-wrap justify-center gap-1.5" aria-hidden>
          {screens.map((s, i) => (
            <span
              key={s.key}
              className={clsx(
                "relative overflow-hidden rounded-full px-4 py-2 text-[14px] font-medium transition-colors duration-300",
                i === at ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line",
              )}
            >
              {s.label}
              {i === at && playing && (
                <span
                  key={at}
                  aria-hidden
                  className="absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-sun-line"
                  style={{ animation: `ui-fill ${HOLD_MS}ms linear forwards` }}
                />
              )}
            </span>
          ))}
        </div>

        {/* The window, its screen on top. */}
        <div
          style={{ maxWidth: "min(100%, calc((100dvh - 25rem) * 1.6))" }}
          className="mx-auto mt-6 w-full overflow-hidden rounded-2xl bg-surface shadow-[0_40px_90px_-40px_rgba(11,11,12,0.5)] ring-1 ring-line"
        >
          <div className="flex h-8 items-center gap-1.5 border-b border-line bg-surface-2 px-3" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="mx-auto rounded-full bg-black/[0.05] px-6 py-0.5 text-[11px] text-black/45">renuabl.com.au</span>
          </div>
          <div className="relative aspect-[16/10] w-full bg-canvas">
            {screens.map((s, i) => (
              <div
                key={s.key}
                aria-hidden={i !== at}
                className={clsx("absolute inset-0 transition-opacity duration-500", i === at ? "opacity-100" : "opacity-0")}
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  fill
                  sizes="(min-width: 1024px) 1200px, 100vw"
                  className="object-cover object-top"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
