"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { NUDGE_KIND_WORDS, type Nudge, type NudgeAction } from "@/lib/domain/design/sol-nudges";
import { BatteryWallPicture } from "./battery-wall-picture";

/**
 * Sol beside the design (10 Nov 2026, Martin; `sol-nudges.ts`): one thing at a time in a small dark bubble over Ask
 * Sol, what the design needs, the quote's questions, then options, each with its answer or action, ✕ to put it aside
 * for the visit, and › to look at the next. ‹ Back (19 Nov 2026, Martin: "move back to the previous sol question incase
 * i've changed my mind") undoes the last answer and asks that question again (`focus`); a counted line (RCBOs) asks
 * how many with its yes.
 */
export function SolNudges({
  nudges,
  onAct,
  onDismiss,
  onBack,
  focus,
  resume,
  className,
}: {
  nudges: Nudge[];
  onAct: (nudge: Nudge, action: NudgeAction, count?: number) => void;
  onDismiss: (id: string) => void;
  /** Undo the last answer, when there is one to undo. */
  onBack?: (() => void) | null;
  /** The question to show, once Back has brought it back. */
  focus?: { id: string; at: number } | null;
  /** On a design opened part way: what is there, over the first question (`leftOffWords`). */
  resume?: string | null;
  className?: string;
}) {
  const [at, setAt] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  if (focus && focus.at !== focused) {
    setFocused(focus.at);
    const k = nudges.findIndex((x) => x.id === focus.id);
    if (k >= 0) setAt(k);
  }
  if (!nudges.length) return null;
  const i = at % nudges.length;
  const n = nudges[i];
  if (seen !== n.id) {
    setSeen(n.id);
    setCount(null);
  }
  const howMany = count ?? n.count?.start ?? 1;
  return (
    <div
      role="status"
      data-popup
      className={clsx(
        "pointer-events-auto w-[min(46rem,calc(100%-2rem))] rounded-[22px] bg-primary px-3.5 py-2.5 text-white shadow-[0_14px_40px_rgba(11,11,12,0.35)] ring-1 ring-white/10 transition duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          {resume && <p className="mb-1.5 text-[12.5px] leading-snug text-white/75">{resume}</p>}
          {/* 22 Nov 2026, Martin: no "For the quote" over the question, only where it is in the run. */}
          {(n.kind !== "question" || nudges.length > 1) && (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/50">
              {[n.kind === "question" ? "" : NUDGE_KIND_WORDS[n.kind], nudges.length > 1 ? `${i + 1} of ${nudges.length}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mt-0.5 text-[13px] leading-snug text-white/95">{n.words}</p>
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
          {n.count && (
            <div className="mt-2 flex items-center gap-2 text-[12.5px] text-white/80">
              <span>{n.count.label}</span>
              <div className="flex items-center rounded-full ring-1 ring-white/25">
                <button
                  type="button"
                  aria-label={`Fewer ${n.count.label}`}
                  onClick={() => setCount(Math.max(1, howMany - 1))}
                  className="flex size-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <input
                  value={howMany}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, "").slice(0, 2));
                    setCount(v > 0 ? v : 1);
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  inputMode="numeric"
                  aria-label={`How many ${n.count.label}`}
                  className="w-8 bg-transparent text-center text-[13.5px] font-semibold tabular-nums text-white outline-none"
                />
                <button
                  type="button"
                  aria-label={`More ${n.count.label}`}
                  onClick={() => setCount(Math.min(99, howMany + 1))}
                  className="flex size-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          )}
          {n.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {n.actions.map((a, k) => (
                <button
                  key={a.act + k}
                  type="button"
                  onClick={() => onAct(n, a, n.count && (a.act === "line-on" || a.act === "line-v2") ? howMany : undefined)}
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to the last question"
              title="Back: change the last answer"
              className="flex size-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          )}
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
