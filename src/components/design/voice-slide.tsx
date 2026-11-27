"use client";

import { useRef } from "react";
import { VOICE_AGENTS, VOICE_INTRO, voiceIntroPrice } from "@/lib/domain/design/sales-page";
import { TryDemoButton } from "./business-demo";
import { useInView, useMotionOk } from "./living-hero";
import { Ray, RayStyles } from "./rays";

/**
 * The voice agents' opening slide (26 Nov 2026, Martin: a slide like a voice-agent builder's landing page, to talk about
 * our Voice AI). On black and centred: a pill with the agents' own sound wave, one large headline, one line, Start demo
 * (Hear a call was removed 27 Nov 2026, Martin), then a quiet row of what an agent does where such a page would show
 * its customers' logos. Copy in `VOICE_INTRO`.
 */
export function VoiceSlide({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement | null>(null);
  const seen = useInView(root);
  const live = useMotionOk() && seen;
  return (
    <section
      ref={root}
      id="voice"
      className="relative isolate snap-start overflow-hidden bg-[#050506] px-5 pb-28 pt-24 text-center text-white lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-center lg:px-8 lg:pb-24 lg:pt-14"
      aria-labelledby="voice-head"
    >
      <RayStyles />
      <div
        aria-hidden
        className="absolute left-1/2 top-[-35%] -z-10 h-[44rem] w-[80rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,90,31,0.14), rgba(255,90,31,0))" }}
      />
      <div className="mx-auto w-full max-w-[72rem]">
        <p className="inline-flex items-center gap-2.5 rounded-full bg-white/[0.06] py-1.5 pl-1.5 pr-4 text-[13px] font-medium text-white/75 ring-1 ring-white/10">
          <Ray i={0} size={26} live={live} />
          {VOICE_INTRO.pill}
        </p>
        <h2 id="voice-head" className="mt-7 text-[clamp(40px,6.4vw,104px)] font-semibold leading-[0.95] tracking-[-0.05em]">
          <span className="block">{VOICE_INTRO.headline[0]}</span>
          <span className="block text-sun-line">{VOICE_INTRO.headline[1]}</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-[clamp(16px,1.35vw,20px)] leading-relaxed text-white/70">
          {VOICE_INTRO.sub}
        </p>
        {!signedIn && (
          <div className="mt-9 flex justify-center">
            <TryDemoButton look="main" label={VOICE_INTRO.demo} />
          </div>
        )}
        <p className="mt-5 text-[13px] text-white/45">{voiceIntroPrice()}</p>

        {/* Where a page like this shows logos: what an agent does, each with a role's own wave. */}
        <ul className="mx-auto mt-16 flex max-w-5xl flex-wrap items-center justify-center gap-x-7 gap-y-3 border-t border-white/10 pt-8 lg:mt-16">
          {VOICE_INTRO.does.map((d, i) => (
            <li key={d} className="inline-flex items-center gap-2 text-[13px] font-medium text-white/55">
              <Ray i={i % (VOICE_AGENTS.length - 1)} size={22} />
              {d}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
