"use client";

import { useSyncExternalStore } from "react";
import { DOCK_SET_KEY, cleanDockSet, type DockSet } from "@/lib/domain/design/dock-set";

/**
 * The phone dock's set (domain/design/dock-set.ts), kept on the device and told to every place that follows it. Only a
 * phone or tablet flips the dock (under 1024px, where the foot bar shows): a wider screen is always the sales tools, so
 * the computer's Today is unchanged.
 */
const CHANGED = "renuabl:dock-set";
const NARROW = "(max-width: 1023px)";

function read(): DockSet {
  try {
    if (!window.matchMedia(NARROW).matches) return "sales";
    return cleanDockSet(localStorage.getItem(DOCK_SET_KEY));
  } catch {
    return "sales";
  }
}

function subscribe(on: () => void): () => void {
  const media = window.matchMedia(NARROW);
  window.addEventListener(CHANGED, on);
  window.addEventListener("storage", on);
  media.addEventListener("change", on);
  return () => {
    window.removeEventListener(CHANGED, on);
    window.removeEventListener("storage", on);
    media.removeEventListener("change", on);
  };
}

/** The set the dock is on now (sales on the server and on a wide screen). */
export function useDockSet(): DockSet {
  return useSyncExternalStore(subscribe, read, () => "sales");
}

export function setDockSet(set: DockSet): void {
  try {
    localStorage.setItem(DOCK_SET_KEY, set);
  } catch {
    // Not kept on this device: it still turns for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}
