"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Box = { top: number; left: number; width: number; height: number };

/** The first place matching that is on screen: a menu drawn twice (a rail on wide screens, a row on narrow) has one hidden. */
function shownAt(sel: string): Element | null {
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height) return el;
  }
  return null;
}

function boxOf(sel: string): Box | null {
  const r = shownAt(sel)?.getBoundingClientRect();
  return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}

/** A place on the page to light: `go` asks the page to show the view it is on first (Today's Chat or Feed). */
export type SpotlightStep = { what: string; now: string; at: string; go?: string };

/**
 * A spotlight tour: the page dimmed, one area lit with an orange ring, and a card beside it with Back, Next and Done.
 * Used by the welcome on Today, the tour of a first visit (welcome.ts `WELCOME_TOUR`). A step with `go` has the page
 * turn to its view (`onGo`) and waits for the place to appear (the feed loads its deals); a place that doesn't is passed
 * over in the direction of travel.
 */
export function Spotlight({
  steps: all,
  onEnd,
  onGo,
}: {
  steps: readonly SpotlightStep[];
  onEnd: () => void;
  onGo?: (go: string) => void;
}) {
  const [steps] = useState(() => all.filter((w) => (w.go && onGo) || boxOf(w.at)));
  const [n, setN] = useState(0);
  const dir = useRef(1);
  const [box, setBox] = useState<Box | null>(null);
  const [found, setFound] = useState(false);
  const step = steps[n];
  const measure = useCallback(() => setBox(step ? boxOf(step.at) : null), [step]);
  const go = useCallback(
    (to: number) => {
      dir.current = to < n ? -1 : 1;
      if (to >= steps.length) return onEnd();
      setN(Math.max(0, to));
    },
    [n, steps.length, onEnd],
  );
  useEffect(() => {
    if (!step) return;
    let gone = false;
    // A new step starts unlit until its place is found.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFound(false);
    setBox(null);
    if (step.go) onGo?.(step.go);
    const started = Date.now();
    let settle: ReturnType<typeof setTimeout> | undefined;
    // Wait for the place: a view just turned to, or deals still loading, take a moment.
    const look = setInterval(() => {
      if (gone) return;
      const el = shownAt(step.at);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width && r.height) {
        clearInterval(look);
        el.scrollIntoView({ block: r.height > window.innerHeight * 0.7 ? "start" : "center", behavior: "smooth" });
        settle = setTimeout(() => {
          if (gone) return;
          setFound(true);
          measure();
        }, 350);
      } else if (Date.now() - started > 2500) {
        clearInterval(look);
        const next = n + dir.current;
        if (next >= steps.length) onEnd();
        else if (next < 0) {
          dir.current = 1;
          setN(n + 1);
        } else setN(next);
      }
    }, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      gone = true;
      clearInterval(look);
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // onGo and onEnd are the page's; the step and its place are what start a look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, measure]);
  // The step on show is told to the page, so what floats over it (a deal's Sol sheet on a phone) can step aside while
  // another place is lit (23 Nov 2026, Martin: the Sol sheet covered the Design round the tour was pointing at).
  useEffect(() => {
    const root = document.documentElement;
    if (step) root.dataset.spotlight = step.at;
    return () => {
      delete root.dataset.spotlight;
    };
  }, [step]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
      if (e.key === "ArrowRight") go(n + 1);
      if (e.key === "ArrowLeft" && n > 0) go(n - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onEnd, go, n]);
  if (!step) return null;
  const pad = 8;
  const W = 320;
  const H = 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = box ? box.top + box.height + pad + 12 : vh / 2;
  const above = box ? box.top - pad - 12 - H : 0;
  const card = box
    ? {
        left: Math.max(16, Math.min(box.left, vw - W - 16)),
        // Under the place, else over it, else (a place taller than the screen) at the foot of the screen.
        top: below + H < vh ? below : above >= 16 ? above : vh - H - 16,
      }
    : { left: (vw - W) / 2, top: vh / 2 };
  return createPortal(
    <div className="theme-studio fixed inset-0 z-[100] !bg-transparent" role="dialog" aria-label="A look around">
      <div className="absolute inset-0" onClick={onEnd} />
      {box && found && (
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
      {!found && <div className="pointer-events-none absolute inset-0 bg-[rgba(11,11,12,0.55)]" />}
      {found && (
        <div className="absolute rounded-2xl bg-surface p-4 text-left shadow-xl ring-1 ring-line" style={{ ...card, width: W }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sun-ink">
            {n + 1} of {steps.length}
          </p>
          <p className="mt-1 text-sm text-ink">
            <span className="font-semibold">{step.what}</span> {step.now}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {n > 0 && (
              <button type="button" onClick={() => go(n - 1)} className="rounded-full px-3 py-1 text-sm text-ink-2 hover:text-ink">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(n + 1)}
              className="ml-auto rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink-2"
            >
              {n + 1 < steps.length ? "Next" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
