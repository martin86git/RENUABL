"use client";

import { Loader2, RotateCcw, ScanSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { House3d } from "@/components/ui/house-3d";
import { RoofDesigner } from "@/components/ui/roof-designer";
import { PANEL } from "@/lib/domain/catalogue";
import { assumedArrays } from "@/lib/domain/costing";
import { blockedSlots, type ObstructionCheck } from "@/lib/domain/obstructions";
import { autoLayout, designView, layoutArrays, layoutYearlyKwh, toggleSlot } from "@/lib/domain/roof-layout";
import type { JobDesign } from "@/lib/services/installer";
import { checkRoof, saveLayout } from "@/lib/services/accounts";

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
  const [check, setCheck] = useState<ObstructionCheck | null>(design.obstructions);
  const [checking, setChecking] = useState(false);
  const blocked = check ? blockedSlots(design.model, designView(design.centre), check.items) : [];
  const inTheWay = selected.filter((i) => blocked.includes(i));
  const arrays = layoutArrays(design.model, selected);
  const kw = Math.round(selected.length * PANEL.watts) / 1000;
  const dirty = JSON.stringify(selected) !== JSON.stringify(savedSlots ?? auto);

  async function runCheck() {
    setChecking(true);
    setProblem(null);
    const r = await checkRoof(recordKey);
    setChecking(false);
    if (r.ok) setCheck(r.check);
    else setProblem(r.message);
  }

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
        obstructions={check?.items}
        flagged={blocked}
      />
      {check && (
        <div className="mt-3 rounded-xl border border-line p-3 text-[13.5px]">
          <p className="text-ink-2">
            <span className="font-medium text-ink">Roof check:</span> {check.summary || "Done."}{" "}
            {check.items.length ? `Found ${check.items.map((o) => o.note || o.type).join("; ")}.` : "Nothing in the way was found."}
          </p>
          {inTheWay.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-warning">
                {inTheWay.length} panel{inTheWay.length > 1 ? "s" : ""} (outlined amber) sit on or next to something.
              </span>
              <Button size="sm" variant="secondary" onClick={() => setSelected((s) => s.filter((i) => !blocked.includes(i)))}>
                Remove them
              </Button>
            </div>
          )}
          <p className="mt-1.5 text-[12px] text-muted">From the satellite image: a helper, not a site inspection. Confirm on the roof.</p>
        </div>
      )}
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
        <Button size="sm" variant="secondary" onClick={() => setSelected(auto.filter((i) => !blocked.includes(i)))} disabled={busy}>
          <RotateCcw className="h-4 w-4" /> Auto-layout
        </Button>
        {design.canCheck && (
          <Button size="sm" variant="secondary" onClick={() => void runCheck()} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}{" "}
            {check ? "Check again" : "Check for obstructions"}
          </Button>
        )}
      </div>
      <div className="mt-4">
        <House3d at={design.centre} label="3D view of the house" />
      </div>
    </div>
  );
}
