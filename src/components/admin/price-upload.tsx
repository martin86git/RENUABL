"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { BIG_PRICE_CHANGE } from "@/lib/domain/price-import";
import { checkPriceList, decidePriceList, type CheckedUpload } from "@/lib/services/prices";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

/**
 * "Upload price list": a supplier's spreadsheet (.xlsx or .csv, prices ex GST)
 * is matched to our products by SKU; staff see every change before applying it.
 */
export function PriceUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [supplier, setSupplier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [checked, setChecked] = useState<CheckedUpload | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function check() {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    setDone(null);
    const r = await checkPriceList(file, supplier);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setChecked(r.upload);
    router.refresh();
  }

  async function decide(action: "apply" | "discard") {
    if (!checked) return;
    setBusy(true);
    const r = await decidePriceList(checked.id, action);
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't work. Please try again.");
    setDone(
      action === "apply"
        ? `Applied: ${checked.changes.length} price${checked.changes.length === 1 ? "" : "s"} updated. The website uses them from now on.`
        : "Discarded. No prices changed.",
    );
    setChecked(null);
    setFile(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="px-5 py-4">
      <p className="text-[13px] text-muted">
        Upload a supplier&apos;s price list (Excel or CSV, prices ex GST). Products are matched by SKU; you see every change before it goes
        live. Products not in the file keep their current price.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[12.5px] text-muted">Supplier</span>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="e.g. AWM Clayton, Tradezone"
            className="mt-1 block h-11 w-64 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink"
          />
        </label>
        <label className="block">
          <span className="text-[12.5px] text-muted">Price list file</span>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setChecked(null);
              setDone(null);
            }}
            className="mt-1 block h-11 text-[13px] text-ink-2 file:mr-3 file:h-11 file:rounded-xl file:border-0 file:bg-surface-2 file:px-4 file:text-ink"
          />
        </label>
        <Button size="sm" disabled={!file || !supplier.trim() || busy} onClick={() => void check()}>
          {busy && !checked ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Check prices
        </Button>
      </div>
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {done && (
        <p className="mt-3 text-[13px] text-positive" role="status">
          {done}
        </p>
      )}

      {checked && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <p className="text-[14px] text-ink">
            {checked.supplier} · {checked.filename}
          </p>
          <p className="text-[13px] text-muted">
            {checked.changes.length} price{checked.changes.length === 1 ? "" : "s"} changed · {checked.unchanged} unchanged
            {checked.notInFile.length ? ` · ${checked.notInFile.length} of our products not in this file (they keep their price)` : ""}
          </p>
          {checked.changes.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-normal">SKU</th>
                    <th className="py-1.5 pr-3 font-normal">Product</th>
                    <th className="py-1.5 pr-3 text-right font-normal">Now</th>
                    <th className="py-1.5 pr-3 text-right font-normal">New</th>
                    <th className="py-1.5 text-right font-normal">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {checked.changes.map((c) => {
                    const big = Math.abs(c.change) >= BIG_PRICE_CHANGE;
                    return (
                      <tr key={c.sku}>
                        <td className="py-1.5 pr-3 font-mono text-[12px]">{c.sku}</td>
                        <td className="py-1.5 pr-3">{c.name}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{money(c.oldCost)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{money(c.newCost)}</td>
                        <td className={cn("py-1.5 text-right tabular-nums", big ? "font-medium text-warning" : "text-ink-2")}>
                          {pct(c.change)}
                          {big ? " · check" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {checked.notInFile.length > 0 && (
            <details className="mt-3 text-[13px] text-muted">
              <summary className="cursor-pointer">Our products not in this file</summary>
              <ul className="mt-1 space-y-0.5">
                {checked.notInFile.map((e) => (
                  <li key={e.sku}>
                    <span className="font-mono text-[12px]">{e.sku}</span> {e.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || checked.changes.length === 0} onClick={() => void decide("apply")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Apply {checked.changes.length} change
              {checked.changes.length === 1 ? "" : "s"}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide("discard")}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
