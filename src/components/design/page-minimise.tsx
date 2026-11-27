"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { tabWords, type SolTab } from "@/lib/domain/design/sol-tabs";
import { OPEN_SOL_TAB, dropTab, useSolTabs } from "@/lib/services/sol-tabs";
import { SolBadge } from "./sol-sun";
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
  const solTabs = useSolTabs();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!solTabs.length) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [solTabs.length]);
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
  // Sol's chats minimised on Today stand in the same row, first (26 Nov 2026, Martin).
  const openSol = (tab: SolTab) => {
    if (path === "/design") window.dispatchEvent(new CustomEvent(OPEN_SOL_TAB, { detail: tab.id }));
    else router.push(`/design?soltab=${encodeURIComponent(tab.id)}`);
  };

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
      {tabs.length + solTabs.length > 0 && (
        <nav
          aria-label="Minimised pages"
          className="no-scrollbar absolute left-[4.5rem] top-0 z-20 hidden h-9 max-w-[calc(50%-17rem)] items-end gap-1 overflow-x-auto lg:flex print:hidden"
        >
          {solTabs.map((t) => {
            const ready = t.status === "ready";
            return (
              <span
                key={t.id}
                className={`group flex h-8 shrink-0 items-center rounded-t-xl bg-canvas pl-2.5 pr-1 shadow-[0_-2px_8px_-6px_rgb(20_22_26_/_0.35)] [clip-path:inset(-6px_-6px_0_-6px)] hover:bg-surface ${ready ? "ring-[1.5px] ring-sun-line" : "ring-1 ring-line"}`}
              >
                <button
                  type="button"
                  onClick={() => openSol(t)}
                  title={`${t.title} · ${tabWords(t, now)}`}
                  className="flex max-w-[14rem] items-center gap-1.5 text-[12.5px] font-medium text-ink"
                >
                  {t.status === "writing" ? (
                    <Loader2
                      className="size-3.5 shrink-0 animate-spin text-sun-line motion-reduce:animate-none"
                      aria-label="Sol is writing"
                    />
                  ) : (
                    <SolBadge className="size-3.5 shrink-0" />
                  )}
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Sol</span>
                  <span className="truncate">{chipTitle(t.title)}</span>
                  {ready && <span className="size-2 shrink-0 rounded-full bg-sun-line" aria-label="Answer ready" />}
                </button>
                <button
                  type="button"
                  onClick={() => dropTab(t.id)}
                  aria-label={`Close ${t.title}`}
                  title="Close this tab (the chat stays in Sol's history)"
                  className="ml-1 grid size-6 place-items-center rounded-full text-muted hover:bg-line/60 hover:text-ink"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            );
          })}
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
