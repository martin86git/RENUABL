"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { briefLines, type DealLine } from "@/lib/domain/design/deal-team";
import { loadDealAsk, markAskDone } from "@/lib/services/deal-team";
import { SolIcon } from "./sol-icon";

/**
 * Sol's design request as a brief over the designer (deal-team.ts): opened from "Open the designer with this brief" in
 * a deal's team chat (`/design/roof?job=…&ask=…`). What he wants and the customer's words it rests on, with Mark done
 * once the design is drawn. Read from the deal's team chat, only for someone who may see the deal.
 */
export function DesignBrief({ jobId, askId }: { jobId: string; askId: string }) {
  const [line, setLine] = useState<DealLine | null>(null);
  const [closed, setClosed] = useState(false);
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
  if (!line?.ask || closed) return null;
  const [want, ...quotes] = briefLines(line.ask);
  return (
    <aside
      className="fixed bottom-5 left-5 z-40 w-[22rem] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-surface p-4 shadow-[var(--shadow-soft)] ring-1 ring-sun-line/60"
      aria-label="Sol's brief for this design"
    >
      <div className="flex items-center gap-1.5">
        <SolIcon className="size-4 text-sun-line" />
        <p className="text-[13px] font-semibold text-ink">Sol&apos;s brief</p>
        <button
          type="button"
          aria-label="Close the brief"
          onClick={() => setClosed(true)}
          className="ml-auto rounded-full p-1 text-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-2 text-[13.5px] text-ink">{want}</p>
      {quotes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {quotes.map((q, i) => (
            <li key={i} className="border-l-2 border-sun-line/60 pl-2.5 text-[12.5px] leading-snug text-ink-2">
              {q}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
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
        <span className="text-[11.5px] text-muted">Check it against the photo, as always.</span>
      </div>
    </aside>
  );
}
