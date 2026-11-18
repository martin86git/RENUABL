"use client";

import { ShoppingCart, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HAND_LIST, cleanHandPrice, pricesWanted } from "@/lib/domain/design/hand-prices";
import type { Workspace } from "@/lib/domain/design/pricing";
import type { CostLine } from "@/lib/domain/design/quote";
import { addPriceList, readPriceListFile, setHandPrices } from "@/lib/services/price-lists";

/**
 * The quote builder's cart (18 Nov 2026, Martin: "a shopping cart icon somewhere in the quote builder that allows us to
 * upload our price lists, or a price when we don't have them"): upload a supplier's list, or set a price for each part
 * with none on file, there and then. Both are kept for every quote (`hand-prices.ts`); typing over a line changes this
 * quote only.
 */
export function PriceCart(props: {
  workspace: Workspace;
  /** The quote's lines as worked out, before hand changes: the ones with no cost on file are asked for. */
  lines: readonly CostLine[];
  /** The workspace once a list or a price is kept, so the quote is costed with it at once. */
  onWorkspace?: (next: Workspace) => void;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const wanted = pricesWanted(props.lines);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const { onOpen } = props;
  useEffect(() => {
    if (!props.open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [props.open, onOpen]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setSaid(null);
    let ws = props.workspace;
    const done: string[] = [];
    const problems: string[] = [];
    for (const f of files) {
      const read = await readPriceListFile(f);
      if ("problem" in read) {
        problems.push(read.problem);
        continue;
      }
      const kept = await addPriceList(ws, read.list);
      if (kept.problem) problems.push(kept.problem);
      else {
        ws = kept.workspace;
        done.push(`${read.list.name} (${read.list.items.length} prices)`);
      }
    }
    if (ws !== props.workspace) props.onWorkspace?.(ws);
    setSaid([done.length ? `Added ${done.join(", ")}.` : "", ...problems].filter(Boolean).join(" "));
    setBusy(false);
  };

  const ready = wanted.flatMap((w) => {
    const cost = cleanHandPrice(typed[w.sku] ?? "");
    return cost === null ? [] : [{ sku: w.sku, name: w.name, cost }];
  });
  const keep = async () => {
    if (!ready.length) return;
    setBusy(true);
    const kept = await setHandPrices(props.workspace, ready);
    setBusy(false);
    if (kept.problem) return setSaid(kept.problem);
    props.onWorkspace?.(kept.workspace);
    setTyped({});
    setSaid(`Kept ${ready.length === 1 ? "1 price" : `${ready.length} prices`} for every quote.`);
  };

  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        onClick={() => props.onOpen(!props.open)}
        aria-expanded={props.open}
        aria-label="Prices: upload a price list or set a price"
        title="Prices: upload a price list or set a price"
        className="relative flex size-8 items-center justify-center rounded-full text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-2"
      >
        <ShoppingCart className="size-4" aria-hidden />
        {wanted.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold tabular-nums text-white">
            {wanted.length}
          </span>
        )}
      </button>
      {props.open && (
        <div
          role="dialog"
          aria-label="Prices"
          className="absolute right-0 top-10 z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl bg-surface p-4 text-left shadow-[0_16px_40px_rgba(11,11,12,0.18)] ring-1 ring-line"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Prices</p>
            <button type="button" onClick={() => props.onOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Upload a price list</p>
          <p className="mt-1 text-xs text-ink-2">An Excel or CSV list from your wholesaler: a product code, a description and a price.</p>
          <input
            ref={file}
            type="file"
            multiple
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void upload(files);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => file.current?.click()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink hover:brightness-110 disabled:bg-line disabled:text-muted"
          >
            <Upload className="size-3.5" aria-hidden />
            {busy ? "Working…" : "Choose a file"}
          </button>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Or set a price</p>
          {wanted.length ? (
            <>
              <p className="mt-1 text-xs text-ink-2">Each, ex GST. Kept for every quote, under {HAND_LIST} in your settings.</p>
              <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {wanted.map((w) => (
                  <li key={w.sku} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{w.name}</span>
                      <span className="block truncate text-[11px] text-muted">{w.sku}</span>
                    </span>
                    <span className="inline-flex items-center rounded-md px-1.5 ring-1 ring-line focus-within:ring-forest">
                      <span className="text-xs text-muted">$</span>
                      <input
                        inputMode="decimal"
                        value={typed[w.sku] ?? ""}
                        onChange={(e) => setTyped({ ...typed, [w.sku]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && void keep()}
                        placeholder="0.00"
                        aria-label={`Price each for ${w.name}`}
                        className="w-16 bg-transparent py-1 text-right text-[13px] tabular-nums text-ink outline-none"
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || !ready.length}
                onClick={() => void keep()}
                className="mt-3 rounded-full bg-sun-line px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105 disabled:bg-line disabled:text-muted"
              >
                {ready.length ? `Keep ${ready.length === 1 ? "this price" : `${ready.length} prices`}` : "Type a price to keep it"}
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-2">Every part on this quote has a price on file.</p>
          )}
          {said && (
            <p className="mt-3 text-xs text-ink-2" role="status">
              {said}
            </p>
          )}
          <Link href="/design/settings" className="mt-3 block text-xs text-muted underline underline-offset-2 hover:text-ink">
            All price lists and part costs in Settings
          </Link>
        </div>
      )}
    </span>
  );
}
