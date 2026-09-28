"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { RoofDesigner } from "@/components/ui/roof-designer";
import { PANEL } from "@/lib/domain/catalogue";
import { assumedArrays } from "@/lib/domain/costing";
import { autoLayout, layoutArrays, layoutYearlyKwh, toggleSlot } from "@/lib/domain/roof-layout";
import type { JobDesign } from "@/lib/services/installer";
import { saveLayout } from "@/lib/services/accounts";

/**
 * The panel layout for the job: starts from Google's roof model (sunniest spots
 * first); tap a panel to remove it, or a dashed spot to add one, then save.
 * The layout's arrays feed the job's materials list.
 */
export function JobDesignPanel({ recordKey, design, panelCount }: { recordKey: string; design: JobDesign; panelCount: number }) {
  const router = useRouter();
  const auto = autoLayout(design.model, panelCount);
  const [selected, setSelected] = useState<number[]>(design.saved ?? auto);
  const [savedSlots, setSavedSlots] = useState<number[] | null>(design.saved);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const arrays = layoutArrays(design.model, selected);
  const kw = Math.round(selected.length * PANEL.watts) / 1000;
  const dirty = JSON.stringify(selected) !== JSON.stringify(savedSlots ?? auto);

  async function save() {
    setBusy(true);
    setProblem(null);
    const r = await saveLayout(recordKey, selected);
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't save. Try again.");
    setSavedSlots(selected);
    router.refresh();
  }

  return (
    <div>
      <RoofDesigner
        model={design.model}
        centre={design.centre}
        imageSrc={design.imageSrc}
        selected={selected}
        editable
        onToggle={(i) => setSelected((s) => toggleSlot(s, i))}
      />
      <p className="mt-2 text-[12.5px] text-muted">
        Tap a panel to remove it, or a dashed spot to add one. Spots come from Google&apos;s roof model; check setbacks, vents and shading
        on site.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-4">
        <div>
          <dt className="text-[12px] text-muted">Panels</dt>
          <dd className="text-[17px] tabular-nums">
            {selected.length} <span className="text-[13px] text-muted">of {panelCount} sold</span>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Size</dt>
          <dd className="text-[17px] tabular-nums">{kw} kW</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Arrays</dt>
          <dd className="text-[17px] tabular-nums">{arrays}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Google estimate</dt>
          <dd className="text-[17px] tabular-nums">
            {layoutYearlyKwh(design.model, selected, PANEL.watts).toLocaleString("en-AU")}{" "}
            <span className="text-[13px] text-muted">kWh/yr</span>
          </dd>
        </div>
      </dl>
      {selected.length !== panelCount && (
        <p className="mt-3 text-[13px] text-warning">
          The job is sold with {panelCount} panels. A different number changes the system: send the customer a variation first.
        </p>
      )}
      {arrays > assumedArrays(panelCount) && (
        <p className="mt-2 text-[13px] text-warning">
          {arrays} arrays: more than the price allows for ({assumedArrays(panelCount)}). Add the extra array as a variation if it&apos;s
          needed.
        </p>
      )}
      <p className="mt-2 text-[12px] text-muted">The Google estimate is before inverter and wiring losses.</p>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex">
        <Button size="sm" onClick={() => void save()} disabled={busy || !dirty}>
          {savedSlots && !dirty ? "Saved" : "Save layout"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setSelected(auto)} disabled={busy}>
          <RotateCcw className="h-4 w-4" /> Auto-layout
        </Button>
      </div>
    </div>
  );
}
