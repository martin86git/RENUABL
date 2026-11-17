"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Pause, Play } from "lucide-react";
import { RAY_CALL } from "@/lib/domain/design/sales-page";
import { Ray } from "./rays";

/**
 * A Ray on a call (17 Nov 2026, Martin: "add a real call clip"). The call as it's said: the Ray's face and its voice
 * moving while it talks, the clock, each line typed out as it's spoken, then what the call came to. Until a real
 * recording is supplied (`RAY_CALL.audio`) it's an example and says so; with one, Play plays it and the words run with it.
 */

const MS_PER_CHAR = 42;
const GAP_MS = 450;
const END_HOLD_MS = 3500;

/** When each line starts and ends on the call's clock, worked out once. */
const SCRIPT = (() => {
  let at = 600;
  const lines = RAY_CALL.lines.map((l) => {
    const from = at;
    const to = from + 500 + l.text.length * MS_PER_CHAR;
    at = to + GAP_MS;
    return { ...l, from, to };
  });
  return { lines, total: at };
})();

export function CallClip({ live }: { live: boolean }) {
  const { lines, total } = SCRIPT;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const loop = total + END_HOLD_MS;
  // Runs by itself while in view (words only); Play runs it with the recording when there is one.
  const running = (live && !RAY_CALL.audio) || playing;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setT((v) => {
        const next = v + 100;
        if (next >= loop) {
          if (playing) setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [running, loop, playing]);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [t]);

  const now = lines.find((l) => t >= l.from && t < l.to);
  const talking = now?.by === "ray";
  const done = t >= total;
  const shownT = live || playing ? t : total;
  const secs = Math.floor(Math.min(shownT, total) / 1000);

  const toggle = () => {
    const a = audio.current;
    if (playing) {
      a?.pause();
      setPlaying(false);
      return;
    }
    setT(0);
    if (a) {
      a.currentTime = 0;
      void a.play();
    }
    setPlaying(true);
  };

  return (
    <div className="rounded-[28px] bg-white/[0.06] p-5 ring-1 ring-white/10 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="shrink-0">
          <Ray i={1} size={44} live={talking} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sun-bright">{RAY_CALL.label}</p>
          <p className="truncate text-[15px] font-medium text-white">{RAY_CALL.title}</p>
          <p className="truncate text-[12px] text-white/50">{RAY_CALL.who}</p>
        </div>
        {/* The voice, moving while the Ray talks. */}
        <span className="hidden h-6 items-center gap-[3px] sm:flex" aria-hidden>
          {[0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.3].map((v, i) => (
            <span
              key={i}
              className={clsx("w-[3px] rounded-full bg-sun-line transition-opacity", talking ? "call-wave opacity-100" : "opacity-30")}
              style={{ height: `${v * 100}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-white/70">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
        {RAY_CALL.audio && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? RAY_CALL.pause : RAY_CALL.play}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-sun-line text-white hover:brightness-105"
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      <style>{`
        @keyframes call-wave { 0%,100% { transform: scaleY(0.45); } 50% { transform: scaleY(1.1); } }
        .call-wave { animation: call-wave 0.8s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) { .call-wave { animation: none; } }
      `}</style>

      {/* The words as they're said. */}
      <div ref={box} className="mt-4 h-[12.5rem] space-y-2 overflow-hidden" aria-live="polite">
        {lines.map((l, i) => {
          if (shownT < l.from) return null;
          const said = shownT >= l.to ? l.text : l.text.slice(0, Math.max(1, Math.floor((shownT - l.from) / MS_PER_CHAR)));
          const ray = l.by === "ray";
          return (
            <div key={i} className={clsx("flex", ray ? "justify-start" : "justify-end")}>
              <p
                className={clsx(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug",
                  ray ? "rounded-tl-md bg-white/[0.08] text-white" : "rounded-tr-md bg-white text-ink",
                )}
              >
                {said}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full bg-positive/15 px-3 py-1 text-[12px] font-medium text-[#5fe0a0] transition-opacity duration-500",
            done || !live ? "opacity-100" : "opacity-0",
          )}
        >
          <Check className="size-3.5" aria-hidden />
          {RAY_CALL.outcome}
        </span>
        <span className="text-[11px] text-white/45">{RAY_CALL.audio ? RAY_CALL.real : RAY_CALL.example}</span>
      </div>
      {RAY_CALL.audio && <audio ref={audio} src={RAY_CALL.audio} preload="none" onEnded={() => setPlaying(false)} />}
    </div>
  );
}
