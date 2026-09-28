"use client";

import { Loader2, Minus, Plus, RectangleHorizontal, ScanSearch, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { House3d } from "@/components/ui/house-3d";
import { PanelPlanner } from "@/components/ui/panel-planner";
import { PANEL } from "@/lib/domain/catalogue";
import { assumedArrays } from "@/lib/domain/costing";
import { boxPixels, OBSTRUCTION_SETBACK_M, type ObstructionCheck } from "@/lib/domain/obstructions";
import { nextPanel, normaliseRotation, panelsInBoxes, planArrays, type PlacedPanel } from "@/lib/domain/panel-plan";
import { designView, metresPerPixel } from "@/lib/domain/roof-layout";
import type { JobDesign } from "@/lib/services/installer";
import { checkRoof, saveLayout } from "@/lib/services/accounts";

const ZOOMS = [16, 24, 32, 48];

/**
 * The panel layout, placed by hand on the satellite photo: add panels from
 * the tray (each new one lands beside the last), drag them into place (they
 * snap beside a neighbour), turn them with the round handle or the buttons,
 * remove the selected one, then save. The layout's arrays feed the materials list.
 */
export function JobDesignPanel({ recordKey, design, panelCount }: { recordKey: string; design: JobDesign; panelCount: number }) {
  const router = useRouter();
  const [panels, setPanels] = useState<PlacedPanel[]>(design.plan ?? []);
  const [saved, setSaved] = useState<PlacedPanel[] | null>(design.plan);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(2);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [check, setCheck] = useState<ObstructionCheck | null>(design.obstructions);
  const [checking, setChecking] = useState(false);
  const view = designView(design.centre);
  const blocked = check
    ? panelsInBoxes(
        panels,
        view,
        check.items.map((o) => boxPixels(o, view)),
        OBSTRUCTION_SETBACK_M / metresPerPixel(view),
      )
    : [];
  const arrays = planArrays(panels);
  const kw = Math.round(panels.length * PANEL.watts) / 1000;
  const dirty = JSON.stringify(panels) !== JSON.stringify(saved ?? []);
  const current = selected !== null ? panels[selected] : null;

  function add() {
    const base = current ? [...panels.filter((_, i) => i !== selected), current] : panels;
    const next = nextPanel(base, design.centre);
    setPanels([...panels, next]);
    setSelected(panels.length);
  }
  function remove() {
    const i = selected ?? panels.length - 1;
    if (i < 0) return;
    setPanels(panels.filter((_, j) => j !== i));
    setSelected(null);
  }
  function turn(by: number) {
    if (selected === null) return;
    setPanels(panels.map((p, i) => (i === selected ? { ...p, rotation: normaliseRotation(p.rotation + by) } : p)));
  }

  async function runCheck() {
    setChecking(true);
    setProblem(null);
    const r = await checkRoof(recordKey);
    setChecking(false);
    if (r.ok) setCheck(r.check);
    else setProblem(r.message);
  }

  async function save() {
    if (design.sample) {
      setSaved(panels); // the sample portal keeps it on screen only
      return;
    }
    setBusy(true);
    setProblem(null);
    const r = await saveLayout(recordKey, panels);
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't save. Try again.");
    setSaved(panels);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <PanelPlanner
          centre={design.centre}
          imageSrc={design.imageSrc}
          panels={panels}
          onChange={setPanels}
          selected={selected}
          onSelect={setSelected}
          zoomM={ZOOMS[zoom]}
          obstructions={check?.items}
          flagged={blocked}
          className="min-w-0 flex-1"
        />
        {/* The panel tray: add and remove panels, turn the selected one, zoom. */}
        <div className="grid grid-cols-2 gap-2 lg:w-44 lg:grid-cols-1 lg:content-start">
          <p className="col-span-2 text-[14px] lg:col-span-1">
            <span className="text-[20px] tabular-nums">{panels.length}</span>{" "}
            <span className="text-muted">of {panelCount} panels placed</span>
          </p>
          <Button size="sm" onClick={add} disabled={panels.length >= 200}>
            <Plus className="h-4 w-4" /> Add panel
          </Button>
          <Button size="sm" variant="secondary" onClick={remove} disabled={!panels.length}>
            <Minus className="h-4 w-4" /> {selected !== null ? "Remove" : "Remove last"}
          </Button>
          <div className="col-span-2 rounded-xl border border-line p-2 lg:col-span-1">
            <p className="text-[12px] text-muted">{current ? `Selected panel: ${current.rotation}°` : "Tap a panel to turn it"}</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              <Button size="sm" variant="secondary" onClick={() => turn(-15)} disabled={!current} aria-label="Turn 15° anticlockwise">
                −15°
              </Button>
              <Button size="sm" variant="secondary" onClick={() => turn(-1)} disabled={!current} aria-label="Turn 1° anticlockwise">
                −1°
              </Button>
              <Button size="sm" variant="secondary" onClick={() => turn(1)} disabled={!current} aria-label="Turn 1° clockwise">
                +1°
              </Button>
              <Button size="sm" variant="secondary" onClick={() => turn(15)} disabled={!current} aria-label="Turn 15° clockwise">
                +15°
              </Button>
            </div>
            <Button size="sm" variant="secondary" className="mt-1 w-full" onClick={() => turn(90)} disabled={!current}>
              <RectangleHorizontal className="h-4 w-4" /> Turn 90°
            </Button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0}>
            <ZoomIn className="h-4 w-4" /> Zoom in
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zoom === ZOOMS.length - 1}
          >
            <ZoomOut className="h-4 w-4" /> Zoom out
          </Button>
        </div>
      </div>
      {design.sample && (
        <p className="mt-2 text-[12.5px] text-muted">Sample portal: every sample job uses {design.sample}. Layouts aren&apos;t saved.</p>
      )}
      <p className="mt-2 text-[12.5px] text-muted">
        Add panels from the tray, drag them into place (they line up with a neighbour when close), and drag the round handle to turn a
        panel. Drag the photo to look around. Check setbacks, vents and shading on site.
      </p>
      {check && (
        <div className="mt-3 rounded-xl border border-line p-3 text-[13.5px]">
          <p className="text-ink-2">
            <span className="font-medium text-ink">Roof check:</span> {check.summary || "Done."}{" "}
            {check.items.length ? `Found ${check.items.map((o) => o.note || o.type).join("; ")}.` : "Nothing in the way was found."}
          </p>
          {blocked.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-warning">
                {blocked.length} panel{blocked.length > 1 ? "s" : ""} (outlined amber) sit on or next to something.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPanels((list) => list.filter((_, i) => !blocked.includes(i)));
                  setSelected(null);
                }}
              >
                Remove them
              </Button>
            </div>
          )}
          <p className="mt-1.5 text-[12px] text-muted">From the satellite image: a helper, not a site inspection. Confirm on the roof.</p>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-[14px]">
        <div>
          <dt className="text-[12px] text-muted">Panels</dt>
          <dd className="text-[17px] tabular-nums">
            {panels.length} <span className="text-[13px] text-muted">of {panelCount} sold</span>
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
      </dl>
      {panels.length > 0 && panels.length !== panelCount && (
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
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex">
        <Button size="sm" onClick={() => void save()} disabled={busy || !dirty}>
          {saved && !dirty ? "Saved" : "Save layout"}
        </Button>
        {design.canCheck && (
          <Button size="sm" variant="secondary" onClick={() => void runCheck()} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}{" "}
            {check ? "Check again" : "Check for obstructions"}
          </Button>
        )}
      </div>
      <div className="mt-4">
        <House3d at={design.centre} recordKey={recordKey} enabled={design.can3d} label="3D view of the house" />
      </div>
    </div>
  );
}
