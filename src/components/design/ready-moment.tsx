"use client";

import { useEffect } from "react";
import { READY_MOMENT_MS } from "@/lib/domain/design/readiness";

/**
 * The moment a design turns Ready to install (26 Nov 2026, Martin: "i like the idea of a message like this appearing
 * when a design is complete"): a graphite card over the roof picture, the light going green, what was checked, then it
 * goes by itself. A press, or Escape, puts it away sooner. Still with reduced motion (`.ready-moment` in globals.css).
 */
export function ReadyMoment({ passed, toCheck, onDone }: { passed: string; toCheck: string | null; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, READY_MOMENT_MS);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", key);
    };
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      data-ready-moment
      aria-label="Ready to install. Close"
      className="ready-moment absolute left-1/2 top-1/2 z-50 flex w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-[#1d1e22] px-7 py-6 text-left shadow-2xl ring-1 ring-white/10 sm:px-9 sm:py-8"
    >
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
        <span className="ready-moment-dot size-1.5 rounded-full" aria-hidden />
        Designer // Checks
      </span>
      <span className="mt-6 text-[17px] text-white/50 sm:text-xl">The light just went green:</span>
      <span className="ready-moment-title mt-1 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
        Ready to install.
      </span>
      <span role="status" className="mt-5 text-sm text-white sm:text-base">
        {passed}
        {toCheck && <span className="text-white/55"> {toCheck}</span>}
      </span>
      <span className="mt-7 flex items-end justify-between gap-4">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">A guide, never a site inspection.</span>
        <span className="select-none text-[12px] tracking-[0.28em] text-white/80" aria-hidden>
          RENUABL
        </span>
      </span>
    </button>
  );
}
