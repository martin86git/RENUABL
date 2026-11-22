"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";

/**
 * The phone's top: the wordmark, the way back on a deal, and Search (22 Nov 2026, Martin: the wordmark scrolls away to
 * give the page the room, but "if someone screenshots and shares, I want the recipient to see the logo").
 * Once that row has scrolled out of view a slim bar fades in at the top of the screen with the wordmark small in its
 * middle, the way back on its left on a deal and Search on its right, so every screenshot carries RENUABL.
 */
export function PhoneTop({
  home,
  back,
  onSearch,
}: {
  home: string;
  /** On a deal: where the way back goes and what it says. */
  back?: { href: string; label: string };
  onSearch?: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = row.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([e]) => setGone(!e.isIntersecting), { threshold: 0 });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  return (
    <>
      <div ref={row} className="flex items-center gap-3 px-4 pb-1 pt-3 print:hidden lg:hidden">
        {back ? (
          // On a deal, the way back to Deals takes the wordmark's place (21 Nov 2026, Martin).
          <Link href={back.href} className="-ml-1 inline-flex h-9 items-center gap-1.5 pr-2 text-[15px] font-medium text-ink">
            <ArrowLeft className="size-[18px]" aria-hidden />
            {back.label}
          </Link>
        ) : (
          <Link href={home} aria-label="RENUABL, today">
            <Wordmark className="phone-wordmark text-[16px] transition-[font-size]" />
          </Link>
        )}
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search, or ask Sol"
            className="ml-auto flex size-9 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line"
          >
            <Search className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Once the row above has gone: the wordmark small, kept at the top of the screen. */}
      <div
        aria-hidden={!gone}
        inert={!gone}
        className={clsx(
          "phone-mini-top fixed inset-x-0 top-0 z-30 border-b border-line/70 bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-md transition duration-200 ease-out motion-reduce:transition-none print:hidden lg:hidden",
          gone ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <div className="relative flex h-9 items-center justify-center px-3">
          {back && (
            <Link
              href={back.href}
              aria-label={`Back to ${back.label}`}
              className="absolute left-2 flex size-8 items-center justify-center rounded-full text-ink"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          )}
          <Link href={home} aria-label="RENUABL, today">
            {/* Its own span: Wordmark's 20px would win over a size passed to it (cn only joins classes). */}
            <span className="select-none text-[11px] font-normal tracking-[0.34em] text-ink">RENUABL</span>
          </Link>
          {onSearch && (
            <button
              type="button"
              onClick={onSearch}
              aria-label="Search, or ask Sol"
              className="absolute right-2 flex size-8 items-center justify-center rounded-full text-ink"
            >
              <Search className="size-[15px]" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
