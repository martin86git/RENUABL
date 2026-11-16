"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Box = { top: number; left: number; width: number; height: number };

function boxOf(sel: string): Box | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}

/**
 * A spotlight tour: the page dimmed, one area lit with an orange ring, and a card beside it with Back, Next and Done.
 * Used by the welcome on Today, the tour of a first visit (welcome.ts `WELCOME_TOUR`).
 */
export function Spotlight({ steps: all, onEnd }: { steps: readonly { what: string; now: string; at: string }[]; onEnd: () => void }) {
  const [steps] = useState(() => all.filter((w) => boxOf(w.at)));
  const [n, setN] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[n];
  const measure = useCallback(() => setBox(step ? boxOf(step.at) : null), [step]);
  useEffect(() => {
    if (!step) return;
    document.querySelector(step.at)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
      if (e.key === "ArrowRight") setN((v) => Math.min(v + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setN((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onEnd, steps.length]);
  if (!step) return null;
  const pad = 8;
  const W = 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = box ? box.top + box.height + pad + 12 : vh / 2;
  const card = box
    ? { left: Math.max(16, Math.min(box.left, vw - W - 16)), top: below + 200 < vh ? below : Math.max(16, box.top - pad - 12 - 200) }
    : { left: (vw - W) / 2, top: vh / 2 };
  return createPortal(
    <div className="theme-studio fixed inset-0 z-[100] !bg-transparent" role="dialog" aria-label="A look around">
      <div className="absolute inset-0" onClick={onEnd} />
      {box && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-sun-line transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(11,11,12,0.55)",
          }}
        />
      )}
      <div className="absolute rounded-2xl bg-surface p-4 text-left shadow-xl ring-1 ring-line" style={{ ...card, width: W }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sun-ink">
          {n + 1} of {steps.length}
        </p>
        <p className="mt-1 text-sm text-ink">
          <span className="font-semibold">{step.what}</span> {step.now}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {n > 0 && (
            <button type="button" onClick={() => setN(n - 1)} className="rounded-full px-3 py-1 text-sm text-ink-2 hover:text-ink">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (n + 1 < steps.length ? setN(n + 1) : onEnd())}
            className="ml-auto rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink-2"
          >
            {n + 1 < steps.length ? "Next" : "Done"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
