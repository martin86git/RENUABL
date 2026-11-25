"use client";

/**
 * Two menus on a deal (26 Nov 2026, Martin, from his iPhone: "Remove the delete icon. It's too easily accessed. Perhaps
 * in a drop down menu somewhere"; and the stage on the cover "needs to be inviting in the sense that the deal stage can
 * be adjusted there"). `StageChip`: the stage on the banner as a pill with a chevron that opens the stages to move it
 * to. `DealMoreMenu`: a ⋯ round whose only item for now is Delete deal, asked again before anything goes.
 * Both cards are drawn on the page body (the banner clips what hangs past it), placed under their button.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import type { Job, JobStage } from "@/lib/domain/design/crm";
import { keyOfDeal, moveTo, groupedStageChoices } from "@/lib/domain/design/pipeline-stages";
import { useStageBook, useDealStageLabel } from "./stage-select";

/** A card under a button, kept on screen, closed by a press outside or Escape. */
function Pop({
  anchor,
  onClose,
  align,
  children,
  label,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  align: "left" | "right";
  children: ReactNode;
  label: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const w = card.current?.offsetWidth ?? 240;
      const left = align === "left" ? r.left : r.right - w;
      setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - w - 8)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, align]);
  useEffect(() => {
    const out = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!card.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", out);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", out);
      window.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div className="theme-studio contents">
      <div
        ref={card}
        role="menu"
        aria-label={label}
        style={{ top: at?.top ?? -9999, left: at?.left ?? -9999 }}
        className="fixed z-[95] max-h-[min(70dvh,28rem)] min-w-[15rem] overflow-y-auto rounded-2xl bg-surface p-1.5 text-ink shadow-[0_18px_50px_rgba(11,11,12,0.22)] ring-1 ring-line"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** The deal's stage on the banner, pressed to move it. */
export function StageChip({
  job,
  onChange,
}: {
  job: Pick<Job, "stage" | "subStage">;
  onChange: (change: { stage: JobStage; subStage: string | null }) => void;
}) {
  const { stages: own, names } = useStageBook();
  const words = useDealStageLabel();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const setOpen = (o: boolean) => !o && setAnchor(null);
  const now = keyOfDeal(job, own);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const at = e.currentTarget;
          setAnchor((a) => (a ? null : at));
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change the deal's stage"
        className={clsx(
          "inline-flex h-7 items-center gap-1.5 rounded-full pl-3 pr-2 text-[13px] font-medium text-white ring-1 transition max-sm:h-[24px] max-sm:pl-2.5 max-sm:pr-1.5 max-sm:text-[11px]",
          open ? "bg-sun-line ring-sun-line" : "bg-sun-line/25 ring-sun-line/70 hover:bg-sun-line/40",
        )}
      >
        <span className="size-1.5 rounded-full bg-sun-line ring-2 ring-white/70" aria-hidden />
        {words(job)}
        <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <Pop anchor={anchor} onClose={() => setOpen(false)} align="left" label="Move the deal to">
          <p className="px-2.5 pb-1 pt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Move the deal to</p>
          {groupedStageChoices(own, names).map((g) => (
            <div
              key={g.name}
              role="group"
              aria-label={g.name}
              className="mt-1 border-t border-line pt-1 first-of-type:mt-0 first-of-type:border-t-0"
            >
              <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-semibold text-ink-2">{g.name}</p>
              {g.choices.map((c) => {
                const on = c.key === now;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => {
                      setOpen(false);
                      if (on) return;
                      const to = moveTo(c.key, own);
                      if (to) onChange(to);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-xl py-2 pr-2.5 text-left text-sm",
                      c.added ? "pl-7 text-ink-2" : "pl-2.5",
                      on ? "bg-sun font-medium text-sun-ink" : "hover:bg-canvas",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {on && <Check className="size-4 shrink-0 text-sun-line" aria-hidden />}
                  </button>
                );
              })}
            </div>
          ))}
        </Pop>
      )}
    </>
  );
}

/** A ⋯ round holding what shouldn't be one tap away: deleting the deal. */
export function DealMoreMenu({ onDelete, tone = "dark" }: { onDelete: () => void; tone?: "dark" | "light" }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const setOpen = (o: boolean) => !o && setAnchor(null);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const at = e.currentTarget;
          setAnchor((a) => (a ? null : at));
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More for this deal"
        title="More"
        className={clsx(
          "flex size-9 items-center justify-center rounded-full ring-1 transition",
          tone === "dark"
            ? open
              ? "bg-white text-ink ring-white"
              : "bg-white/10 text-white ring-white/15"
            : open
              ? "bg-primary text-primary-ink ring-primary"
              : "bg-surface text-ink-2 ring-line hover:text-ink",
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <Pop anchor={anchor} onClose={() => setOpen(false)} align="right" label="More for this deal">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" aria-hidden /> Delete deal
          </button>
        </Pop>
      )}
    </>
  );
}
