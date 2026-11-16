"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { WALKTHROUGH_NOTE, lengthWords } from "@/lib/domain/design/walkthrough";
import { proposalWalkthrough } from "@/lib/services/walkthrough";

/** The speeds the customer can watch at (16 Nov 2026, Martin: as on YouTube, 1x, 1.5x and so on). */
const SPEEDS = [1, 1.25, 1.5, 2] as const;

/**
 * The recorded walkthrough of their design, at the top of the customer's proposal (walkthrough.ts): the business
 * talking them through it, with the subtitles Sol wrote. Nothing shows when there is none.
 */
export function WalkthroughPlayer({ token, business }: { token: string; business: string }) {
  const [walkthrough, setWalkthrough] = useState<{ id: string; seconds: number } | null>(null);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const video = useRef<HTMLVideoElement>(null);
  // The speed holds as the video plays on (a browser may put it back when it loads).
  useEffect(() => {
    if (video.current) video.current.playbackRate = speed;
  }, [speed, started]);
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
        <>
          <video
            ref={video}
            src={`${base}/video`}
            controls
            autoPlay
            playsInline
            onLoadedMetadata={(e) => (e.currentTarget.playbackRate = speed)}
            className="aspect-video w-full bg-ink"
          >
            <track kind="captions" src={`${base}?vtt=1&v=${walkthrough.id}`} srcLang="en" label="Subtitles" default />
          </video>
          <div className="flex items-center justify-end gap-1 bg-ink px-3 py-2" role="group" aria-label="Playback speed">
            <span className="mr-1 text-[12px] text-white/60">Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={clsx(
                  "min-h-8 rounded-full px-2.5 text-[12px] font-medium tabular-nums transition",
                  speed === s ? "bg-white text-ink" : "text-white/80 ring-1 ring-white/25 hover:bg-white/10",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </>
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
