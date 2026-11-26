"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { FoldToTab } from "./minimise-mark";
import { afterMinimise, chipTitle, mayMinimise, minimisedGroup, withMinimised } from "@/lib/domain/design/minimised-pages";
import {
  MINIMISED_SCROLL_KEY,
  closeMinimised,
  openMinimised,
  readMinimised,
  useMinimised,
  writeMinimised,
} from "@/lib/services/minimised-pages";

/**
 * Pages put aside (26 Nov 2026, Martin: "the ability to minimise other pages too"): a minus at the top right of the pad
 * puts the page aside and goes back to the page before. Since 26 Nov 2026 (Martin: "the same as gmail tabs but on the left
 * hand top edge of the grey pad area, that way they can persist on every page") each page put aside is a tab standing on
 * the pad's top left edge on every page, named by its section and heading, and opens again where it was scrolled to. On a computer only (a phone has its foot bar). Mounted once in `DesignShell`.
 */
export function PageMinimise(props: { fallback: string }) {
  const path = usePathname();
  const router = useRouter();
  const list = useMinimised();
  const previous = useRef<string | null>(null);
  const current = useRef<string | null>(null);

  // Where the person was before this page, to go back to once it is put aside; and a page opened again from its chip
  // scrolled back to where it was left.
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    if (current.current && current.current !== here) previous.current = current.current;
    current.current = here;
    let pending: { path: string; y: number } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(MINIMISED_SCROLL_KEY) ?? "null");
    } catch {
      pending = null;
    }
    if (pending && pending.path === path) {
      sessionStorage.removeItem(MINIMISED_SCROLL_KEY);
      const y = pending.y;
      // After the page has drawn what it reads from the server.
      const t = window.setTimeout(() => window.scrollTo({ top: y }), 350);
      return () => window.clearTimeout(t);
    }
  }, [path]);

  const minimise = () => {
    const href = `${window.location.pathname}${window.location.search}`;
    const heading = document.querySelector("[data-sol-page] h1")?.textContent?.trim();
    writeMinimised(withMinimised(readMinimised(), { href, title: heading || props.fallback, scrollY: Math.round(window.scrollY) }));
    router.push(afterMinimise(href, previous.current));
  };

  // The page on show isn't a tab (it was opened another way).
  const tabs = [...list].reverse().filter((p) => p.href.split(/[?#]/)[0] !== path);

  return (
    <>
      {mayMinimise(path) && (
        <button
          type="button"
          onClick={minimise}
          title="Minimise: put this page aside as a tab on the top left of the pad"
          aria-label="Minimise this page"
          className="absolute right-[2.25rem] top-[1.25rem] z-20 hidden size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_14px_-8px_rgb(20_22_26_/_0.45)] ring-1 ring-line transition hover:bg-primary hover:text-white hover:ring-primary lg:flex lg:right-[4.25rem] lg:top-[2.75rem]"
        >
          <FoldToTab className="size-[22px]" />
        </button>
      )}
      {/* The tabs, as Gmail's minimised windows, on the pad's top left edge: the page on show isn't one of them. */}
      {tabs.length > 0 && (
        <nav
          aria-label="Minimised pages"
          className="no-scrollbar absolute left-[4.5rem] top-0 z-20 hidden h-9 max-w-[calc(50%-17rem)] items-end gap-1 overflow-x-auto lg:flex print:hidden"
        >
          {tabs.map((p) => (
            <span
              key={p.href}
              className="group flex h-8 shrink-0 items-center rounded-t-xl bg-canvas pl-3 pr-1 shadow-[0_-2px_8px_-6px_rgb(20_22_26_/_0.35)] ring-1 ring-line [clip-path:inset(-6px_-6px_0_-6px)] hover:bg-surface"
            >
              <button
                type="button"
                onClick={() => openMinimised(p, (href) => router.push(href))}
                title={`Open ${p.title} again`}
                className="flex max-w-[13rem] items-center gap-1.5 text-[12.5px] font-medium text-ink"
              >
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{minimisedGroup(p.href)}</span>
                <span className="truncate">{chipTitle(p.title)}</span>
              </button>
              <button
                type="button"
                onClick={() => closeMinimised(p.href)}
                aria-label={`Close ${p.title}`}
                className="ml-1 grid size-6 place-items-center rounded-full text-muted hover:bg-line/60 hover:text-ink"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </nav>
      )}
    </>
  );
}
