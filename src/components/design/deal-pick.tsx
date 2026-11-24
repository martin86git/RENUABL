"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, SquareKanban, X } from "lucide-react";
import clsx from "clsx";
import { matches } from "@/lib/domain/design/find";
import type { JobLine } from "@/lib/services/crm";

/**
 * Choosing a deal in RENUABL's own look, not the phone's own picker (25 Nov 2026, Martin: "Make menu native", on the
 * install calendar's Tentative entry): a field like the form's others that opens a list in place under it, a search at
 * its top (customer, address or deal; nothing typed lists them all), each deal its customer over its street, and
 * "No deal yet" first. Escape or a press outside folds it.
 */
export function DealPick({
  deals,
  value,
  onChange,
  none = "No deal yet",
}: {
  deals: readonly JobLine[] | null;
  value: string | null;
  onChange: (id: string | null) => void;
  none?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const chosen = deals?.find((d) => d.id === value) ?? null;
  const street = (d: JobLine) => (d.address || d.title).split(",")[0];
  const shown = (deals ?? []).filter((d) => !q.trim() || matches({ words: [d.customerName, d.address, d.title] }, q));
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className="relative mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex w-full items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-left text-sm",
          open ? "border-ink-2" : "border-line",
        )}
      >
        <SquareKanban className={clsx("size-4 shrink-0", chosen ? "text-sun-line" : "text-muted")} aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {chosen ? (
            <>
              <span className="font-medium text-ink">{chosen.customerName}</span>
              <span className="text-muted"> · {street(chosen)}</span>
            </>
          ) : (
            <span className="text-muted">{deals ? none : "Loading deals…"}</span>
          )}
        </span>
        <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="mt-1.5 overflow-hidden rounded-xl bg-surface shadow-[0_10px_30px_rgba(0,0,0,0.12)] ring-1 ring-line">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer or address"
              aria-label="Search deals"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-muted hover:text-ink">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <ul role="listbox" aria-label="Deals" className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {!q.trim() && (
              <Row on={!value} onPick={() => pick(null)}>
                <span className="text-ink-2">{none}</span>
              </Row>
            )}
            {shown.map((d) => (
              <Row key={d.id} on={d.id === value} onPick={() => pick(d.id)}>
                <span className="block truncate font-medium text-ink">{d.customerName}</span>
                <span className="block truncate text-[12px] text-muted">{street(d)}</span>
              </Row>
            ))}
            {deals && q.trim() && !shown.length && <li className="px-3 py-3 text-sm text-muted">No deal matches “{q.trim()}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ on, onPick, children }: { on: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <li role="option" aria-selected={on}>
      <button
        type="button"
        onClick={onPick}
        className={clsx("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas", on && "bg-canvas")}
      >
        <span className="min-w-0 flex-1">{children}</span>
        {on && <Check className="size-4 shrink-0 text-sun-line" aria-hidden />}
      </button>
    </li>
  );
}
