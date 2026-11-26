"use client";

/**
 * Pages put aside, kept in the tab (domain/design/minimised-pages.ts): read and written here, told to every screen
 * that shows them (the minimise button and the column of tabs on the left).
 */
import { useEffect, useState } from "react";
import { MINIMISED_KEY, cleanMinimised, withoutMinimised, type MinimisedPage } from "@/lib/domain/design/minimised-pages";

export const MINIMISED_CHANGED = "renuabl:minimised";
/** Where a page opened again is scrolled back to. */
export const MINIMISED_SCROLL_KEY = "renuabl.design.minimised-scroll";

export function readMinimised(): MinimisedPage[] {
  try {
    return cleanMinimised(JSON.parse(sessionStorage.getItem(MINIMISED_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeMinimised(list: MinimisedPage[]) {
  try {
    sessionStorage.setItem(MINIMISED_KEY, JSON.stringify(list));
  } catch {
    // Without storage the page is still put aside for this view.
  }
  window.dispatchEvent(new Event(MINIMISED_CHANGED));
}

/** A page closed without opening it. */
export const closeMinimised = (href: string) => writeMinimised(withoutMinimised(readMinimised(), href));

/** A page opened again, scrolled back to where it was left. */
export function openMinimised(p: MinimisedPage, go: (href: string) => void) {
  closeMinimised(p.href);
  try {
    sessionStorage.setItem(MINIMISED_SCROLL_KEY, JSON.stringify({ path: p.href.split(/[?#]/)[0], y: p.scrollY }));
  } catch {
    // Opens at its top without storage.
  }
  go(p.href);
}

/** The pages put aside, kept up to date. */
export function useMinimised(): MinimisedPage[] {
  const [list, setList] = useState<MinimisedPage[]>([]);
  useEffect(() => {
    const sync = () => setList(readMinimised());
    sync();
    window.addEventListener(MINIMISED_CHANGED, sync);
    return () => window.removeEventListener(MINIMISED_CHANGED, sync);
  }, []);
  return list;
}
