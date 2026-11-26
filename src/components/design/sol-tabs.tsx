"use client";

/**
 * Sol's chats kept as tabs (domain/design/sol-tabs.ts, 26 Nov 2026, Martin): a chat minimised on Today waits here, as
 * a web browser's tab, while you carry on elsewhere. On Today and Sol's page, where the left side is empty on a wide
 * screen, they stand there as a column; on every other page, or a narrower screen, they fold into one round on the
 * left edge (its count, pulsing while Sol is still writing, lit when an answer is ready), opening over the page.
 */
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { tabWords, tabsGlance, type SolTab } from "@/lib/domain/design/sol-tabs";
import { OPEN_SOL_TAB, dropTab, useSolTabs } from "@/lib/services/sol-tabs";
import { SolBadge } from "./sol-sun";

/** The pages with room on the left for the column. */
const ROOMY = new Set(["/design", "/design/sol"]);

export function SolTabs() {
  const tabs = useSolTabs();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  // The folded list closes on Escape, a press outside or a change of page.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const press = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", press);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", press);
    };
  }, [open]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new page folds the list away
    setOpen(false);
  }, [path]);
  if (!tabs.length) return null;

  const go = (tab: SolTab) => {
    setOpen(false);
    if (path === "/design") window.dispatchEvent(new CustomEvent(OPEN_SOL_TAB, { detail: tab.id }));
    else router.push(`/design?soltab=${encodeURIComponent(tab.id)}`);
  };
  const glance = tabsGlance(tabs);
  const roomy = ROOMY.has(path ?? "");

  return (
    <div ref={box} className="theme-studio contents print:hidden">
      {roomy && (
        <nav
          aria-label="Sol's chats"
          className="fixed left-[4.75rem] top-[calc(var(--studio-head,8rem)+1.5rem)] z-20 hidden w-44 space-y-2 min-[1600px]:block"
        >
          <p className="pl-1 font-mono text-[10.5px] tracking-[0.16em] text-muted">TABS</p>
          {tabs.map((t) => (
            <TabCard key={t.id} tab={t} now={now} onOpen={() => go(t)} />
          ))}
        </nav>
      )}
      <div className={clsx("fixed left-0 top-[42%] z-30", roomy && "min-[1600px]:hidden")}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Sol's chats: ${glance.count}${glance.ready ? ", an answer is ready" : glance.writing ? ", Sol is writing" : ""}`}
          title="Sol's chats"
          className={clsx(
            "relative grid size-10 place-items-center rounded-r-full bg-primary shadow-lift transition",
            glance.ready && "ring-2 ring-sun-line",
          )}
        >
          {glance.writing && <span className="absolute inset-0 animate-ping rounded-r-full bg-sun-line/30" aria-hidden />}
          <SolBadge className="relative size-5" />
          <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-sun-line px-1 text-[10.5px] font-semibold leading-[18px] text-white">
            {glance.count}
          </span>
        </button>
        {open && (
          <div className="absolute left-12 top-1/2 w-52 -translate-y-1/2 space-y-2 rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line">
            {tabs.map((t) => (
              <TabCard key={t.id} tab={t} now={now} onOpen={() => go(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabCard({ tab, now, onOpen }: { tab: SolTab; now: number; onOpen: () => void }) {
  const ready = tab.status === "ready";
  return (
    <div
      className={clsx(
        "group relative rounded-xl bg-surface shadow-[0_4px_16px_-10px_rgb(20_22_26_/_0.35)] transition hover:ring-ink/30",
        ready ? "ring-[1.5px] ring-sun-line" : "ring-1 ring-line",
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full px-3 py-2 pr-7 text-left">
        <span className="flex items-center gap-2">
          <SolBadge className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{tab.title}</span>
          {ready && <span className="size-2 shrink-0 rounded-full bg-sun-line" aria-hidden />}
        </span>
        <span className={clsx("mt-1 flex items-center gap-1 text-[11.5px]", ready ? "text-ink" : "text-muted")}>
          {tab.status === "writing" && <Loader2 className="size-3 animate-spin" aria-hidden />}
          {tabWords(tab, now)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => dropTab(tab.id)}
        aria-label={`Close ${tab.title}`}
        title="Close this tab (the chat stays in Sol's history)"
        className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full text-muted opacity-0 transition hover:bg-surface-2 hover:text-ink focus:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
}
