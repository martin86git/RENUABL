"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import type { DealLine } from "@/lib/domain/design/deal-team";
import { notePoints } from "@/lib/domain/design/deal-note";
import { loadDealAsk, markAskDone } from "@/lib/services/deal-team";

/**
 * The deal note over the designer (18 Nov 2026, Martin: Sol's brief was "a big dump of text", overlapped by the map's
 * controls; it should lie over everything and fold away to refer back to, say only what matters, and carry a label of
 * its own as Context does). Opened from "Open the designer with this brief" in a deal's team chat
 * (`/design/roof?job=…&ask=…`): a cyan **Deal note** tag, the few facts that bear on the design (deal-note.ts), Mark
 * done, and where they came from folded under it. As it first appears the page is dimmed to bring it forward; any
 * press or key lifts the dim. The minus folds it to a small tag bottom left, pressed to open it again.
 */
export function DesignBrief({ jobId, askId }: { jobId: string; askId: string }) {
  const [line, setLine] = useState<DealLine | null>(null);
  const [closed, setClosed] = useState(false);
  const [small, setSmall] = useState(false);
  const [dim, setDim] = useState(true);
  const [source, setSource] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let live = true;
    void loadDealAsk(jobId, askId).then((r) => {
      if (live && r.ok) {
        setLine(r.line);
        setDone(Boolean(r.line.ask?.done));
      }
    });
    return () => {
      live = false;
    };
  }, [jobId, askId]);
  // Focus mode lasts until anything is pressed: a click anywhere, or a key.
  useEffect(() => {
    if (!dim || !line?.ask) return;
    const lift = () => setDim(false);
    window.addEventListener("pointerdown", lift, true);
    window.addEventListener("keydown", lift, true);
    return () => {
      window.removeEventListener("pointerdown", lift, true);
      window.removeEventListener("keydown", lift, true);
    };
  }, [dim, line?.ask]);
  if (!line?.ask || closed || typeof document === "undefined") return null;
  const points = notePoints(line.ask.why);
  const shown = points.length ? points : [line.ask.want];
  const tag = (
    <span className="rounded-md bg-note-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-note">
      Deal note
    </span>
  );

  return createPortal(
    <div className="theme-studio contents">
      {dim && !small && <div className="fixed inset-0 z-[290] bg-ink/25 transition-opacity motion-reduce:transition-none" aria-hidden />}
      {small ? (
        <button
          type="button"
          onClick={() => setSmall(false)}
          aria-label="Open the deal note"
          className="fixed bottom-5 left-5 z-[300] flex max-w-[min(26rem,calc(100vw-2.5rem))] items-center gap-2 rounded-full bg-surface py-1.5 pl-2 pr-3.5 shadow-lift ring-1 ring-note/40 hover:ring-note"
        >
          {tag}
          <span className="truncate text-[13px] text-ink-2">{shown.join(" · ")}</span>
        </button>
      ) : (
        <aside
          className="fixed bottom-5 left-5 z-[300] w-[22rem] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-surface p-4 shadow-lift ring-2 ring-note/50"
          aria-label="Deal note"
        >
          <div className="flex items-center gap-1">
            {tag}
            <button
              type="button"
              aria-label="Fold the deal note away"
              title="Fold away"
              onClick={() => {
                setSmall(true);
                setDim(false);
              }}
              className="ml-auto rounded-full p-1 text-muted hover:text-ink"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Close the deal note"
              onClick={() => setClosed(true)}
              className="rounded-full p-1 text-muted hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {shown.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[15px] font-medium leading-snug text-ink">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-note" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          {line.ask.why.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setSource((s) => !s)}
                aria-expanded={source}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink"
              >
                <ChevronDown className={clsx("size-3.5 transition-transform", source && "rotate-180")} aria-hidden />
                Where this came from
              </button>
              {source && (
                <ul className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto">
                  {line.ask.why.map((q, i) => (
                    <li key={i} className="border-l-2 border-note/40 pl-2.5 text-[12px] leading-snug text-ink-2">
                      {q.text} <span className="text-muted">({q.where})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-3.5 flex items-center gap-2">
            {done ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-positive">
                <Check className="size-3.5" /> Marked done
              </span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const r = await markAskDone(jobId, askId);
                  if (r.ok) setDone(true);
                }}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-[12.5px] font-medium text-primary-ink hover:brightness-110"
              >
                <Check className="size-3.5" /> Mark done
              </button>
            )}
          </div>
        </aside>
      )}
    </div>,
    document.body,
  );
}
