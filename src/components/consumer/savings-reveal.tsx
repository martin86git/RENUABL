"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useSystem } from "@/components/consumer/flow-state";
import { Toggle } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/domain/format";
import { SAVINGS_PREVIEW, savingsPreview, type SavingsPreview } from "@/lib/domain/savings-preview";

/** Counts up from 0 on mount (straight to the figure for people who prefer less motion). */
function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = instant ? 1 : Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** Straight after the bill is read: "See how much I could save", then a first estimate. */
export function SavingsReveal() {
  const { recommendation } = useSystem();
  const preview = savingsPreview(recommendation);
  const [on, setOn] = useState(false);
  if (!preview) return null;

  return (
    <div className="rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-[15px] text-ink">
          <Sparkles className="h-4 w-4 text-sun-ink" strokeWidth={1.8} aria-hidden /> {SAVINGS_PREVIEW.toggle}
        </span>
        <Toggle checked={on} onChange={setOn} label={SAVINGS_PREVIEW.toggle} />
      </label>
      {on && <SavingsFigures preview={preview} />}
    </div>
  );
}

/** Mounted when the switch goes on, so the count-up and the bars play each time. */
function SavingsFigures({ preview }: { preview: SavingsPreview }) {
  const low = useCountUp(preview.low);
  const high = useCountUp(preview.high);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGrown(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const single = preview.low === preview.high;

  return (
    <div className="mt-4 border-t border-line pt-4" aria-live="polite">
      <p className="text-[13px] text-muted">{SAVINGS_PREVIEW.heading}</p>
      <p className="mt-1 text-[34px] font-normal leading-none tracking-[-0.03em] text-positive tabular-nums">
        {single ? formatCurrency(high) : `${formatCurrency(low)}–${formatCurrency(high)}`}
        <span className="ml-2 text-[15px] tracking-normal text-muted">{SAVINGS_PREVIEW.perYear}</span>
      </p>
      <ul className="mt-4 space-y-3">
        {preview.bars.map((b) => (
          <li key={b.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-ink-2">{b.label}</span>
              <span className="text-ink tabular-nums">{formatCurrency(b.amount)}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-positive transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: grown ? `${Math.max(6, (b.amount / preview.high) * 100)}%` : "0%" }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12.5px] leading-snug text-muted">{SAVINGS_PREVIEW.note}</p>
    </div>
  );
}
