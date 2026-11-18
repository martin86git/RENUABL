"use client";

import { useRef } from "react";
import { RAYS, VOICE_AGENTS } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { CallClip } from "./call-clip";
import { useInView, useMotionOk } from "./living-hero";
import { Ray, RayStyles } from "./rays";

/**
 * The voice agents' slide (18 Nov 2026, Martin: serious, not playful; the product's audio icons in a circle, a colour
 * for each role: sales, bookings, tech support). On black: the headline and one line, a card for each role with what it
 * does (Tech support marked coming soon), and the sales agent on a call beside them.
 */
export function RaysSlide() {
  const root = useRef<HTMLElement | null>(null);
  const seen = useInView(root);
  const live = useMotionOk() && seen;
  return (
    <section
      ref={root}
      id="rays"
      className="relative isolate overflow-hidden bg-[#050506] px-5 py-20 text-white snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8 lg:py-14"
      aria-labelledby="rays-head"
    >
      <RayStyles />
      <div
        aria-hidden
        className="absolute bottom-[-30%] left-1/2 -z-10 h-[40rem] w-[80rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,90,31,0.12), rgba(255,90,31,0))" }}
      />
      <div className="mx-auto grid w-full max-w-[84rem] items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div>
          <BrandEyebrow dark>{RAYS.eyebrow}</BrandEyebrow>
          <h2 id="rays-head" className="mt-5 text-[clamp(36px,4.2vw,66px)] font-semibold leading-[0.95] tracking-[-0.05em]">
            <span className="block">{RAYS.headline[0]}</span>
            <span className="block text-balance text-white/55">{RAYS.headline[1]}</span>
          </h2>
          <p className="mt-5 max-w-xl text-[clamp(16px,1.2vw,18px)] leading-relaxed text-white/75">{RAYS.body[0]}</p>

          {/* A card for each role. */}
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {VOICE_AGENTS.map((v, i) => (
              <li key={v.key} className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <Ray i={i} size={40} live={live} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold" style={{ color: v.colour }}>
                      {v.role}
                    </p>
                    {"soon" in v && v.soon && <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{RAYS.soon}</p>}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-white/70">
                  {v.does.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] text-white/45">{RAYS.note}</p>
        </div>
        <CallClip live={live} />
      </div>
    </section>
  );
}
