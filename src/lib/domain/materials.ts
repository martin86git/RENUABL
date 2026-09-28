/**
 * What a partner needs on site for a job: the products from the job's bill of
 * materials (costing.ts), grouped the way they're ordered, without prices or
 * labour. Worked out from the system and site; the final design can change it.
 */
import { BATTERY, BOS, EV_CHARGER, HEAT_PUMP, PANEL, RACKING, type Phase } from "./catalogue";
import { billOfMaterials } from "./costing";
import type { Job, RoofType } from "./types";

export type MaterialGroup = "panels" | "inverter" | "racking" | "battery" | "electrical" | "ev-charger" | "heat-pump";

export const MATERIAL_GROUPS: { id: MaterialGroup; label: string }[] = [
  { id: "panels", label: "Panels" },
  { id: "inverter", label: "Inverter" },
  { id: "battery", label: "Battery" },
  { id: "racking", label: "Racking" },
  { id: "electrical", label: "Electrical and labels" },
  { id: "ev-charger", label: "EV charger" },
  { id: "heat-pump", label: "Heat pump" },
];

export interface MaterialLine {
  sku: string;
  name: string;
  qty: number;
  group: MaterialGroup;
  /** How it's bought, when not one by one (e.g. "4 packs of 100"). */
  note?: string;
}

const RACKING_SKUS = new Set<string>(Object.values(RACKING).map((r) => r.sku));
const BATTERY_SKUS = new Set<string>(Object.values(BATTERY).flatMap((b) => (typeof b === "object" && "sku" in b ? [b.sku] : [])));
const ELECTRICAL_SKUS = new Set<string>(Object.values(BOS).map((b) => b.sku));
const HEAT_PUMP_SKUS = new Set<string>(HEAT_PUMP.map((h) => h.sku));

function groupFor(sku: string): MaterialGroup {
  if (sku === PANEL.sku) return "panels";
  if (RACKING_SKUS.has(sku)) return "racking";
  if (BATTERY_SKUS.has(sku)) return "battery";
  if (ELECTRICAL_SKUS.has(sku)) return "electrical";
  if (sku === EV_CHARGER.sku) return "ev-charger";
  if (HEAT_PUMP_SKUS.has(sku)) return "heat-pump";
  return "inverter"; // string inverters and battery controllers
}

/** Reads the roof from the job's site notes ("Colorbond, 22° pitch", "Terracotta tile"). Unknown → tile, as quoted. */
export function roofFromNotes(notes: string): RoofType {
  const n = notes.toLowerCase();
  if (/\bflat\b/.test(n)) return "flat";
  if (/colorbond|tin|klip|metal|corrugated|zinc/.test(n)) return "tin";
  if (/tile|slate|terracotta|concrete/.test(n)) return "tile";
  return "unsure";
}

/** The job's products, grouped for ordering. Rail and splices are rounded to whole lengths; clips to packs. */
export function jobMaterials(job: Job): MaterialLine[] {
  const phase: Phase = job.site.phase ?? "single";
  const bom = billOfMaterials({
    ...job.system,
    roof: roofFromNotes(job.site.roof),
    tilt: job.site.tilt,
    storeys: job.site.storeys,
    phase,
    addOns: [],
    arrays: job.layout?.arrays,
  });
  const lines: MaterialLine[] = [];
  for (const l of bom) {
    if (!l.sku || l.qty <= 0) continue;
    const found = lines.find((m) => m.sku === l.sku);
    if (found) {
      found.qty += l.qty;
      continue;
    }
    lines.push({ sku: l.sku, name: nameFor(l.sku, l.description), qty: l.qty, group: groupFor(l.sku) });
  }
  for (const m of lines) m.note = noteFor(m);
  const order = MATERIAL_GROUPS.map((g) => g.id);
  return lines.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/** The catalogue name (the BOM adds working, e.g. rail metres, which goes in the note instead). */
function nameFor(sku: string, description: string) {
  const all = [PANEL, EV_CHARGER, ...HEAT_PUMP, ...Object.values(RACKING), ...Object.values(BOS)];
  return all.find((i) => i.sku === sku)?.name ?? description;
}

function noteFor(m: MaterialLine): string | undefined {
  if (m.sku === BOS.panelClip.sku) return `${m.qty / BOS.panelClip.packSize} × pack of ${BOS.panelClip.packSize}`;
  if (m.sku === RACKING.rail.sku) return `${RACKING.rail.lengthM} m lengths, buffer included`;
  if (m.sku === BOS.mc4.sku) return "pairs";
  return undefined;
}

/** Everything the given jobs need, added up by product, with the jobs each is for. */
export function combineMaterials(jobs: Job[]): (MaterialLine & { jobs: string[] })[] {
  const out: (MaterialLine & { jobs: string[] })[] = [];
  for (const job of jobs) {
    for (const m of jobMaterials(job)) {
      const found = out.find((o) => o.sku === m.sku);
      if (found) {
        found.qty += m.qty;
        found.jobs.push(job.reference);
      } else out.push({ ...m, jobs: [job.reference] });
    }
  }
  for (const m of out) m.note = noteFor(m);
  const order = MATERIAL_GROUPS.map((g) => g.id);
  return out.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/** Jobs to order for: accepted or scheduled, installing from `today` up to `days` ahead. */
export function jobsToOrderFor(jobs: Job[], today: string, days: number): Job[] {
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const last = until.toISOString().slice(0, 10);
  return jobs
    .filter((j) => (j.stage === "accepted" || j.stage === "scheduled") && j.preferredDate >= today && j.preferredDate <= last)
    .sort((a, b) => a.preferredDate.localeCompare(b.preferredDate));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A CSV for a supplier order: SKU, description, quantity (and the jobs, when combined). */
export function materialsCsv(lines: (MaterialLine & { jobs?: string[] })[]): string {
  const withJobs = lines.some((l) => l.jobs);
  const head = ["SKU", "Description", "Qty", ...(withJobs ? ["Jobs"] : [])];
  const rows = lines.map((l) => [l.sku, l.name, l.qty, ...(withJobs ? [(l.jobs ?? []).join(" ")] : [])]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Plain text to paste into an email or supplier's order form. */
export function materialsText(lines: MaterialLine[]): string {
  return lines.map((l) => `${l.qty} × ${l.sku} · ${l.name}`).join("\n");
}
