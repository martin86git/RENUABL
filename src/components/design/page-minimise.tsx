"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { FoldToTab } from "./minimise-mark";
import {
  MINIMISED_KEY,
  afterMinimise,
  chipTitle,
  cleanMinimised,
  mayMinimise,
  withMinimised,
  withoutMinimised,
  type MinimisedPage,
} from "@/lib/domain/design/minimised-pages";

const CHANGED = "renuabl:minimised";
const SCROLL_KEY = "renuabl.design.minimised-scroll";

function read(): MinimisedPage[] {
  try {
    return cleanMinimised(JSON.parse(sessionStorage.getItem(MINIMISED_KEY) ?? "[]"));
  } catch {
    return [];
  }
}
function write(list: MinimisedPage[]) {
  try {
    sessionStorage.setItem(MINIMISED_KEY, JSON.stringify(list));
  } catch {
    // Without storage the page is still put aside for this view.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * Pages put aside (26 Nov 2026, Martin: "the ability to minimise other pages too"): a minus at the top right of the pad
 * puts the page into a chip at the foot of the screen and goes back to the page before; the chip opens it again where it
 * was scrolled to. On a computer only (a phone has its foot bar). Mounted once in `DesignShell`.
 */
export function PageMinimise(props: { fallback: string }) {
  const path = usePathname();
  const router = useRouter();
  const [list, setList] = useState<MinimisedPage[]>([]);
  const previous = useRef<string | null>(null);
  const current = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setList(read());
    // The tab's list, read once in the browser (so the chips are drawn only there).
    sync();
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  // Where the person was before this page, to go back to once it is put aside; and a page opened again from its chip
  // scrolled back to where it was left.
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    if (current.current && current.current !== here) previous.current = current.current;
    current.current = here;
    let pending: { path: string; y: number } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null");
    } catch {
      pending = null;
    }
    if (pending && pending.path === path) {
      sessionStorage.removeItem(SCROLL_KEY);
      const y = pending.y;
      // After the page has drawn what it reads from the server.
      const t = window.setTimeout(() => window.scrollTo({ top: y }), 350);
      return () => window.clearTimeout(t);
    }
  }, [path]);

  const minimise = () => {
    const href = `${window.location.pathname}${window.location.search}`;
    const heading = document.querySelector("[data-sol-page] h1")?.textContent?.trim();
    write(withMinimised(read(), { href, title: heading || props.fallback, scrollY: Math.round(window.scrollY) }));
    router.push(afterMinimise(href, previous.current));
  };

  const open = (p: MinimisedPage) => {
    write(withoutMinimised(read(), p.href));
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ path: p.href.split(/[?#]/)[0], y: p.scrollY }));
    } catch {
      // Opens at its top without storage.
    }
    router.push(p.href);
  };

  // The page on show isn't shown as a chip (it was opened another way).
  const chips = list.filter((p) => p.href.split(/[?#]/)[0] !== path);

  return (
    <>
      {mayMinimise(path) && (
        <button
          type="button"
          onClick={minimise}
          title="Minimise: put this page aside as a tab at the foot of the screen"
          aria-label="Minimise this page"
          className="absolute right-[2.25rem] top-[1.25rem] z-20 hidden size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_14px_-8px_rgb(20_22_26_/_0.45)] ring-1 ring-line transition hover:bg-primary hover:text-white hover:ring-primary lg:flex lg:right-[4.25rem] lg:top-[2.75rem]"
        >
          <FoldToTab className="size-[22px]" />
        </button>
      )}
      {chips.length > 0 &&
        createPortal(
          <div className="theme-studio contents">
            <nav
              aria-label="Minimised pages"
              className="fixed bottom-4 left-1/2 z-40 hidden max-w-[calc(100vw-30rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-surface/90 p-1.5 shadow-[0_10px_30px_rgba(11,11,12,0.14)] ring-1 ring-line backdrop-blur [scrollbar-width:none] lg:flex print:hidden"
            >
              {chips.map((p) => (
                <span key={p.href} className="flex shrink-0 items-center rounded-full bg-canvas ring-1 ring-line">
                  <button
                    type="button"
                    onClick={() => open(p)}
                    title={`Open ${p.title} again`}
                    className="max-w-[14rem] truncate py-1.5 pl-3.5 pr-1.5 text-[12.5px] font-medium text-ink hover:text-sun-line"
                  >
                    {chipTitle(p.title)}
                  </button>
                  <button
                    type="button"
                    onClick={() => write(withoutMinimised(read(), p.href))}
                    aria-label={`Close ${p.title}`}
                    className="mr-1 flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
