"use client";

import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { WALKTHROUGH_NOTE, lengthWords } from "@/lib/domain/design/walkthrough";
import { proposalWalkthrough } from "@/lib/services/walkthrough";

/**
 * The recorded walkthrough of their design, at the top of the customer's proposal (walkthrough.ts): the business
 * talking them through it, with the subtitles Sol wrote. Nothing shows when there is none.
 */
export function WalkthroughPlayer({ token, business }: { token: string; business: string }) {
  const [walkthrough, setWalkthrough] = useState<{ id: string; seconds: number } | null>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    let gone = false;
    void proposalWalkthrough(token).then((w) => {
      if (!gone) setWalkthrough(w);
    });
    return () => {
      gone = true;
    };
  }, [token]);
  if (!walkthrough) return null;
  const base = `/api/proposal/${encodeURIComponent(token)}/walkthrough`;
  return (
    <figure className="overflow-hidden rounded-[18px] bg-ink">
      {started ? (
        <video src={`${base}/video`} controls autoPlay playsInline className="aspect-video w-full bg-ink">
          <track kind="captions" src={`${base}?vtt=1&v=${walkthrough.id}`} srcLang="en" label="Subtitles" default />
        </video>
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="group flex aspect-video w-full flex-col items-center justify-center gap-3 text-white"
          aria-label={`Watch ${business} walk you through your design`}
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-ink)] shadow-lg transition group-hover:scale-105">
            <Play className="ml-1 size-7 fill-current" aria-hidden />
          </span>
          <span className="text-[15px] font-medium">Watch {business} walk you through your design</span>
          <span className="text-[13px] text-white/70">{lengthWords(walkthrough.seconds)}</span>
        </button>
      )}
      <figcaption className="bg-surface px-4 py-2.5 text-[12px] text-muted">{WALKTHROUGH_NOTE}</figcaption>
    </figure>
  );
}
