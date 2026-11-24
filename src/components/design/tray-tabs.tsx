"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { cleanKeptOrder, moveTab, orderTabs } from "@/lib/domain/design/tray-order";

export type TrayTabItem<K extends string> = {
  key: K;
  label: string;
  icon: LucideIcon;
  count?: number;
  /** A shortcut to another page (Pipeline), not a panel under the tray. */
  href?: string;
};

const STORE = "renuabl.design.tray-order.";
/** A finger held this long on a tab picks it up; moving sooner is a scroll of the tray. */
const HOLD_MS = 320;
/** A mouse picks a tab up once it has moved this far. */
const MOUSE_START_PX = 5;

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function rawKept(set: string): string {
  try {
    return window.localStorage.getItem(STORE + set) ?? "";
  } catch {
    return "";
  }
}
function readKept(raw: string): string[] | null {
  try {
    return raw ? cleanKeptOrder(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function keep(set: string, order: string[]) {
  try {
    window.localStorage.setItem(STORE + set, JSON.stringify(order));
  } catch {
    // Kept for the visit only.
  }
  listeners.forEach((fn) => fn());
}

/**
 * The tabs in the tray under Sol's box (24 Nov 2026, Martin: "allow a click and drag to reorder them"). A mouse drags a
 * tab straight away; on a touch screen a tab is held a moment, then dragged, so a quick swipe still scrolls the tray.
 * Alt with the arrow keys moves the focused tab too. The order is kept on the device, one for each set of tabs.
 */
export function TrayTabs<K extends string>(props: { set: string; tabs: TrayTabItem<K>[]; shown: K | null; onPick: (key: K) => void }) {
  const offered = props.tabs.map((t) => t.key);
  // Kept on the device; the server's page draws the tabs as they come, so its first draw and the browser's agree.
  const raw = useSyncExternalStore(
    subscribe,
    () => rawKept(props.set),
    () => "",
  );
  // While a tab is being dragged, the order as it stands under the pointer.
  const [moving, setMoving] = useState<K[] | null>(null);
  const order = moving ?? orderTabs(offered, readKept(raw));
  const byKey = new Map(props.tabs.map((t) => [t.key, t]));

  const [dragging, setDragging] = useState<K | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<K, HTMLElement>());
  const press = useRef<{
    key: K;
    id: number;
    x: number;
    y: number;
    touch: boolean;
    timer: number | null;
    live: boolean;
    order: K[];
  } | null>(null);
  // After a drag, the click that follows the release mustn't open the tab.
  const swallowClick = useRef(false);

  // While a finger drags a tab, the tray mustn't scroll under it (Safari decides on touchmove, not pointer events).
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (press.current?.live) e.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);

  const save = (next: K[]) => keep(props.set, next);

  const start = (target: HTMLElement) => {
    const p = press.current;
    if (!p) return;
    p.live = true;
    setDragging(p.key);
    try {
      target.setPointerCapture(p.id);
    } catch {
      // The pointer may already be gone.
    }
    if (p.touch) navigator.vibrate?.(10);
  };

  const onDown = (key: K) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const touch = e.pointerType !== "mouse";
    const target = e.currentTarget;
    press.current = { key, id: e.pointerId, x: e.clientX, y: e.clientY, touch, timer: null, live: false, order };
    if (touch) press.current.timer = window.setTimeout(() => start(target), HOLD_MS);
  };

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.live) {
      if (p.touch) {
        // Moved before the hold: it's a scroll, not a drag.
        if (Math.hypot(dx, dy) > 8) {
          if (p.timer) window.clearTimeout(p.timer);
          press.current = null;
        }
        return;
      }
      if (Math.abs(dx) < MOUSE_START_PX) return;
      start(e.currentTarget);
    }
    // Where the pointer is among the other tabs' middles is where the dragged one goes.
    const others = p.order.filter((k) => k !== p.key);
    let at = 0;
    for (const k of others) {
      const r = tabRefs.current.get(k)?.getBoundingClientRect();
      if (r && e.clientX > r.left + r.width / 2) at += 1;
    }
    const next = moveTab(p.order, p.key, at);
    if (next.join() !== p.order.join()) {
      p.order = next;
      setMoving(next);
    }
  };

  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (p.timer) window.clearTimeout(p.timer);
    if (p.live) {
      swallowClick.current = true;
      // A touch drag may never be followed by a click: don't swallow the next real one.
      window.setTimeout(() => (swallowClick.current = false), 400);
      save(p.order);
    }
    press.current = null;
    setDragging(null);
    setMoving(null);
  };

  const onKey = (key: K) => (e: React.KeyboardEvent) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const next = moveTab(order, key, order.indexOf(key) + (e.key === "ArrowLeft" ? -1 : 1));
    save(next);
    requestAnimationFrame(() => tabRefs.current.get(key)?.focus());
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="About the month"
      className="no-scrollbar flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap px-2 max-sm:pr-10 max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] sm:justify-center"
    >
      {order.map((key) => {
        const t = byKey.get(key);
        if (!t) return null;
        const Icon = t.icon;
        const on = props.shown === key;
        const className = clsx(
          "inline-flex h-8 shrink-0 select-none items-center gap-1.5 rounded-full px-3 text-[13px] transition [-webkit-touch-callout:none]",
          dragging === key
            ? "scale-105 cursor-grabbing bg-white/20 text-white shadow-lg ring-1 ring-sun-line"
            : on
              ? "bg-surface text-ink shadow-sm"
              : "text-white/75 hover:bg-white/10 hover:text-white",
        );
        const inner = (
          <>
            <Icon className="size-3.5" aria-hidden />
            {t.label}
            {t.count ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-sun-line px-1.5 text-[11px] font-semibold text-white">
                {t.count}
              </span>
            ) : null}
          </>
        );
        const common = {
          ref: (el: HTMLElement | null) => {
            if (el) tabRefs.current.set(key, el);
            else tabRefs.current.delete(key);
          },
          onPointerDown: onDown(key),
          onPointerMove: onMove,
          onPointerUp: onUp,
          onPointerCancel: onUp,
          onKeyDown: onKey(key),
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          onClickCapture: (e: React.MouseEvent) => {
            if (!swallowClick.current) return;
            swallowClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          },
          draggable: false,
          title: "Drag to reorder",
          className,
        };
        return t.href ? (
          <Link key={key} href={t.href} {...common}>
            {inner}
          </Link>
        ) : (
          <button key={key} type="button" role="tab" aria-selected={on} onClick={() => props.onPick(key)} {...common}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
