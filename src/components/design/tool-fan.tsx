"use client";

import { Children, Fragment, isValidElement, useEffect, useRef, useState } from "react";
import clsx from "clsx";

/** Its children, with fragments opened out, so each round is a leg of its own. */
function legsOf(children: React.ReactNode): React.ReactNode[] {
  return Children.toArray(children).flatMap((c) =>
    isValidElement<{ children?: React.ReactNode }>(c) && c.type === Fragment ? legsOf(c.props.children) : [c],
  );
}

const AWAY = {
  down: "-translate-y-3",
  up: "translate-y-3",
  right: "-translate-x-3",
  left: "translate-x-3",
} as const;

/**
 * A round that holds other rounds (8 Nov 2026, Martin: "like a swiss army knife", the controls round the map were
 * overwhelming). Hovering it, or pressing it, brings its legs out one after another, as a stack opens on the Mac's Dock;
 * the pointer leaving folds them back, unless they were pressed open or something in them is in use (`hold`).
 */
export function ToolFan({
  main,
  label,
  direction,
  children,
  hold = false,
  onMain,
  className,
  legsClassName,
}: {
  /** The round itself: its look is the caller's. */
  main: (state: { open: boolean }) => React.ReactNode;
  label: string;
  direction: keyof typeof AWAY;
  children: React.ReactNode;
  /** Keep it open while something in a leg is open (a box, a menu). */
  hold?: boolean;
  /** Pressing the round does this as well as opening it (the string tool, say). Without it, a press pins it open or shut. */
  onMain?: () => void;
  className?: string;
  legsClassName?: string;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const open = hover || pinned || hold;
  // Pressed open, a press anywhere else folds it.
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [pinned]);
  const enter = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setHover(true);
  };
  const leave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover(false), 320);
  };
  const legs = legsOf(children);
  const vertical = direction === "down" || direction === "up";
  return (
    <div ref={box} className={clsx("relative", className)} onMouseEnter={enter} onMouseLeave={leave}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => {
          onMain?.();
          setPinned(onMain ? true : !pinned);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onMain?.();
          setPinned(onMain ? true : !pinned);
        }}
      >
        {main({ open })}
      </div>
      <div
        className={clsx(
          "absolute z-30 flex items-center gap-1.5",
          vertical ? "flex-col" : "flex-row",
          direction === "down" && "left-1/2 top-full -translate-x-1/2 pt-2",
          direction === "up" && "bottom-full left-1/2 -translate-x-1/2 flex-col-reverse pb-2",
          direction === "right" && "left-full top-1/2 -translate-y-1/2 pl-2",
          direction === "left" && "right-full top-1/2 -translate-y-1/2 flex-row-reverse pr-2",
          !open && "pointer-events-none",
          legsClassName,
        )}
      >
        {legs.map((leg, i) => (
          <div
            key={i}
            style={{ transitionDelay: `${open ? i * 28 : (legs.length - 1 - i) * 14}ms` }}
            className={clsx(
              "transition duration-200 ease-out motion-reduce:transition-none",
              open ? "translate-x-0 translate-y-0 scale-100 opacity-100" : clsx("scale-90 opacity-0", AWAY[direction]),
            )}
          >
            {leg}
          </div>
        ))}
      </div>
    </div>
  );
}
