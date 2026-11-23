"use client";

/**
 * Sizing the calendar on a computer (23 Nov 2026, Martin: "on desktop allow me to size the calendar wider and taller
 * at my discretion"). `useCalendarSize` keeps the size dragged on the device and fits it to the room there is;
 * `ResizeGrip` is an edge or corner to drag (a double click puts it back as it came, the arrow keys step it).
 * Under 1024px there is no size: the calendar is as it was.
 */

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { CALENDAR_SIZE_KEYS, CALENDAR_SIZES, calendarSize, readCalendarSize, type CalSize } from "@/lib/domain/design/calendar-size";

const DESKTOP = "(min-width: 1024px)";

export function useCalendarSize(kind: keyof typeof CALENDAR_SIZES, measure: () => CalSize | null) {
  const [asked, setAsked] = useState<CalSize | null>(null);
  const [room, setRoom] = useState<CalSize | null>(null);
  const measureRef = useRef(measure);
  useEffect(() => {
    measureRef.current = measure;
  });
  useEffect(() => {
    try {
      // What was kept is only known in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAsked(readCalendarSize(window.localStorage.getItem(CALENDAR_SIZE_KEYS[kind])));
    } catch {
      // No storage: the usual size.
    }
    const media = window.matchMedia(DESKTOP);
    const fit = () => setRoom(media.matches ? measureRef.current() : null);
    fit();
    window.addEventListener("resize", fit);
    media.addEventListener("change", fit);
    return () => {
      window.removeEventListener("resize", fit);
      media.removeEventListener("change", fit);
    };
  }, [kind]);
  const limits = CALENDAR_SIZES[kind];
  const size = room ? calendarSize(asked, limits, room) : null;
  const keep = useCallback(
    (s: CalSize) => {
      const now = measureRef.current();
      const fitted = now ? calendarSize(s, limits, now) : s;
      setAsked(fitted);
      try {
        window.localStorage.setItem(CALENDAR_SIZE_KEYS[kind], JSON.stringify(fitted));
      } catch {
        // Not kept: fine for this visit.
      }
    },
    [kind, limits],
  );
  const reset = useCallback(() => {
    setAsked(null);
    try {
      window.localStorage.removeItem(CALENDAR_SIZE_KEYS[kind]);
    } catch {
      // Nothing kept.
    }
  }, [kind]);
  return { size, keep, reset };
}

export function ResizeGrip(props: {
  label: string;
  className: string;
  start: () => CalSize;
  onDrag: (dx: number, dy: number, start: CalSize) => void;
  onReset: () => void;
  keys?: (key: string) => void;
  orientation?: "vertical" | "horizontal";
  /** Which corner, for a corner grip (its dot sits there). */
  corner?: "bottom-right" | "bottom-left";
}) {
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const from = { x: e.clientX, y: e.clientY };
    const size = props.start();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const body = document.body.style;
    const was = body.userSelect;
    body.userSelect = "none";
    const move = (m: PointerEvent) => props.onDrag(m.clientX - from.x, m.clientY - from.y, size);
    const up = () => {
      body.userSelect = was;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  return (
    <div
      role={props.corner ? undefined : "separator"}
      aria-orientation={props.corner ? undefined : props.orientation}
      aria-label={props.label}
      title={`${props.label} (double-click to reset)`}
      tabIndex={props.corner ? -1 : 0}
      onPointerDown={down}
      onDoubleClick={props.onReset}
      onKeyDown={(e) => {
        if (!props.keys || !e.key.startsWith("Arrow")) return;
        e.preventDefault();
        props.keys(e.key);
      }}
      className={clsx("group touch-none select-none focus:outline-none", props.className)}
    >
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none absolute rounded-full bg-sun-line opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-90",
          props.corner === "bottom-right"
            ? "bottom-1 right-1 size-2"
            : props.corner === "bottom-left"
              ? "bottom-1 left-1 size-2"
              : props.orientation === "horizontal"
                ? "inset-x-0 top-1/2 h-0.5 -translate-y-1/2"
                : "inset-y-0 left-1/2 w-0.5 -translate-x-1/2",
        )}
      />
    </div>
  );
}
