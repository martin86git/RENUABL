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
type Direction = keyof typeof AWAY;

/** A control's name for its row: what it says it is (`data-leg`, else its label, else its title up to the first stop). */
function nameOf(el: HTMLElement | null): string {
  if (!el) return "";
  const leg = el.querySelector<HTMLElement>("[data-leg]")?.dataset.leg;
  if (leg) return leg;
  const said = el.querySelector("[aria-label]")?.getAttribute("aria-label") ?? el.querySelector("[title]")?.getAttribute("title") ?? "";
  return said.split(/[(:.]/)[0].trim();
}

/** One row of the knife: the control, and beside it what it is (pressing the words presses the control). */
function KnifeRow({
  children,
  delay,
  open,
  rank,
}: {
  children: React.ReactNode;
  delay: number;
  open: boolean;
  rank?: (name: string) => number;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    // Read from the control as it stands each time the knife opens (a count or a state may have changed).

    if (open) setName(nameOf(row.current));
  }, [open]);
  return (
    <div
      ref={row}
      style={{ transitionDelay: `${open ? delay : 0}ms`, order: rank && name ? rank(name) : undefined }}
      className={clsx(
        "flex items-center gap-2.5 rounded-xl py-0.5 pl-0.5 pr-2 transition duration-200 ease-out hover:bg-surface-2 motion-reduce:transition-none",
        open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
      )}
    >
      <div className="shrink-0">{children}</div>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => row.current?.querySelector<HTMLElement>("button, [role=button]")?.click()}
        className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink"
      >
        {name}
      </button>
    </div>
  );
}

/**
 * The designer's knife (8 Nov 2026, Martin: the rounds that came out had no names and looked like the blocks they sat
 * on): one round that opens a card beside it, its controls in named rows under a heading or two, coming in one after
 * another. Opens on hover or a press, folds as the pointer leaves unless pressed open or a box in it is open (`hold`).
 */
export function KnifeMenu({
  main,
  label,
  sections,
  hold = false,
  panel,
  rank,
}: {
  main: (state: { open: boolean }) => React.ReactNode;
  label: string;
  sections: { title: string; children: React.ReactNode }[];
  hold?: boolean;
  /** Something opened from a row: shown in the card in place of the rows, with the way back. */
  panel?: { title: string; body: React.ReactNode; back: () => void };
  /** Where a row goes in its column, by its name. */
  rank?: (name: string) => number;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const open = hover || pinned || hold;
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [pinned]);
  let n = 0;
  return (
    <div
      ref={box}
      className="relative"
      onMouseEnter={() => {
        if (timer.current) window.clearTimeout(timer.current);
        setHover(true);
      }}
      onMouseLeave={() => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHover(false), 360);
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setPinned(!pinned)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          setPinned(!pinned);
        }}
      >
        {main({ open })}
      </div>
      <div
        className={clsx(
          "absolute left-full top-0 z-40 ml-2 flex origin-top-left gap-1 rounded-2xl bg-surface/95 p-2 shadow-[0_18px_50px_rgba(11,11,12,0.22)] ring-1 ring-line backdrop-blur-md transition duration-200 ease-out motion-reduce:transition-none",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {panel && (
          <div className="w-[26rem] max-w-[80vw] p-1">
            <button
              type="button"
              onClick={panel.back}
              className="mb-1 inline-flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <span aria-hidden>‹</span> Back
            </button>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{panel.title}</p>
            {panel.body}
          </div>
        )}
        {sections.map((section, s) => (
          <div key={section.title} className={clsx("w-56", s > 0 && "border-l border-line pl-1", panel && "hidden")}>
            <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{section.title}</p>
            <div className="flex flex-col gap-0.5">
              {legsOf(section.children).map((leg, i) => (
                <KnifeRow key={i} open={open} delay={n++ * 18} rank={rank}>
                  {leg}
                </KnifeRow>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A round that holds other rounds (8 Nov 2026, Martin: "like a swiss army knife", the controls round the map were
 * overwhelming). Hovering it, or pressing it, brings its legs out one after another, as a stack opens on the Mac's Dock;
 * the pointer leaving folds them back, unless they were pressed open or something in them is in use (`hold`). A second
 * leg (`extra`) can come out of the same round in another direction.
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
  extra,
}: {
  /** The round itself: its look is the caller's. */
  main: (state: { open: boolean }) => React.ReactNode;
  label: string;
  direction: Direction;
  children: React.ReactNode;
  /** Keep it open while something in a leg is open (a box, a menu). */
  hold?: boolean;
  /** Pressing the round does this as well as opening it (the string tool, say). Without it, a press pins it open or shut. */
  onMain?: () => void;
  className?: string;
  legsClassName?: string;
  extra?: { direction: Direction; children: React.ReactNode };
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
  const press = () => {
    onMain?.();
    setPinned(onMain ? true : !pinned);
  };
  const group = (dir: Direction, nodes: React.ReactNode, extraClass?: string) => {
    const legs = legsOf(nodes);
    return (
      <div
        className={clsx(
          "absolute z-30 flex items-center gap-1.5",
          dir === "down" && "left-1/2 top-full -translate-x-1/2 flex-col pt-2",
          dir === "up" && "bottom-full left-1/2 -translate-x-1/2 flex-col-reverse pb-2",
          dir === "right" && "left-full top-1/2 -translate-y-1/2 flex-row pl-2",
          dir === "left" && "right-full top-1/2 -translate-y-1/2 flex-row-reverse pr-2",
          !open && "pointer-events-none",
          extraClass,
        )}
      >
        {legs.map((leg, i) => (
          <div
            key={i}
            style={{ transitionDelay: `${open ? i * 28 : (legs.length - 1 - i) * 14}ms` }}
            className={clsx(
              "transition duration-200 ease-out motion-reduce:transition-none",
              open ? "translate-x-0 translate-y-0 scale-100 opacity-100" : clsx("scale-90 opacity-0", AWAY[dir]),
            )}
          >
            {leg}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div ref={box} className={clsx("relative", className)} onMouseEnter={enter} onMouseLeave={leave}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={press}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          press();
        }}
      >
        {main({ open })}
      </div>
      {group(direction, children, legsClassName)}
      {extra && group(extra.direction, extra.children)}
    </div>
  );
}
