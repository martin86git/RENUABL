"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** How far down the page before the round shows. */
const SHOW_FROM_PX = 600;

/**
 * Back to the top, on a phone (22 Nov 2026, Martin: "When scrolling down can a little back to top upward indicator sit
 * in the bottom right"). A small round over the foot bar's right end, shown once the page has scrolled well down; a press
 * glides to the top. It sits above a deal's Sol sheet when one is up, and steps aside while something is typed. It
 * stands above the foot bar's lip and its graphite ball (23 Nov 2026, Martin: it was "stuck behind the orb").
 */
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const read = () => setShown(window.scrollY > SHOW_FROM_PX);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  const toTop = () => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to the top"
      title="Back to the top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`back-to-top fixed right-4 z-30 grid size-11 place-items-center rounded-full bg-primary text-primary-ink shadow-lg ring-1 ring-black/5 transition duration-200 print:hidden lg:hidden ${
        shown ? "translate-y-0 opacity-90" : "pointer-events-none translate-y-3 opacity-0"
      }`}
      style={{ bottom: "calc(8.75rem + env(safe-area-inset-bottom) + var(--deal-sol-h, 0px))" }}
    >
      <ArrowUp className="size-5" strokeWidth={2.25} />
    </button>
  );
}
