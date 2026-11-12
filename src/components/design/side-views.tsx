"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2, Rotate3d, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { capturedWords } from "@/lib/domain/design/nearmap";

const VIEWS = [
  { id: "North", words: "Looking north" },
  { id: "East", words: "Looking east" },
  { id: "South", words: "Looking south" },
  { id: "West", words: "Looking west" },
] as const;

/**
 * The house from its four sides in Nearmap's angled photos (9 Nov 2026, Martin: the 3D model wasn't sharp enough to be
 * of use; "why wouldn't you use Nearmap's angled photos?"): real photographs at 45°, sharp, to see the roof's faces,
 * what stands on it and the walls. Opened from the picture's corner; each side asked for only when shown, through
 * RENUABL's server so Nearmap's key never reaches the browser.
 */
export function SideViewsButton({ lat, lng, tab }: { lat: number; lng: number; tab?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="See the house from its four sides (Nearmap's angled photos)"
        className={
          tab
            ? "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-ink hover:bg-canvas"
            : "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
        }
      >
        <Rotate3d className={tab ? "size-4" : "size-3.5"} aria-hidden />
        Sides
      </button>
      {/* On the page body: the picture's corner sits in a moved (transformed) part of the page. */}
      {open && createPortal(<SideViewsWindow lat={lat} lng={lng} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SideViewsWindow({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const [at, setAt] = useState(0);
  // Each side: still coming, none to be had, or come (with the day it was captured).
  const [state, setState] = useState<Record<string, "none" | { captured: string }>>({});
  const view = VIEWS[at];
  const src = `/api/design/roof/nearmap/oblique?lat=${lat}&lng=${lng}&view=${view.id}`;
  const step = (by: number) => setAt((i) => (i + by + VIEWS.length) % VIEWS.length);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setAt((i) => (i + 1) % VIEWS.length);
      else if (e.key === "ArrowLeft") setAt((i) => (i + VIEWS.length - 1) % VIEWS.length);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [onClose]);
  const now = state[view.id];
  // The picture is fetched once (it is made on request): its day read from the answer, then shown from that copy.
  const [pictures, setPictures] = useState<Record<string, string>>({});
  useEffect(() => {
    if (state[view.id]) return;
    let live = true;
    fetch(src)
      .then(async (r) => {
        if (!live) return;
        if (!r.ok) return setState((s) => ({ ...s, [view.id]: "none" }));
        const url = URL.createObjectURL(await r.blob());
        setPictures((p) => ({ ...p, [view.id]: url }));
        setState((s) => ({ ...s, [view.id]: { captured: r.headers.get("x-nearmap-captured") ?? "" } }));
      })
      .catch(() => live && setState((s) => ({ ...s, [view.id]: "none" })));
    return () => {
      live = false;
    };
  }, [src, view.id, state]);
  // The pictures are let go when the window closes (only then: each side stays to turn back to).
  const made = useRef<string[]>([]);
  useEffect(() => {
    made.current = Object.values(pictures);
  }, [pictures]);
  useEffect(() => () => made.current.forEach((u) => URL.revokeObjectURL(u)), []);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onPointerDown={onClose}
      data-popup
    >
      <div
        className="relative flex max-h-[92dvh] w-[min(96vw,72rem)] flex-col overflow-hidden rounded-[24px] bg-[#1f2326] shadow-[0_30px_80px_rgba(11,11,12,0.4)]"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="The house from its four sides"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {VIEWS.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setAt(i)}
                aria-pressed={i === at}
                className={clsx(
                  "h-8 rounded-full px-3 text-xs font-medium",
                  i === at ? "bg-white text-ink" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                {v.words}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-white/60 sm:inline">
              Nearmap{now && typeof now === "object" && now.captured ? ` · ${capturedWords(now.captured)}` : ""}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the side views"
              className="flex size-9 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 bg-black">
          {now === "none" ? (
            <p className="grid aspect-[4/3] place-items-center px-8 text-center text-sm text-white/80">
              Nearmap has no angled photo of this house from this side.
            </p>
          ) : pictures[view.id] ? (
            // eslint-disable-next-line @next/next/no-img-element -- a private picture made on request, never optimised
            <img src={pictures[view.id]} alt={`${view.words} at the house`} className="block aspect-[4/3] w-full object-contain" />
          ) : (
            <p className="grid aspect-[4/3] place-items-center text-sm text-white/80">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Fetching the photo
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="The side before"
            className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="The side after"
            className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <p className="px-4 py-2.5 text-xs text-white/60">Nearmap&apos;s angled photos, taken at 45°. Use ← → to go round the house.</p>
      </div>
    </div>
  );
}
