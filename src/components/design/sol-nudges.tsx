"use client";

import clsx from "clsx";
import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { NUDGE_KIND_WORDS, type Nudge, type NudgeAction } from "@/lib/domain/design/sol-nudges";
import { BatteryWallPicture } from "./battery-wall-picture";
import { SolIcon } from "./sol-icon";

/**
 * Sol beside the design (10 Nov 2026, Martin; `sol-nudges.ts`): one thing at a time in a small dark bubble over Ask
 * Sol, what the design needs, the quote's questions, then options, each with its answer or action, ✕ to put it aside
 * for the visit, and › to look at the next.
 */
export function SolNudges({
  nudges,
  onAct,
  onDismiss,
  className,
}: {
  nudges: Nudge[];
  onAct: (nudge: Nudge, action: NudgeAction) => void;
  onDismiss: (id: string) => void;
  className?: string;
}) {
  const [at, setAt] = useState(0);
  if (!nudges.length) return null;
  const i = at % nudges.length;
  const n = nudges[i];
  return (
    <div
      role="status"
      data-popup
      className={clsx(
        "pointer-events-auto w-[min(30rem,calc(100%-2rem))] rounded-[22px] bg-primary px-3.5 py-3 text-white shadow-[0_14px_40px_rgba(11,11,12,0.35)] ring-1 ring-white/10 transition duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <SolIcon className="mt-0.5 size-4 shrink-0 text-sun-line" />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/50">
            {NUDGE_KIND_WORDS[n.kind]}
            {nudges.length > 1 && ` · ${i + 1} of ${nudges.length}`}
          </p>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mt-0.5 text-[14px] leading-snug text-white/95">{n.words}</p>
              {n.why && <p className="mt-0.5 text-[12px] leading-snug text-white/55">{n.why}</p>}
            </div>
            {n.picture && <BatteryWallPicture kind={n.picture} />}
          </div>
          {n.options && n.options.length > 0 && (
            <>
              <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/50">Your options</p>
              <ul className="mt-1 space-y-1">
                {n.options.map((o) => (
                  <li key={o} className="flex gap-2 text-[12.5px] leading-snug text-white/85">
                    <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-sun-line" />
                    {o}
                  </li>
                ))}
              </ul>
            </>
          )}
          {n.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {n.actions.map((a, k) => (
                <button
                  key={a.act + k}
                  type="button"
                  onClick={() => onAct(n, a)}
                  className={clsx(
                    "rounded-full px-3 py-1 text-[12.5px] font-medium",
                    k === 0 ? "bg-sun-line text-white hover:brightness-110" : "text-white/85 ring-1 ring-white/25 hover:bg-white/10",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {nudges.length > 1 && (
            <button
              type="button"
              onClick={() => setAt(i + 1)}
              aria-label="Sol's next suggestion"
              title="Next"
              className="flex size-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(n.id)}
            aria-label="Put this aside"
            title="Put this aside"
            className="flex size-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
