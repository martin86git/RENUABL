"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A note on Today about the new look (31 Oct 2026, as Primero's): one line, Show me around (a tour that dims the page
 * and rings each area in turn), Got it. Shown once a browser until it is closed, kept under `NEW_LOOK_KEY`; for the
 * next big change, write new steps under a new key so it shows again.
 */
const NEW_LOOK_KEY = "renuabl.design.new-look-2026-10-31";

/** Where each step lights; a step whose place isn't on screen (a phone, a narrow window) is passed over. */
const WHERE: { what: string; now: string; at: string }[] = [
  {
    what: "The menu down the left",
    now: "is gone. Today, CRM, Procurement, Installation and Service are across the top; each one's pages sit under it.",
    at: 'nav[aria-label="Sections"]',
  },
  {
    what: "Search",
    now: "is the round magnifier top right (or Ctrl K): a name, a phone number as it rings, an email or an address.",
    at: 'button[aria-label="Search, or ask Sol"]',
  },
  {
    what: "Top right",
    now: "has today's date and weather, and your profile: Settings, your account and signing out.",
    at: '[data-tour="icons"]',
  },
  {
    what: "The rail on the right",
    now: "has team chat, your notifications (customers' messages and mentions), email and the numbers.",
    at: ".sol-rail",
  },
  { what: "The pad", now: "is where each page sits. Today opens on what needs you now.", at: '[data-tour="pad"]' },
];

type Box = { top: number; left: number; width: number; height: number };

function boxOf(sel: string): Box | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}

/** The tour: the page dimmed, one area lit with an orange ring, and a card beside it with Back, Next and Done. */
function Tour({ onEnd }: { onEnd: () => void }) {
  const [steps] = useState(() => WHERE.filter((w) => boxOf(w.at)));
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

export function NewLook({ name }: { name?: string | null }) {
  const [show, setShow] = useState(false);
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    // Read once the page is in the browser (its storage is the browser's own).
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(NEW_LOOK_KEY)) setShow(true);
      } catch {
        setShow(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const done = () => {
    setShow(false);
    try {
      localStorage.setItem(NEW_LOOK_KEY, new Date().toISOString());
    } catch {
      // Private window: it shows again next time, nothing worse.
    }
  };
  return (
    <section className="relative mb-4 rounded-2xl bg-sun p-4 text-left ring-1 ring-sun-line/30 sm:p-5" aria-label="What's new">
      <button
        type="button"
        onClick={done}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full p-1 text-ink-2 hover:bg-white/70 hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
      <h2 className="pr-8 text-base font-semibold tracking-[-0.01em] text-ink">
        Hi{name ? ` ${name}` : ""}, RENUABL has a new look, and some things have a new home.
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTouring(true)}
          className="rounded-full bg-sun-line px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink"
        >
          Show me around
        </button>
        <button type="button" onClick={done} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink-2">
          Got it
        </button>
      </div>
      {touring && <Tour onEnd={() => setTouring(false)} />}
    </section>
  );
}
