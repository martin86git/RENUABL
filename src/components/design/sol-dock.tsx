"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { FileCheck, Send, TrendingUp, type LucideIcon } from "lucide-react";
import type { SolState } from "@/lib/domain/design/sol";
import { SOL_ASK, SOL_CHANGED, SOL_STATE, SOL_TOGGLE, loadSol, type SolAsk } from "@/lib/services/sol";
import { SOL_PANEL, solPanelWidth } from "@/lib/domain/design/sol-panel";
import { SolChat } from "./sol-chat";
import { SolMark, SolStars } from "./sol-icon";

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
  const [question, setQuestion] = useState<{ id: number; text: string; shown?: string } | null>(null);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const asked = (e: Event) => {
      const said = (e as CustomEvent<SolAsk>).detail;
      const text = String((typeof said === "string" ? said : said?.text) ?? "").trim();
      if (!text) return;
      const shown = typeof said === "object" && said?.shown ? said.shown : undefined;
      setQuestion({ id: Date.now(), text, ...(shown ? { shown } : {}) });
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
  const width = useSolWidth();
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
      {open && (
        // The left edge drags the panel wider or narrower (desktop only); a double press puts it back.
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to change Sol's width"
          aria-valuenow={width.px}
          aria-valuemin={SOL_PANEL.min}
          aria-valuemax={SOL_PANEL.max}
          tabIndex={0}
          title="Drag to change the width. Double-click to reset."
          onPointerDown={width.startDrag}
          onDoubleClick={width.reset}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") width.set(width.px + 32);
            else if (e.key === "ArrowRight") width.set(width.px - 32);
          }}
          className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none lg:block"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-sun-line group-focus-visible:bg-sun-line" />
          <span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line transition-colors group-hover:bg-sun-line" />
        </div>
      )}
      {open && <SolChat side question={question} onClose={() => setOpen(false)} />}
    </aside>
  );
}

const WIDTH_KEY = "renuabl.design.sol-width";

/**
 * The panel's width (sol-panel.ts), kept on the device and set as `--sol-w`, which the page, the rail and team chat's
 * window already make room by. Only on a wide screen: on a phone the panel covers the page.
 */
function useSolWidth() {
  const [px, setPx] = useState<number>(SOL_PANEL.standard);
  const apply = (asked: number, keep: boolean) => {
    const next = solPanelWidth(asked, window.innerWidth);
    setPx(next);
    document.documentElement.style.setProperty("--sol-w", `${next}px`);
    if (keep) {
      try {
        localStorage.setItem(WIDTH_KEY, String(next));
      } catch {
        // Storage refused: it lasts for this page only.
      }
    }
  };
  useEffect(() => {
    let kept = NaN;
    try {
      kept = Number(localStorage.getItem(WIDTH_KEY) ?? NaN);
    } catch {
      // As above.
    }
    const fit = () => apply(Number.isFinite(kept) ? kept : SOL_PANEL.standard, false);
    fit();
    // A narrower window keeps room for the page.
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      document.documentElement.style.removeProperty("--sol-w");
    };
  }, []);
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    // Held by the handle, so a frame under the pointer (the design drawer) can't take the drag.
    e.currentTarget.setPointerCapture(e.pointerId);
    const root = document.documentElement;
    root.classList.add("sol-resizing");
    const move = (m: PointerEvent) => apply(window.innerWidth - m.clientX, false);
    const up = (m: PointerEvent) => {
      apply(window.innerWidth - m.clientX, true);
      root.classList.remove("sol-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return {
    px,
    startDrag,
    set: (n: number) => apply(n, true),
    reset: () => {
      try {
        localStorage.removeItem(WIDTH_KEY);
      } catch {
        // As above.
      }
      apply(SOL_PANEL.standard, false);
    },
  };
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
 * you are on (his own page is a press further, from the panel); his sun beats like a heart, and while a reply waits his
 * count glows.
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
        phone ? "size-12" : "-my-2 size-12",
        open && "ring-2 ring-sun-line/50 ring-offset-2 ring-offset-surface",
      )}
    >
      {/* No rays (3 Nov 2026, Martin): the sun itself beats like a heart, a subtle signal to engage. */}
      <span className="sol-heartbeat inline-flex">
        <SolMark className={clsx("transition-transform duration-300 group-hover:scale-110", phone ? "size-10" : "size-[38px]")} />
      </span>
      {/* The AI's stars, floating diagonally above the round and outside it (3 Nov 2026, Martin). */}
      <SolStars
        className={clsx(
          "pointer-events-none absolute transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
          phone ? "-right-3.5 -top-4 size-6" : "-right-3 -top-3.5 size-[22px]",
        )}
      />
      {waiting && (
        <span className="sol-glow absolute -bottom-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
          {unread}
        </span>
      )}
    </button>
  );
}

/**
 * The rail down the right-hand edge (31 Oct 2026, as Primero's): team chat as a larger round standing out of it
 * (3 Nov 2026, Martin: the focus point), then notifications and email (moved from the top bar), then the sales at a
 * glance. Sol left it for his round in the nav (1 Nov 2026). Wide screens only.
 */
export function SolRail({
  team,
  assistant,
  calc,
  tools,
}: {
  team?: React.ReactNode;
  assistant?: React.ReactNode;
  calc?: React.ReactNode;
  tools?: React.ReactNode;
}) {
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
      aria-label="Team chat, notifications and the numbers"
      className="sol-rail fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-[0_8px_30px_rgba(20,22,26,0.10)] ring-1 ring-line print:hidden lg:flex"
    >
      {team && <span className="team-bulb">{team}</span>}
      {/* The business's phone assistant, to talk to and coach (12 Nov 2026, Martin). */}
      {assistant && <span className="mt-1">{assistant}</span>}
      {/* The calculator under team chat (8 Nov 2026, Martin): an answer on the phone has to be instant. */}
      {calc && <span className="mt-1">{calc}</span>}
      {tools && (
        <>
          <span className="my-1 h-px w-6 bg-line" aria-hidden />
          {tools}
        </>
      )}
      <span className="my-1 h-px w-6 bg-line" aria-hidden />
      {link("/design?view=sales", "Sales this month", TrendingUp, false)}
      {/* The proposals out and those signed (8 Nov 2026, Martin): a paper plane for sent, the proposal's page with a tick for sold. */}
      {link("/design/sales/proposals", "Proposals sent", Send, path.startsWith("/design/sales/proposals"))}
      {link("/design/sales/signed", "Proposals signed", FileCheck, path.startsWith("/design/sales/signed"))}
    </aside>
  );
}
