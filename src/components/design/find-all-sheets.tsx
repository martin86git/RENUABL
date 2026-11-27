"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Square } from "lucide-react";
import clsx from "clsx";
import { chargersOf, workspaceCatalogue } from "@/lib/domain/design/pricing";
import { DOC_KIND_WORDS } from "@/lib/domain/design/proposal-datasheets";
import {
  FIND_BATCH,
  FIND_RESULT_WORDS,
  sheetsToFind,
  type FindResult,
  type ListedProduct,
  type ToFind,
} from "@/lib/domain/design/find-all-sheets";
import { findSheetBatch, loadDatasheets } from "@/lib/services/datasheets";
import { loadWorkspace } from "@/lib/services/design-store";
import { ui } from "./design-shell";

type Done = ToFind & { outcome: FindResult };

/**
 * Settings → Product datasheets → Find every datasheet (26 Nov 2026, Martin): every product on the business's price
 * lists with no sheet on hand (panels, inverters, batteries, EV chargers) looked for online, a couple at a time, the
 * Australian version first. Figures found are kept marked to check, as any sheet found online.
 */
export function FindAllSheets(props: { mayChange: boolean; onFound: () => void }) {
  const [products, setProducts] = useState<ListedProduct[] | null>(null);
  const [onHand, setOnHand] = useState<{
    sheets: { kind: ListedProduct["kind"]; sku: string; hasFile?: boolean }[];
    files: { kind: ListedProduct["kind"]; sku: string }[];
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<Done[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useRef(false);

  const readOnHand = useCallback(
    () =>
      loadDatasheets().then((res) => {
        if (res.ok) setOnHand({ sheets: res.sheets, files: res.files ?? [] });
      }),
    [],
  );
  useEffect(() => {
    void readOnHand();
    void loadWorkspace()
      .then((w) => {
        const c = workspaceCatalogue(w);
        setProducts([
          ...(c.panels ?? []).map((p) => ({ kind: "panel" as const, sku: p.sku, name: p.name })),
          ...(c.inverters ?? []).map((p) => ({ kind: "inverter" as const, sku: p.sku, name: p.name })),
          ...(c.batteries ?? []).map((p) => ({ kind: "battery" as const, sku: p.sku, name: p.name })),
          ...chargersOf(w).map((p) => ({ kind: "charger" as const, sku: p.sku, name: p.name })),
        ]);
      })
      .catch(() => setProducts([]));
  }, [readOnHand]);

  const toFind = useMemo(() => (products && onHand ? sheetsToFind(products, onHand.sheets, onHand.files) : null), [products, onHand]);
  // What this run hasn't looked at yet: one not found isn't looked for again until the page is opened again.
  const left = useMemo(() => {
    const tried = new Set(done.map((d) => `${d.kind}:${d.sku}`));
    return (toFind ?? []).filter((p) => !tried.has(`${p.kind}:${p.sku}`));
  }, [toFind, done]);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setProblem(null);
    let queue = [...left];
    while (queue.length && !stop.current) {
      const batch = queue.slice(0, FIND_BATCH);
      queue = queue.slice(FIND_BATCH);
      const res = await findSheetBatch(batch.map(({ kind, sku, name, gap }) => ({ kind, sku, name, swap: gap === "not-au" })));
      if (!res.ok) {
        setProblem(res.message);
        break;
      }
      const got = batch.map((p) => ({
        ...p,
        outcome: res.results.find((r) => r.sku === p.sku && r.kind === p.kind)?.outcome ?? "not-found",
      }));
      setDone((d) => [...d, ...got]);
      if (got.some((g) => g.outcome === "off")) {
        setProblem(FIND_RESULT_WORDS.off);
        break;
      }
      if (got.some((g) => g.outcome === "found" || g.outcome === "kept-already" || g.outcome === "replaced")) props.onFound();
    }
    setRunning(false);
    void readOnHand();
  };

  if (!toFind) return null;
  const found = done.filter((d) => d.outcome === "found" || d.outcome === "kept-already").length;
  const missed = done.filter((d) => d.gap !== "not-au" && (d.outcome === "not-found" || d.outcome === "not-read"));
  const swapped = done.filter((d) => d.outcome === "replaced").length;
  const stillForeign = done.filter((d) => d.gap === "not-au" && d.outcome !== "replaced" && d.outcome !== "off");
  const toSwap = left.filter((p) => p.gap === "not-au").length;
  const toLook = left.length - toSwap;
  const total = done.length + left.length;
  if (!total) {
    return (
      <section className={clsx(ui.card, "mt-5 p-5")}>
        <p className="text-sm font-medium text-ink">Every product on your price lists has its datasheet.</p>
      </section>
    );
  }

  return (
    <section className={clsx(ui.card, "mt-5 p-5")} aria-label="Find every datasheet">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-ink">
            {left.length
              ? [
                  toLook
                    ? `${toLook} product${toLook === 1 ? "" : "s"} on your price lists ${toLook === 1 ? "has" : "have"} no datasheet yet`
                    : "",
                  toSwap
                    ? `${toSwap} sheet${toSwap === 1 ? "" : "s"} found online ${toSwap === 1 ? "isn't" : "aren't"} the Australian version`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Looked for every one"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            RENUABL looks for each maker&apos;s own datasheet for that exact model, the Australian version first, and keeps it. Panel and
            inverter figures found this way are marked to check until someone confirms them below. A sheet found before from a link that
            isn&apos;t Australia&apos;s is swapped only when an Australian one is found. Each takes up to a minute.
          </p>
        </div>
        {props.mayChange &&
          (running ? (
            <button className={ui.quiet} onClick={() => (stop.current = true)}>
              <Square className="size-4" aria-hidden /> Stop after these
            </button>
          ) : (
            left.length > 0 && (
              <button className={ui.primary} onClick={() => void run()}>
                <Globe className="size-4" aria-hidden />{" "}
                {done.length ? `Carry on · ${left.length} to go` : `Find all ${left.length} online`}
              </button>
            )
          ))}
      </div>
      {!props.mayChange && <p className="mt-2 text-xs text-muted">Someone who can change prices and settings can run this.</p>}

      {done.length > 0 && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done.length} aria-valuemax={total}>
            <div className="h-full bg-sun-line transition-[width]" style={{ width: `${(done.length / total) * 100}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-ink-2" aria-live="polite">
            {running ? "Looking… " : ""}
            {done.length} of {total} looked for · {found} kept{swapped ? ` · ${swapped} swapped for Australia's` : ""} · {missed.length} not
            found
          </p>
        </div>
      )}
      {problem && <p className="mt-2 text-sm text-danger">{problem}</p>}

      {missed.length > 0 && !running && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[13px] font-medium text-ink">Not found online: upload these by hand</p>
          <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
            {missed.map((m) => (
              <li key={`${m.kind}:${m.sku}`}>
                <span className="font-mono text-xs">{m.sku}</span> · {m.name} ({DOC_KIND_WORDS[m.kind].toLowerCase()}) ·{" "}
                <span className="text-muted">{FIND_RESULT_WORDS[m.outcome]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {stillForeign.length > 0 && !running && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[13px] font-medium text-ink">No Australian sheet found: the one on file is kept</p>
          <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
            {stillForeign.map((m) => (
              <li key={`${m.kind}:${m.sku}`}>
                <span className="font-mono text-xs">{m.sku}</span> · {m.name} ({DOC_KIND_WORDS[m.kind].toLowerCase()})
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
