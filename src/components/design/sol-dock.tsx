"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { CircleDollarSign, TrendingUp, type LucideIcon } from "lucide-react";
import type { SolState } from "@/lib/domain/design/sol";
import { SOL_CHANGED, SOL_STATE, SOL_TOGGLE, loadSol } from "@/lib/services/sol";
import { SolChat } from "./sol-chat";
import { SolIcon } from "./sol-icon";

/** The page makes room for the panel on a wide screen (`html.sol-docked`, globals.css); kept for this tab. */
const OPEN_CLASS = "sol-docked";
const OPEN_KEY = "renuabl.design.sol-dock";
/** How often the rail asks for Sol's count (and so says any reminder now due). */
const EVERY_MS = 60_000;

/**
 * Sol's panel down the right of every page (31 Oct 2026, as Primero's Lance): opened from the rail (or anything that
 * says `SOL_TOGGLE`), the same conversation as Sol's own page. On a wide screen the page narrows to make room for it
 * rather than being covered; on a phone it covers the page. Escape closes it.
 */
export function SolDock() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener(SOL_TOGGLE, toggle);
    return () => window.removeEventListener(SOL_TOGGLE, toggle);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SOL_STATE, { detail: open }));
  }, [open]);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(OPEN_KEY) === "1") queueMicrotask(() => setOpen(true));
    } catch {
      // Storage refused: it starts closed.
    }
  }, []);
  useEffect(() => {
    try {
      if (open) sessionStorage.setItem(OPEN_KEY, "1");
      else sessionStorage.removeItem(OPEN_KEY);
    } catch {
      // As above.
    }
    document.documentElement.classList.toggle(OPEN_CLASS, open);
    return () => document.documentElement.classList.remove(OPEN_CLASS);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <aside
      aria-label="Sol"
      aria-hidden={!open}
      className={clsx(
        "fixed inset-y-0 right-0 z-50 w-full border-l border-line bg-surface transition-transform duration-300 motion-reduce:transition-none print:hidden lg:z-40 lg:w-[var(--sol-w)]",
        open ? "translate-x-0 shadow-2xl lg:shadow-[-8px_0_30px_rgba(20,22,26,0.06)]" : "pointer-events-none invisible translate-x-full",
      )}
    >
      {open && <SolChat side onClose={() => setOpen(false)} />}
    </aside>
  );
}

/** How many of Sol's lines are unread, asked every minute and kept in step with any Sol on screen. */
export function useSolUnread(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const read = () =>
      void loadSol().then((r) => {
        if (live && r.ok) setN(r.state.unread);
      });
    read();
    const t = window.setInterval(() => document.visibilityState === "visible" && read(), EVERY_MS);
    const changed = (e: Event) => setN((e as CustomEvent<SolState>).detail?.unread ?? 0);
    window.addEventListener(SOL_CHANGED, changed);
    return () => {
      live = false;
      window.clearInterval(t);
      window.removeEventListener(SOL_CHANGED, changed);
    };
  }, []);
  return n;
}

/** A ring of rays round Sol's mark while a reply waits: it turns slowly, each ray brightening in turn. */
function Rays() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const [r1, r2] = i % 2 ? [12, 14.5] : [11.5, 16.5];
    return {
      x1: 18 + r1 * Math.sin(a),
      y1: 18 - r1 * Math.cos(a),
      x2: 18 + r2 * Math.sin(a),
      y2: 18 - r2 * Math.cos(a),
      delay: (i / 12) * 1.8,
    };
  });
  return (
    <svg
      viewBox="0 0 36 36"
      className="pointer-events-none absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 overflow-visible"
      aria-hidden
    >
      <g className="sol-rays">
        {rays.map((r, i) => (
          <line
            key={i}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke="var(--sun-line)"
            strokeWidth={1.6}
            strokeLinecap="round"
            style={{ animationDelay: `${r.delay}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * The rail down the right-hand edge (31 Oct 2026, as Primero's): Sol (opens his panel; rays and a count while a reply
 * waits; on his own page, the page is lit instead), then, under a hairline, the sales at a glance. Wide screens only;
 * on a phone Sol is under More.
 */
export function SolRail({ team }: { team?: React.ReactNode }) {
  const path = usePathname() ?? "";
  const unread = useSolUnread();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const said = (e: Event) => setOpen(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(SOL_STATE, said);
    return () => window.removeEventListener(SOL_STATE, said);
  }, []);
  const onSol = path === "/design/sol";
  const round = (on: boolean) =>
    clsx(
      "relative flex size-10 items-center justify-center rounded-full transition-colors",
      on ? "bg-ink text-sun-line" : "text-ink-2 hover:bg-canvas hover:text-ink",
    );
  const link = (href: string, label: string, Icon: LucideIcon, on: boolean) => (
    <Link href={href} title={label} aria-label={label} aria-current={on ? "page" : undefined} className={round(on)}>
      <Icon className="size-[18px]" aria-hidden />
    </Link>
  );
  return (
    <aside
      aria-label="Sol and the team"
      className="sol-rail fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-[0_8px_30px_rgba(20,22,26,0.10)] ring-1 ring-line print:hidden lg:flex"
    >
      {onSol ? (
        link("/design/sol", "Sol", SolIcon, true)
      ) : (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(SOL_TOGGLE))}
          title="Ask Sol"
          aria-label={unread ? `Ask Sol: ${unread} unread` : "Ask Sol"}
          aria-pressed={open}
          className={round(open)}
        >
          {unread > 0 && !open && <Rays />}
          <SolIcon className="size-[18px]" aria-hidden />
          {unread > 0 && !open && (
            <span className="sol-glow absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
              {unread}
            </span>
          )}
        </button>
      )}
      {team}
      <span className="my-1 h-px w-6 bg-line" aria-hidden />
      {link("/design?view=sales", "Sales this month", TrendingUp, false)}
      {link("/design/sales/signed", "Proposals signed", CircleDollarSign, path.startsWith("/design/sales/signed"))}
    </aside>
  );
}
