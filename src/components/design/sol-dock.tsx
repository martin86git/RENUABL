"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { SolState } from "@/lib/domain/design/sol";
import { SOL_ASK, SOL_CHANGED, SOL_INDUCTION, SOL_STATE, SOL_TOGGLE, loadSol, type SolAsk } from "@/lib/services/sol";
import { SOL_PANEL, solPanelWidth } from "@/lib/domain/design/sol-panel";
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
  // Minimised (19 Nov 2026, Martin: "the ability to minimize the sol drawer, with a little tab sticking out for me to
  // re-engage it"): the panel slides away but stays open, so an answer on its way and the box's words are kept, and a
  // tab with his sun stands out of the right edge to bring it back. Anything that opens him brings it back too.
  const [tucked, setTucked] = useState(false);
  const shown = open && !tucked;
  const [question, setQuestion] = useState<{ id: number; text: string; shown?: string } | null>(null);
  useEffect(() => {
    const toggle = () => {
      setTucked(false);
      setOpen((o) => !o);
    };
    const asked = (e: Event) => {
      const said = (e as CustomEvent<SolAsk>).detail;
      const text = String((typeof said === "string" ? said : said?.text) ?? "").trim();
      if (!text) return;
      const shown = typeof said === "object" && said?.shown ? said.shown : undefined;
      setQuestion({ id: Date.now(), text, ...(shown ? { shown } : {}) });
      setTucked(false);
      setOpen(true);
    };
    // His introduction (sol-induction.ts): the panel opens, and the chat shows it while it is still to do.
    const induct = () => {
      setTucked(false);
      setOpen(true);
    };
    window.addEventListener(SOL_TOGGLE, toggle);
    window.addEventListener(SOL_ASK, asked);
    window.addEventListener(SOL_INDUCTION, induct);
    return () => {
      window.removeEventListener(SOL_TOGGLE, toggle);
      window.removeEventListener(SOL_ASK, asked);
      window.removeEventListener(SOL_INDUCTION, induct);
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
  }, [open]);
  // The page makes room only while he is on show.
  useEffect(() => {
    document.documentElement.classList.toggle(OPEN_CLASS, shown);
    return () => document.documentElement.classList.remove(OPEN_CLASS);
  }, [shown]);
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [shown]);
  const width = useSolWidth();
  return (
    <>
      {open && tucked && (
        <button
          type="button"
          onClick={() => setTucked(false)}
          aria-label="Bring Sol back"
          title="Bring Sol back"
          className="sol-tab fixed bottom-28 right-0 z-40 flex items-center gap-1.5 rounded-l-2xl bg-[#3a3d43] py-2 pl-2 pr-1.5 shadow-[0_6px_24px_rgba(20,22,26,0.22)] transition-[padding] hover:pr-3 print:hidden"
        >
          <SolMark className="size-7" />
        </button>
      )}
      <aside
        aria-label="Sol"
        aria-hidden={!shown}
        className={clsx(
          "fixed inset-y-0 right-0 z-50 w-full border-l border-line bg-surface transition-transform duration-300 motion-reduce:transition-none print:hidden lg:z-40 lg:w-[var(--sol-w)]",
          shown
            ? "translate-x-0 shadow-2xl min-[1440px]:shadow-[-8px_0_30px_rgba(20,22,26,0.06)]"
            : "pointer-events-none invisible translate-x-full",
        )}
      >
        {shown && (
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
        {open && (
          <SolChat
            side
            question={question}
            onClose={() => {
              setTucked(false);
              setOpen(false);
            }}
            onMinimise={() => setTucked(true)}
          />
        )}
      </aside>
    </>
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
export function useSolOpen(): boolean {
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
 * `phone` is the foot bar's raised round. Since 20 Nov 2026 (Martin: "I want Sol to move into the Floating bar and
 * replace the chat icon") his round heads the floating bar on the right (`rail`: standing out of its top, as team
 * chat's did), and on the design tool, where that bar is put away, a small one sits in the top card (`small`).
 */
export function SolNavButton({ phone = false, rail = false, small = false }: { phone?: boolean; rail?: boolean; small?: boolean }) {
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
        // On the bar he is a bulb: wider than the bar and standing out of its top, as team chat's round used to
        // (20 Nov 2026, Martin: "lets make the Sol brain larger so sits like a bulb (like the chat used to)").
        small ? "size-10" : rail ? "-mx-3 -mt-7 mb-0.5 size-[4.5rem]" : phone ? "size-12" : "-my-2 size-12",
      )}
    >
      {/* No rays (3 Nov 2026, Martin): the sun itself beats like a heart, a subtle signal to engage. No ring when his
          panel is open and no stars (18 Nov 2026, Martin: "lose its halo ring and resemble the same as the sol icon in
          the right hand chat"). */}
      <span className="sol-heartbeat inline-flex">
        <SolMark
          className={clsx(
            "transition-transform duration-300 group-hover:scale-110",
            small ? "size-8" : rail ? "size-10" : phone ? "size-10" : "size-[38px]",
          )}
        />
      </span>
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
  routines,
}: {
  team?: React.ReactNode;
  assistant?: React.ReactNode;
  routines?: React.ReactNode;
}) {
  // The floating bar, half way down the right, as it was (14 Nov 2026, Martin: the loose rounds in the corner were
  // tried the same day and he didn't like them: "I want the old look and positioning of the floating bar… with just
  // the chat and the 2 agents"). It holds only who you talk to: team chat and the business's agents. The tools that
  // used to sit under them stay where they went: the calculator and email in the top card, the proposals in the CRM.
  // Sol heads it, in team chat's old place, and team chat sits under the bar on its own (20 Nov 2026, Martin: "I want
  // Sol to move into the Floating bar and replace the chat icon. im thinking the chat icon will sit below the floating
  // bar on its own").
  // Slim and graphite, with team chat in its foot (20 Nov 2026, Martin, from the mock-ups: "my pick is actually A - but
  // instead of the bar being white it should be black/graphite like B"; the chat under the bar "feels like something
  // that was put there for lack of a better idea"). No names under the rounds: each says who it is on hover.
  return (
    <aside
      aria-label="Who you talk to: Sol, your agents and your team"
      className="sol-rail fixed right-4 top-1/2 z-30 hidden w-[3.25rem] -translate-y-1/2 flex-col items-center gap-3 print:hidden lg:flex"
    >
      <div className="glass-rail relative flex w-full flex-col items-center gap-2.5 rounded-full px-1.5 py-1.5">
        <SolNavButton rail />
        {assistant && <span className="h-px w-6 bg-white/15" aria-hidden />}
        {/* The business's agents (rail-agents.tsx). */}
        {assistant}
        {team && (
          <>
            <span className="h-px w-6 bg-white/15" aria-hidden />
            <span className="team-in-rail">{team}</span>
          </>
        )}
      </div>
      {/* Routines float under the bar, held to it by a bridge (routines-round.tsx). */}
      {routines}
    </aside>
  );
}
