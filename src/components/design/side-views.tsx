"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Rotate3d, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { capturedWords } from "@/lib/domain/design/nearmap";
import { OBLIQUE_PICTURE, bestSide, panelsInPhoto, type ObliquePanel } from "@/lib/domain/design/oblique";
import type { Terrain } from "@/lib/domain/design/shade";

/**
 * The design to draw on the photos (26 Nov 2026, Martin: build on the plan and see it on the side view): its panels as
 * they stand on the plan, and the heights round the roof (null while they come, "none" when there are none).
 */
export interface SideDesign {
  panels: readonly ObliquePanel[];
  terrain: Terrain | "none" | null;
  lat: number;
}

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
export function SideViewsButton({
  lat,
  lng,
  tab,
  icon,
  tray,
  design,
}: {
  lat: number;
  lng: number;
  tab?: boolean;
  icon?: boolean;
  /** As a tile in Sol's tray on a phone: the icon over its name. */
  tray?: boolean;
  /** The design to draw on the photos, live: the window then stands beside the plan rather than over it. */
  design?: SideDesign;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="See the house from its four sides (Nearmap's angled photos)"
        aria-label={icon ? "Sides: the house from its four sides" : undefined}
        className={
          tray
            ? "flex h-[4.25rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.07] text-[11px] font-medium text-white/85 active:bg-white/15"
            : icon
              ? "flex size-9 items-center justify-center rounded-full text-ink hover:bg-canvas"
              : tab
                ? "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-ink hover:bg-canvas"
                : "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
        }
      >
        <Rotate3d className={tray ? "size-5 text-white" : tab || icon ? "size-4" : "size-3.5"} aria-hidden />
        {!icon && "Sides"}
      </button>
      {/* On the page body: the picture's corner sits in a moved (transformed) part of the page. */}
      {open && createPortal(<SideViewsWindow lat={lat} lng={lng} design={design} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SideViewsWindow({ lat, lng, design, onClose }: { lat: number; lng: number; design?: SideDesign; onClose: () => void }) {
  // With a design it opens on the side that looks at its panels square on.
  const [at, setAt] = useState(() => (design ? VIEWS.findIndex((v) => v.id === bestSide(design.panels)) : 0));
  // Beside the plan (not over it) on a screen wide enough, so the dock and the tools stay in reach.
  const [docked] = useState(() => !!design && typeof window !== "undefined" && window.innerWidth >= 768);
  const [large, setLarge] = useState(false);
  const [showPanels, setShowPanels] = useState(true);
  const [moved, setMoved] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);
  // Each side: still coming, none to be had, or come (with the day it was captured).
  const [state, setState] = useState<Record<string, "none" | { captured: string }>>({});
  const view = VIEWS[at];
  const src = `/api/design/roof/nearmap/oblique?lat=${lat}&lng=${lng}&view=${view.id}`;
  const step = (by: number) => setAt((i) => (i + by + VIEWS.length) % VIEWS.length);
  useEffect(() => {
    // Docked, the designer's own keys (arrows nudge panels, Escape) stay the designer's.
    if (docked) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setAt((i) => (i + 1) % VIEWS.length);
      else if (e.key === "ArrowLeft") setAt((i) => (i + VIEWS.length - 1) % VIEWS.length);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [onClose, docked]);
  const now = state[view.id];
  const drawn = useMemo(
    () =>
      design && design.terrain && design.terrain !== "none" && design.panels.length
        ? panelsInPhoto(design.panels, design.terrain, view.id, design.lat)
        : [],
    [design, view.id],
  );
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
  const startDrag = (e: React.PointerEvent) => {
    if (!docked || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, from: moved };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const dragging = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setMoved({ x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y });
  };
  const card = (
    <div
      className={clsx(
        "relative flex flex-col overflow-hidden rounded-[24px] bg-[#1f2326] shadow-[0_30px_80px_rgba(11,11,12,0.4)]",
        docked ? (large ? "w-[min(60vw,52rem)]" : "w-[min(38vw,30rem)]") : "max-h-[92dvh] w-[min(96vw,72rem)]",
      )}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="The house from its four sides"
    >
      <div
        className={clsx("flex items-center justify-between gap-3", docked ? "cursor-move px-3 py-2" : "px-4 py-3")}
        onPointerDown={startDrag}
        onPointerMove={dragging}
        onPointerUp={() => (drag.current = null)}
      >
        <div className="flex flex-wrap gap-1">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setAt(i)}
              aria-pressed={i === at}
              className={clsx(
                "h-8 rounded-full text-xs font-medium",
                docked ? "px-2.5" : "px-3",
                i === at ? "bg-white text-ink" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              {v.words}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className={clsx("text-xs text-white/60", docked ? "hidden xl:inline" : "hidden sm:inline")}>
            Nearmap{now && typeof now === "object" && now.captured ? ` · ${capturedWords(now.captured)}` : ""}
          </span>
          {docked && (
            <button
              type="button"
              onClick={() => setLarge((l) => !l)}
              aria-label={large ? "Make the side view smaller" : "Make the side view larger"}
              title={large ? "Smaller" : "Larger"}
              className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              {large ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            </button>
          )}
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
          <div className="relative aspect-[4/3] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private picture made on request, never optimised */}
            <img src={pictures[view.id]} alt={`${view.words} at the house`} className="block size-full object-contain" />
            {showPanels && drawn.length > 0 && (
              <svg
                viewBox={`0 0 ${OBLIQUE_PICTURE.width} ${OBLIQUE_PICTURE.height}`}
                className="pointer-events-none absolute inset-0 size-full"
                aria-label={`${drawn.length} panels from the plan`}
              >
                {/* Hidden ones first (behind the roof in this photo), then those the camera sees. */}
                {[...drawn]
                  .sort((a, b) => Number(a.seen) - Number(b.seen))
                  .map((d, i) => (
                    <polygon
                      key={i}
                      points={d.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                      fill={d.seen ? "rgba(16,24,38,0.86)" : "none"}
                      stroke={d.seen ? "rgba(214,222,232,0.9)" : "rgba(255,255,255,0.45)"}
                      strokeWidth={d.seen ? 0.9 : 0.8}
                      strokeDasharray={d.seen ? undefined : "3 3"}
                      strokeLinejoin="round"
                    />
                  ))}
              </svg>
            )}
          </div>
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
      {design ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-white/60">
          <span>{designLine(design, drawn.length, drawn.filter((d) => !d.seen).length)}</span>
          {drawn.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPanels((on) => !on)}
              aria-pressed={showPanels}
              className="shrink-0 rounded-full px-2.5 py-1 font-medium text-white/85 hover:bg-white/10"
            >
              {showPanels ? "Hide panels" : "Show panels"}
            </button>
          )}
        </div>
      ) : (
        <p className="px-4 py-2.5 text-xs text-white/60">Nearmap&apos;s angled photos, taken at 45°. Use ← → to go round the house.</p>
      )}
    </div>
  );
  if (docked)
    return (
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80]"
        style={{ transform: `translate(${moved.x}px, ${moved.y}px)` }}
        data-popup
      >
        <div className="pointer-events-auto">{card}</div>
      </div>
    );
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onPointerDown={onClose}
      data-popup
    >
      {card}
    </div>
  );
}

/** What the strip under the photo says about the design drawn on it. */
function designLine(design: SideDesign, drawn: number, hidden = 0): string {
  if (!design.panels.length) return "Lay panels on the plan and they appear here, on the roof.";
  if (design.terrain === null) return "Working out the roof's heights to draw your panels…";
  if (design.terrain === "none" || !drawn) return "There are no heights for this roof, so the panels can't be drawn on the photo.";
  return `Your ${drawn} panels from the plan, drawn at the roof's height.${hidden ? ` Dashed: on a slope too steep to see from this side.` : ""}`;
}
