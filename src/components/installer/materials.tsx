"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { MATERIAL_GROUPS, materialsCsv, materialsText, type MaterialLine } from "@/lib/domain/materials";

type Line = MaterialLine & { jobs?: string[] };

/** Copy the list as text, or download it as a CSV for the supplier. */
export function MaterialsActions({ lines, filename }: { lines: Line[]; filename: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(materialsText(lines));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([materialsCsv(lines)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:flex">
      <Button size="sm" variant="secondary" onClick={() => void copy()} disabled={!lines.length}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy list"}
      </Button>
      <Button size="sm" variant="secondary" onClick={download} disabled={!lines.length}>
        <Download className="h-4 w-4" /> Download CSV
      </Button>
    </div>
  );
}

/** The products, grouped as they're ordered. */
export function MaterialsList({ lines }: { lines: Line[] }) {
  return (
    <div className="space-y-5">
      {MATERIAL_GROUPS.map((g) => {
        const items = lines.filter((l) => l.group === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id}>
            <h3 className="text-[12px] font-medium uppercase tracking-wider text-muted">{g.label}</h3>
            <ul className="mt-1 divide-y divide-line">
              {items.map((l) => (
                <li key={l.sku} className="flex items-start gap-3 py-2.5">
                  <span className="w-12 shrink-0 text-right text-[17px] tabular-nums">{l.qty}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] leading-snug">{l.name}</span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {l.sku}
                      {l.note ? ` · ${l.note}` : ""}
                      {l.jobs ? ` · ${l.jobs.join(", ")}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export const MATERIALS_NOTE = "Worked out from the system and the site notes. Check against the final design before ordering.";

/** A job's materials, for the job workspace. */
export function JobMaterials({ reference, lines }: { reference: string; lines: MaterialLine[] }) {
  return (
    <div>
      <p className="text-[13px] text-muted">{MATERIALS_NOTE}</p>
      <div className="mt-4">
        <MaterialsList lines={lines} />
      </div>
      <div className="mt-5">
        <MaterialsActions lines={lines} filename={`${reference}-materials.csv`} />
      </div>
    </div>
  );
}
