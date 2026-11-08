"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Layers, Pin, PinOff } from "lucide-react";
import clsx from "clsx";

/** Kept on the device: the sections held open for someone whose day is in them. */
export const SECTIONS_PIN_KEY = "renuabl.design.sections-pinned";

const PIN_EVENT = "renuabl:sections-pin";
const readPin = () => {
  try {
    return localStorage.getItem(SECTIONS_PIN_KEY) === "1";
  } catch {
    return false;
  }
};
const onPinChange = (tell: () => void) => {
  window.addEventListener(PIN_EVENT, tell);
  window.addEventListener("storage", tell);
  return () => {
    window.removeEventListener(PIN_EVENT, tell);
    window.removeEventListener("storage", tell);
  };
};

/** How long the pointer rests before the sections open, and before they fold away again. */
const OPEN_AFTER_MS = 150;
const CLOSE_AFTER_MS = 250;

/**
 * The business's sections (CRM, Procurement, Installation, Service) folded behind one layers icon in the top bar
 * (8 Nov 2026, Martin: the sections are the engine Sol works on, not the surface; a horizontal accordion that opens in
 * place on hover). Open while the pointer or focus is on it, on a tap on a touch screen, always while a page inside
 * one of them is on show (`inside`), and whenever pinned. A dot on the icon while folded says something in them waits.
 */
export function SectionFold({ inside, waiting, children }: { inside: boolean; waiting: number; children: ReactNode }) {
  const pinned = useSyncExternalStore(onPinChange, readPin, () => false);
  const [hover, setHover] = useState(false);
  const timer = useRef<number | null>(null);
  const pointer = useRef<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (value: boolean, ms: number) => {
    stop();
    timer.current = window.setTimeout(() => setHover(value), ms);
  };
  useEffect(() => stop, []);

  const open = inside || pinned || hover;

  // Opened by a tap: a tap anywhere else folds it away again.
  useEffect(() => {
    if (!hover) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setHover(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [hover]);

  const pin = () => {
    const next = !pinned;
    if (!next) setHover(false);
    try {
      localStorage.setItem(SECTIONS_PIN_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(PIN_EVENT));
    } catch {
      // No storage (a private window): it can't be kept.
    }
  };

  return (
    <div
      ref={box}
      className="flex items-center"
      onMouseEnter={() => later(true, OPEN_AFTER_MS)}
      onMouseLeave={() => later(false, CLOSE_AFTER_MS)}
      onFocus={() => {
        stop();
        setHover(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) later(false, 0);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setHover(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={waiting > 0 ? `Your sections, ${waiting} waiting` : "Your sections"}
        title="CRM, Procurement, Installation and Service"
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        onClick={() => {
          // A mouse opens it by resting on it; a tap or a key press opens and closes it.
          const by = pointer.current;
          pointer.current = null;
          if (by === "mouse") return;
          stop();
          setHover((h) => !h);
        }}
        className={clsx(
          "relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          open ? "text-ink" : "text-ink-2 hover:text-ink",
        )}
      >
        <Layers className="size-[18px]" aria-hidden />
        {!open && waiting > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-sun-line" aria-hidden />}
      </button>
      {/* Opens sideways in place: the column grows from nothing to its own width. */}
      <div
        className={clsx(
          "grid transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
        )}
        inert={!open}
      >
        <div className="flex min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap">
          {children}
          <button
            type="button"
            onClick={pin}
            aria-pressed={pinned}
            aria-label={pinned ? "Stop keeping the sections open" : "Keep the sections open"}
            title={pinned ? "Stop keeping the sections open" : "Keep the sections open"}
            className={clsx(
              "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
              pinned ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {pinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
