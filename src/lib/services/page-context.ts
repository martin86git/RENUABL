"use client";

/**
 * What a page tells Sol's side panel about itself (domain/design/page-context.ts). A page calls `usePageAbout` with
 * its own description (the designer's design in words, a deal's details); the panel reads `currentPageContext` when a
 * question is sent, adding the words on show in the page's body (`[data-sol-page]`). The design tool inside a deal's
 * drawer is a frame of the same site: what it says is passed up to the page around it, where the panel is.
 */
import { useEffect } from "react";
import { screenWords, type PageContext } from "@/lib/domain/design/page-context";

const FROM_FRAME = "renuabl:sol-page";
/** Said whenever what a page says about itself changes, so the panel's "Looking at" line keeps up. */
export const PAGE_ABOUT_CHANGED = "renuabl:sol-page-changed";

type About = { title: string; about: string };
let own: About | null = null;
let framed: About | null = null;
/** Whether a frame (the design tool in a deal's drawer) is open in front of this page; folded away, the page is. */
let frameInFront = false;

/** Said by the deal's drawer as it opens and folds away, so Sol looks at whichever is in front. */
export function setFrameInFront(front: boolean) {
  frameInFront = front;
  tell();
}

function tell() {
  window.dispatchEvent(new Event(PAGE_ABOUT_CHANGED));
}

function setOwn(next: About | null) {
  own = next;
  // Inside the deal's drawer the panel is on the page around this one.
  if (window.parent !== window) {
    try {
      window.parent.postMessage({ type: FROM_FRAME, about: next }, window.location.origin);
    } catch {
      // A parent on another site gets nothing.
    }
  }
  tell();
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.data?.type !== FROM_FRAME) return;
    const a = e.data.about as About | null;
    framed = a && typeof a.about === "string" && typeof a.title === "string" ? { title: a.title, about: a.about } : null;
    tell();
  });
}

/**
 * Says what this page shows, for as long as it is on screen. `about` is worked out by the page and may change as the
 * page does; it is sent on half a second after it stops changing.
 */
export function usePageAbout(title: string, about: string | null) {
  useEffect(() => {
    const t = window.setTimeout(() => setOwn(about ? { title, about } : null), 500);
    return () => window.clearTimeout(t);
  }, [title, about]);
  useEffect(() => () => setOwn(null), []);
}

/** What the page says about itself just now (a drawer's frame first, being what is in front), for the panel's line. */
export const pageAboutNow = (): About | null => (frameInFront && framed ? framed : own);

/** Everything the panel sends with a question: the page's own words about itself, and the words on show. */
export function currentPageContext(title: string): PageContext | null {
  if (typeof document === "undefined") return null;
  // With the drawer's frame in front, the page behind it isn't what they're looking at.
  const body = frameInFront && framed ? null : document.querySelector<HTMLElement>("[data-sol-page]");
  const screen = body ? screenWords(body.innerText) : "";
  const about = pageAboutNow();
  if (!about && !screen) return null;
  return { path: window.location.pathname, title: about?.title || title, about: about?.about ?? "", screen };
}
