"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { cleanPicturePlace, cleanPictureSize, PICTURE_PLACE_USUAL, PICTURE_SIZE } from "@/lib/domain/design/blocks";

type Place = { size: number; x: number; y: number };

/**
 * A block's own picture on the proposal, at the width and in the place the business set (15 Nov 2026, Martin: "i need
 * to be able to position it and resize it"). Its room is the block's width (beside the words, the column's full
 * height), and it sits in it by springs either side in the ratio of its place, so no measuring is needed to draw it.
 *
 * With `onPlace` (the builder, a custom design) it can be dragged to move, its corners dragged to resize, and moved or
 * resized with the arrow keys and + and −; a double click puts it back full width. One change is saved when let go.
 */
export function BlockPicture({
  src,
  side,
  place,
  onPlace,
}: {
  src: string;
  /** Beside the words: the picture keeps a 4:3 frame and the room is the column's height. */
  side: boolean;
  place: Place;
  onPlace: ((place: Place) => void) | null;
}) {
  const room = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<Place | null>(null);
  const shown = live ?? place;

  const drag = (e: React.PointerEvent, how: "move" | "left" | "right") => {
    if (!onPlace || !room.current || !frame.current || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const r = room.current.getBoundingClientRect();
    const f = frame.current.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, left: f.left - r.left, w: f.width, h: f.height };
    let last = place;
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer knows: the drag still follows events on the picture.
    }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      let next: Place;
      if (how === "move") {
        const freeX = r.width - start.w;
        const freeY = r.height - start.h;
        next = {
          size: place.size,
          x: freeX > 4 ? cleanPicturePlace(place.x + (dx / freeX) * 100) : place.x,
          y: freeY > 4 ? cleanPicturePlace(place.y + (dy / freeY) * 100) : place.y,
        };
      } else {
        // The far edge stays put: the right handle grows rightwards, the left one leftwards.
        const size = cleanPictureSize(((start.w + (how === "right" ? dx : -dx)) / r.width) * 100);
        const w = (size / 100) * r.width;
        const left = how === "right" ? start.left : start.left + start.w - w;
        const free = r.width - w;
        next = { size, x: free > 1 ? cleanPicturePlace((left / free) * 100) : PICTURE_PLACE_USUAL, y: place.y };
      }
      last = next;
      setLive(next);
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      setLive(null);
      if (last.size !== place.size || last.x !== place.x || last.y !== place.y) onPlace(last);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!onPlace) return;
    const step = e.shiftKey ? 20 : 5;
    const by: Partial<Record<string, Place>> = {
      ArrowLeft: { ...place, x: cleanPicturePlace(place.x - step) },
      ArrowRight: { ...place, x: cleanPicturePlace(place.x + step) },
      ArrowUp: { ...place, y: cleanPicturePlace(place.y - step) },
      ArrowDown: { ...place, y: cleanPicturePlace(place.y + step) },
      "+": { ...place, size: cleanPictureSize(place.size + step) },
      "=": { ...place, size: cleanPictureSize(place.size + step) },
      "-": { ...place, size: cleanPictureSize(place.size - step) },
      "0": { size: PICTURE_SIZE.usual, x: PICTURE_PLACE_USUAL, y: PICTURE_PLACE_USUAL },
    };
    const next = by[e.key];
    if (!next) return;
    e.preventDefault();
    onPlace(next);
  };

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our own route
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      className={clsx("block w-full rounded-xl object-cover", side ? "aspect-[4/3]" : "max-h-[26rem]")}
    />
  );

  const handle = (where: "left" | "right") => (
    <span
      aria-hidden
      onPointerDown={(e) => drag(e, where)}
      className={clsx(
        "absolute -bottom-2 z-10 size-4 rounded-full border-2 border-white bg-sun-line shadow-md",
        where === "right" ? "-right-2 cursor-nwse-resize" : "-left-2 cursor-nesw-resize",
      )}
    />
  );

  return (
    <div ref={room} className={clsx("flex w-full flex-col", side && "self-stretch")}>
      <span style={{ flexGrow: shown.y }} aria-hidden />
      <div className="flex w-full">
        <span style={{ flexGrow: shown.x }} aria-hidden />
        <div
          ref={frame}
          style={{ width: `${shown.size}%` }}
          className={clsx("relative shrink-0", onPlace && "group/pic")}
          {...(onPlace
            ? {
                tabIndex: 0,
                role: "group",
                "aria-label": `Picture, ${shown.size}% wide. Drag to move, drag a corner to resize; arrow keys move it, plus and minus resize it, 0 puts it back.`,
                title: "Drag to move · drag a corner to resize · double-click to fill the width again",
                onPointerDown: (e: React.PointerEvent) => drag(e, "move"),
                onDoubleClick: () => onPlace({ size: PICTURE_SIZE.usual, x: PICTURE_PLACE_USUAL, y: PICTURE_PLACE_USUAL }),
                onKeyDown: onKey,
              }
            : {})}
        >
          {image}
          {onPlace && (
            <>
              <span
                aria-hidden
                className={clsx(
                  "pointer-events-none absolute inset-0 rounded-xl ring-2 ring-sun-line transition-opacity",
                  live ? "opacity-100" : "opacity-0 group-hover/pic:opacity-100 group-focus-visible/pic:opacity-100",
                )}
              />
              <span
                className={clsx(
                  "pointer-events-none absolute left-2 top-2 rounded-md bg-ink/80 px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-white transition-opacity",
                  live ? "opacity-100" : "opacity-0 group-hover/pic:opacity-100",
                )}
              >
                {shown.size}% wide
              </span>
              <span className={clsx("transition-opacity", live ? "opacity-100" : "opacity-0 group-hover/pic:opacity-100")}>
                {handle("left")}
                {handle("right")}
              </span>
              <span className="absolute inset-0 cursor-move rounded-xl" aria-hidden />
            </>
          )}
        </div>
        <span style={{ flexGrow: 100 - shown.x }} aria-hidden />
      </div>
      <span style={{ flexGrow: 100 - shown.y }} aria-hidden />
    </div>
  );
}
