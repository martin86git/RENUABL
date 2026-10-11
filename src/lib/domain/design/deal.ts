/**
 * A deal is a job seen from the sales side. Pure: the pipelines a business
 * looks at its deals through, what a deal's design says the installation
 * needs, and which jobs are installations in the works.
 */
import { JOB_STAGES, type Job, type JobStage } from "./crm";
import type { QuoteForm } from "./quote";
import { arrayCount, designSummary, tiltedPanels, type RoofDesign } from "./roof-design";

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

/** A pipeline: a name for a run of stages, so the deals at those stages can be looked at on their own. */
export interface Pipeline {
  id: string;
  name: string;
  stages: readonly JobStage[];
}

/** The pipelines every business starts with. "Custom" is whichever stages the person has ticked. */
export const PIPELINES: readonly Pipeline[] = [
  { id: "sales", name: "Sales", stages: ["lead", "designed", "proposal"] },
  { id: "delivery", name: "Won to installed", stages: ["won", "installed"] },
  { id: "all", name: "Every stage", stages: JOB_STAGES },
  { id: "lost", name: "Lost", stages: ["lost"] },
];

export type DealView = "cards" | "list";

/** How one person last looked at their deals: kept on their device. */
export interface PipelineChoice {
  view: DealView;
  stages: JobStage[];
}

export const DEFAULT_PIPELINE: PipelineChoice = { view: "cards", stages: [...PIPELINES[0].stages] };

/** A choice read back from the device: only real stages, in their own order, and never none. */
export function cleanPipelineChoice(raw: unknown): PipelineChoice {
  const r = (raw && typeof raw === "object" ? raw : {}) as { view?: unknown; stages?: unknown };
  const sent = Array.isArray(r.stages) ? r.stages : [];
  const stages = JOB_STAGES.filter((s) => sent.includes(s));
  return { view: r.view === "list" ? "list" : "cards", stages: stages.length ? stages : [...DEFAULT_PIPELINE.stages] };
}

/** The pipeline these stages are, when they are exactly one of the named ones. */
export function pipelineOf(stages: readonly JobStage[]): Pipeline | null {
  return PIPELINES.find((p) => p.stages.length === stages.length && p.stages.every((s) => stages.includes(s))) ?? null;
}

// ---------------------------------------------------------------------------
// What the installation needs
// ---------------------------------------------------------------------------

/** One line of a deal's system details. `value` is null where the design doesn't say yet. */
export interface DetailLine {
  label: string;
  value: string | null;
}

const ROOFS: Record<QuoteForm["roof"], string> = { tile: "Tile", tin: "Tin", flat: "Flat" };

/**
 * A deal's system details, read from its design and the design's quote
 * settings: what is going on the roof and what kind of roof it is. With no
 * design every line is there and empty, so it is plain what is still to come.
 */
export function systemDetails(design: RoofDesign | null, form: QuoteForm | null): DetailLine[] {
  const summary = design ? designSummary(design) : null;
  const panels = summary?.panels ?? 0;
  const inverters = design?.inverters ?? [];
  // The same model twice is one line with a count; a second model is the "additional" inverter.
  const models = [...new Map(inverters.map((i) => [i.sku, i])).values()];
  const count = (sku: string) => inverters.filter((i) => i.sku === sku).length;
  const inverterKw = inverters.reduce((n, i) => n + i.kw, 0);
  const battery = design?.battery ?? null;
  const tilted = design && form?.roof === "flat" ? tiltedPanels(design).count : 0;
  const strings = design?.strings?.filter((s) => s.panels.length).length ?? 0;
  return [
    { label: "System type", value: panels ? (battery ? "Solar and battery" : "Solar") : battery ? "Battery" : null },
    { label: "System size", value: panels && summary ? `${summary.kw} kW` : null },
    { label: "Property storeys", value: form ? (form.storeys === "double" ? "Double" : "Single") : null },
    { label: "Roof type", value: form ? ROOFS[form.roof] : null },
    { label: "Phases", value: form ? (form.phase === "three" ? "3" : "1") : null },
    { label: "PV panel", value: panels ? (design?.panel?.name ?? "Standard 475 W panel") : null },
    { label: "Panel qty", value: panels ? String(panels) : null },
    { label: "Inverter", value: models[0]?.name ?? null },
    { label: "Inverter qty", value: models[0] ? String(count(models[0].sku)) : null },
    {
      label: "Additional inverter",
      value:
        models
          .slice(1)
          .map((m) => (count(m.sku) > 1 ? `${count(m.sku)} × ${m.name}` : m.name))
          .join(", ") || null,
    },
    { label: "Inverter capacity", value: inverterKw ? `${Math.round(inverterKw * 100) / 100} kW` : null },
    { label: "Battery", value: battery?.name ?? null },
    { label: "Battery qty", value: battery ? String(battery.qty) : null },
    { label: "Battery storage", value: battery ? `${Math.round(battery.kwh * battery.qty * 10) / 10} kWh` : null },
    { label: "Arrays", value: panels && design ? String(arrayCount(design)) : null },
    { label: "Strings", value: strings ? String(strings) : null },
    { label: "Tilt frames", value: tilted ? `${tilted} panels` : null },
  ];
}

// ---------------------------------------------------------------------------
// Installations
// ---------------------------------------------------------------------------

/** Installations in the works: jobs that are won and not yet installed. */
export function inTheWorks<T extends Pick<Job, "stage">>(jobs: readonly T[]): T[] {
  return jobs.filter((j) => j.stage === "won");
}

/**
 * Installations in the works, in the order to deal with them: those with a
 * date first, soonest first (an overdue one therefore leads), then those
 * still to be booked, the longest-waiting first.
 */
export function installOrder<T extends Pick<Job, "installDate" | "updatedAt">>(jobs: readonly T[]): { booked: T[]; toBook: T[] } {
  const booked = jobs.filter((j) => j.installDate).sort((a, b) => a.installDate!.localeCompare(b.installDate!));
  const toBook = jobs.filter((j) => !j.installDate).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return { booked, toBook };
}

/** Whole days from `today` to a date (both YYYY-MM-DD): negative once it has passed. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
