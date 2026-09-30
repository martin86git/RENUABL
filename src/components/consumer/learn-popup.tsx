"use client";

import { ArrowRight, BookOpen, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { MascotAvatar } from "@/components/ui/brand-art";
import { REVO_PAGE_LINES } from "@/lib/domain/revo";
import { LEARN_NAME, LEARN_POPUP, guideBySlug, shouldShowLearnPopup, type Guide } from "@/lib/domain/guides";
import { closeLearnPopup, learnPopupClosedAt } from "@/lib/services/learn-popup";

const FEATURED = LEARN_POPUP.featured.map(guideBySlug).filter((g): g is Guide => Boolean(g));

/** Someone typing (their address, or anything else) isn't interrupted. */
function isTyping() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
  return [...document.querySelectorAll("input")].some((i) => i.type !== "hidden" && i.value.trim() !== "");
}

/**
 * Revo's pop-up on the home page introducing Learn with Revo. It waits a few
 * seconds, never interrupts typing, and once closed or used stays away for a week.
 */
export function LearnPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldShowLearnPopup(learnPopupClosedAt(), Date.now())) return;
    let t: number;
    const tryShow = () => {
      if (isTyping()) t = window.setTimeout(tryShow, 3000);
      else setOpen(true);
    };
    t = window.setTimeout(tryShow, LEARN_POPUP.delaySeconds * 1000);
    return () => window.clearTimeout(t);
  }, []);

  const close = () => {
    closeLearnPopup();
    setOpen(false);
  };

  // Revo's corner avatar; its speech bubble steps aside while the pop-up is open.
  const revo = <AskRenuabl context="home" variant="revo" page line={open ? "" : REVO_PAGE_LINES.home} />;
  if (!open) return revo;

  return (
    <>
      {revo}
      <section
        role="dialog"
        aria-labelledby="learn-popup-title"
        className="fixed inset-x-4 bottom-[84px] z-30 animate-fade-up rounded-[24px] bg-surface p-5 shadow-[var(--shadow-lift)] sm:left-auto sm:right-6 sm:w-[380px] lg:bottom-24"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 pr-8">
          <MascotAvatar className="h-11 w-11 shrink-0" />
          <div>
            <p className="flex items-center gap-1.5 text-[12.5px] text-forest">
              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} /> New to solar?
            </p>
            <h2 id="learn-popup-title" className="text-[20px] font-normal leading-tight tracking-[-0.02em]">
              {LEARN_NAME}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-snug text-ink-2">
          Plain-English guides to solar, batteries and rebates, so you know what you&apos;re buying.
        </p>
        <ul className="mt-3 space-y-1">
          {FEATURED.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/learn/${g.slug}`}
                onClick={closeLearnPopup}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14px] text-ink hover:bg-surface-2"
              >
                <span>{g.short ?? g.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/learn"
            onClick={closeLearnPopup}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] text-primary-ink"
          >
            See all guides <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <AskRenuabl context="home" variant="link" title="Or chat with me" />
        </div>
      </section>
    </>
  );
}
