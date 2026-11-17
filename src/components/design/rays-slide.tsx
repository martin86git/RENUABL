"use client";

import { useRef } from "react";
import { RAYS } from "@/lib/domain/design/sales-page";
import { BrandEyebrow } from "./business-brand";
import { useInView, useMotionOk } from "./living-hero";
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
      className="relative isolate overflow-hidden bg-[#050506] px-5 py-20 text-white snap-start lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8"
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
            <h2 id="rays-head" className="mt-5 text-[clamp(40px,5vw,80px)] font-semibold leading-[0.95] tracking-[-0.05em]">
              <span className="block">{RAYS.headline[0]}</span>
              <span className="block text-white/55">{RAYS.headline[1]}</span>
            </h2>
          </div>
          <div className="space-y-4 text-[clamp(17px,1.4vw,21px)] leading-relaxed text-white/80 lg:pt-12">
            {RAYS.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        <ul className="mt-16 grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-4 lg:mt-20 lg:grid-cols-7">
          {RAYS.jobs.map((job, i) => (
            <li key={job} className="flex flex-col items-center text-center">
              <Ray i={i} size={112} look={look} live={live} className="max-w-full" />
              <p className="mt-4 text-[14px] font-medium text-white/85">{job}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-center text-[14px] text-white/50">{RAYS.note}</p>
      </div>
    </section>
  );
}
