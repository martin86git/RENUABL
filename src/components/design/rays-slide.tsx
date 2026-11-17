"use client";

import { useRef } from "react";
import { RAYS } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { useInView, useMotionOk } from "./living-hero";
import { CallClip } from "./call-clip";
import { Ray, RayStyles, useLook } from "./rays";

/**
 * The Rays' slide (17 Nov 2026, Martin, after xAI's Grok Bots: "make sol and the voice ai feel like the army you wished
 * you always had"). On black: the headline on the left, what Rays do on the right, then the whole crew across the page,
 * each with its job under it, glancing at the pointer.
 */
export function RaysSlide() {
  const root = useRef<HTMLElement | null>(null);
  const seen = useInView(root);
  const live = useMotionOk() && seen;
  const look = useLook(root, live);
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
        style={{ background: "radial-gradient(closest-side, rgba(255,122,47,0.16), rgba(255,122,47,0))" }}
      />
      <div className="mx-auto w-full max-w-[84rem]">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <BrandEyebrow dark>{RAYS.eyebrow}</BrandEyebrow>
            <h2 id="rays-head" className="mt-5 text-[clamp(36px,4.2vw,66px)] font-semibold leading-[0.95] tracking-[-0.05em]">
              <span className="block">{RAYS.headline[0]}</span>
              <span className="block text-balance text-white/55">{RAYS.headline[1]}</span>
            </h2>
          </div>
          <div className="space-y-4 text-[clamp(16px,1.25vw,19px)] leading-relaxed text-white/80 lg:pt-10">
            {RAYS.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        {/* The crew, and one of them on a call (17 Nov 2026, Martin: calmer, and a call to hear). */}
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4">
              {RAYS.jobs.map((job, i) => (
                <li key={job} className="flex flex-col items-center text-center">
                  <Ray i={i} size={84} look={look} live={live} className="max-w-full" />
                  <p className="mt-3 text-[13px] font-medium text-white/85">{job}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-[13px] text-white/50">{RAYS.note}</p>
          </div>
          <CallClip live={live} />
        </div>
      </div>
    </section>
  );
}
