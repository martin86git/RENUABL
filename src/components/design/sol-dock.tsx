"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { CircleDollarSign, TrendingUp, type LucideIcon } from "lucide-react";
import type { SolState } from "@/lib/domain/design/sol";
import { SOL_ASK, SOL_CHANGED, SOL_STATE, SOL_TOGGLE, loadSol } from "@/lib/services/sol";
import { SolChat } from "./sol-chat";
import { SolMark } from "./sol-icon";

/** The page makes room for the panel on a wide screen (`html.sol-docked`, globals.css); kept for this tab. */
const OPEN_CLASS = "sol-docked";
const OPEN_KEY = "renuabl.design.sol-dock";
/** How often the rail asks for Sol's count (and so says any reminder now due). */
const EVERY_MS = 60_000;

/**
 * Sol's panel down the right of every page (31 Oct 2026, as Primero's Lance): opened from his round in the nav (or
 * anything that says `SOL_TOGGLE`), the same conversation as Sol's own page. A question said with `SOL_ASK` (the
 * search's "Ask Sol") opens it and is asked there. On a wide screen the page narrows to make room for it rather than
 * being covered; on a phone it covers the page. Escape closes it.
 */
export function SolDock() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const asked = (e: Event) => {
      const text = String((e as CustomEvent<string>).detail ?? "").trim();
      if (!text) return;
      setQuestion({ id: Date.now(), text });
      setOpen(true);
    };
    window.addEventListener(SOL_TOGGLE, toggle);
    window.addEventListener(SOL_ASK, asked);
    return () => {
      window.removeEventListener(SOL_TOGGLE, toggle);
      window.removeEventListener(SOL_ASK, asked);
    };
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
        open
          ? "translate-x-0 shadow-2xl min-[1440px]:shadow-[-8px_0_30px_rgba(20,22,26,0.06)]"
          : "pointer-events-none invisible translate-x-full",
      )}
    >
      {open && <SolChat side question={question} onClose={() => setOpen(false)} />}
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

/** A ring of rays round Sol's round while a reply waits: it turns slowly, each ray brightening in turn. */
function Rays() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    // Just outside the round (it fills 26 of the 36 across), so they turn round it rather than over it.
    const [r1, r2] = i % 2 ? [14.6, 16] : [14.2, 17.4];
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
      className="pointer-events-none absolute left-1/2 top-1/2 size-[3.75rem] -translate-x-1/2 -translate-y-1/2 overflow-visible"
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

/** Whether Sol's panel is open, as it says (`SOL_STATE`). */
function useSolOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const said = (e: Event) => setOpen(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(SOL_STATE, said);
    return () => window.removeEventListener(SOL_STATE, said);
  }, []);
  return open;
}

/**
 * Sol's round in the nav (1 Nov 2026, Martin: Sol deserves his place beside the design tool). The design tool is the
 * orange round at one end of the sections; Sol is the graphite round at the other, his mark lit inside, so the two
 * tools frame the sections without the one signal colour being spent twice. Pressing it opens his panel over the page
 * you are on (his own page is a press further, from the panel); while a reply waits his rays turn and his count glows.
 * `phone` is the foot bar's raised round.
 */
export function SolNavButton({ phone = false }: { phone?: boolean }) {
  const unread = useSolUnread();
  const open = useSolOpen();
  const waiting = unread > 0 && !open;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(SOL_TOGGLE))}
      title="Sol, your assistant"
      aria-label={unread ? `Sol: ${unread} unread` : "Sol, your assistant"}
      aria-pressed={open}
      className={clsx(
        "sol-orb group relative flex shrink-0 items-center justify-center rounded-full transition-shadow",
        phone ? "size-12" : "-my-2 size-11",
        open && "ring-2 ring-sun-line/50 ring-offset-2 ring-offset-surface-2",
      )}
    >
      {waiting && <Rays />}
      <SolMark className={clsx("sol-breathe transition-transform duration-300 group-hover:scale-110", phone ? "size-7" : "size-6")} />
      {waiting && (
        <span className="sol-glow absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
          {unread}
        </span>
      )}
    </button>
  );
}

/**
 * The rail down the right-hand edge (31 Oct 2026, as Primero's): team chat, then, under a hairline, the sales at a
 * glance. Sol left it for his round in the nav (1 Nov 2026). Wide screens only.
 */
export function SolRail({ team }: { team?: React.ReactNode }) {
  const path = usePathname() ?? "";
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
      aria-label="The team and the numbers"
      className="sol-rail fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-[0_8px_30px_rgba(20,22,26,0.10)] ring-1 ring-line print:hidden lg:flex"
    >
      {team}
      <span className="my-1 h-px w-6 bg-line" aria-hidden />
      {link("/design?view=sales", "Sales this month", TrendingUp, false)}
      {link("/design/sales/signed", "Proposals signed", CircleDollarSign, path.startsWith("/design/sales/signed"))}
    </aside>
  );
}
