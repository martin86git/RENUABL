/**
 * A deal is a job seen from the sales side. Pure: the pipelines a business
 * looks at its deals through, what a deal's design says the installation
 * needs, and which jobs are installations in the works.
 */
import { DETAIL_KEYS, JOB_STAGES, type DetailKey, type Job, type JobStage } from "./crm";
import { lineKey, type CostGroup, type CostLine, type QuoteForm } from "./quote";
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

/**
 * The pipelines every business has. A business adds its own beside them
 * (`SavedPipeline` in `crm.ts`, kept on the server for everyone in it), and
 * "Custom" is whichever stages the person has ticked without saving.
 */
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
  /** The pipeline picked (one of the set ones, or one the business saved); null once its stages have been ticked away from. */
  pipeline: string | null;
}

export const DEFAULT_PIPELINE: PipelineChoice = { view: "cards", stages: [...PIPELINES[0].stages], pipeline: PIPELINES[0].id };

/** A choice read back from the device: only real stages, in their own order, and never none. */
export function cleanPipelineChoice(raw: unknown): PipelineChoice {
  const r = (raw && typeof raw === "object" ? raw : {}) as { view?: unknown; stages?: unknown; pipeline?: unknown };
  const sent = Array.isArray(r.stages) ? r.stages : [];
  const stages = JOB_STAGES.filter((s) => sent.includes(s));
  return {
    view: r.view === "list" ? "list" : "cards",
    stages: stages.length ? stages : [...DEFAULT_PIPELINE.stages],
    pipeline: stages.length && typeof r.pipeline === "string" && /^[a-z0-9_]{1,80}$/.test(r.pipeline) ? r.pipeline : null,
  };
}

const sameStages = (a: readonly JobStage[], b: readonly JobStage[]) => a.length === b.length && a.every((s) => b.includes(s));

/**
 * The pipeline being looked at, among the set ones and the business's own:
 * the one picked, while the stages shown are still its stages; failing that,
 * the first whose stages are exactly these; null when it is a custom set.
 */
export function pipelineOf(stages: readonly JobStage[], picked: string | null = null, saved: readonly Pipeline[] = []): Pipeline | null {
  const all = [...PIPELINES, ...saved];
  return all.find((p) => p.id === picked && sameStages(p.stages, stages)) ?? all.find((p) => sameStages(p.stages, stages)) ?? null;
}

// ---------------------------------------------------------------------------
// What the installation needs
// ---------------------------------------------------------------------------

/** One line of a deal's system details. `value` is null where nothing says yet. */
export interface DetailLine {
  key: DetailKey;
  label: string;
  value: string | null;
}

export const DETAIL_LABELS: Record<DetailKey, string> = {
  systemType: "System type",
  systemSize: "System size",
  propertyType: "Property type",
  storeys: "Property storeys",
  roofType: "Roof type",
  phases: "Phases",
  panel: "PV panel",
  panelQty: "Panel qty",
  inverter: "Inverter",
  inverterQty: "Inverter qty",
  additionalInverter: "Additional inverter",
  inverterCapacity: "Inverter capacity",
  optimisers: "Optimisers",
  battery: "Battery",
  batteryQty: "Battery qty",
  batteryStorage: "Battery storage",
  arrays: "Arrays",
  strings: "Strings",
  tiltFrames: "Tilt frames",
  switchboard: "Switchboard",
  distributor: "Electricity distributor",
  nmi: "NMI",
  siteAccess: "Site access",
};

const ROOFS: Record<QuoteForm["roof"], string> = { tile: "Tile", tin: "Tin", flat: "Flat" };

/**
 * What a deal's design says about its system, by key: what is going on the
 * roof and what kind of roof it is, read from the design and the design's
 * quote settings. A detail the design can't know (the property type, the
 * NMI) is never here: only a person can give those.
 */
export function designDetails(design: RoofDesign | null, form: QuoteForm | null): Partial<Record<DetailKey, string>> {
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
  const said: Partial<Record<DetailKey, string | null>> = {
    systemType: panels ? (battery ? "Solar and battery" : "Solar") : battery ? "Battery" : null,
    systemSize: panels && summary ? `${summary.kw} kW` : null,
    storeys: form ? (form.storeys === "double" ? "Double" : "Single") : null,
    roofType: form ? ROOFS[form.roof] : null,
    phases: form ? (form.phase === "three" ? "3" : "1") : null,
    panel: panels ? (design?.panel?.name ?? "Standard 475 W panel") : null,
    panelQty: panels ? String(panels) : null,
    inverter: models[0]?.name ?? null,
    inverterQty: models[0] ? String(count(models[0].sku)) : null,
    additionalInverter:
      models
        .slice(1)
        .map((m) => (count(m.sku) > 1 ? `${count(m.sku)} × ${m.name}` : m.name))
        .join(", ") || null,
    inverterCapacity: inverterKw ? `${Math.round(inverterKw * 100) / 100} kW` : null,
    battery: battery?.name ?? null,
    batteryQty: battery ? String(battery.qty) : null,
    batteryStorage: battery ? `${Math.round(battery.kwh * battery.qty * 10) / 10} kWh` : null,
    arrays: panels && design ? String(arrayCount(design)) : null,
    strings: strings ? String(strings) : null,
    tiltFrames: tilted ? `${tilted} panels` : null,
  };
  const kept: Partial<Record<DetailKey, string>> = {};
  for (const key of DETAIL_KEYS) if (said[key]) kept[key] = said[key]!;
  return kept;
}

/** A line as the deal shows it: what was typed in by hand wins; otherwise what the design says. */
export interface DealDetail extends DetailLine {
  /** What the design says, when it says anything. */
  designed: string | null;
  /** Whether `value` was typed in by hand. */
  typed: boolean;
}

/**
 * A deal's system details, every line in order: each is what was typed in by
 * hand, else what the design says, else empty, so it is plain what is still
 * to come.
 */
export function systemDetails(design: RoofDesign | null, form: QuoteForm | null, typed: Record<string, string> = {}): DealDetail[] {
  const designed = designDetails(design, form);
  return DETAIL_KEYS.map((key) => ({
    key,
    label: DETAIL_LABELS[key],
    value: typed[key] || designed[key] || null,
    designed: designed[key] ?? null,
    typed: Boolean(typed[key]),
  }));
}

// ---------------------------------------------------------------------------
// The materials to order
// ---------------------------------------------------------------------------

/** One line of a job's materials order: a product, its code and how many. Never a price: the sheet goes to suppliers. */
export interface MaterialLine {
  group: CostGroup;
  item: string;
  sku: string;
  qty: number;
}

/** What is ordered: the hardware. Installation and commission are the business's own costs, not things to buy. */
const ORDERED: readonly CostGroup[] = ["Panels", "Inverters", "Battery", "Racking", "Electrical"];

/**
 * A job's bill of materials, as the sheet sent to suppliers: every hardware
 * line of its quote (the same lines, so the order matches what was sold),
 * with the lines taken out of the quote by hand left out. A line that isn't
 * a count of one product (an allowance) is one of itself with no code.
 */
export function materialsOrder(lines: readonly CostLine[], edits: Record<string, { removed?: boolean }> = {}): MaterialLine[] {
  return lines
    .filter((l) => ORDERED.includes(l.group) && !edits[lineKey(l)]?.removed)
    .map((l) => ({
      group: l.group,
      item: l.qty && /^\d+ × /.test(l.label) ? l.label.replace(/^\d+ × /, "") : l.label,
      sku: l.sku ?? "",
      qty: l.qty ?? 1,
    }));
}

/** The order as a spreadsheet file (CSV): a row a line, quoted so commas and quote marks in a name survive. */
export function materialsCsv(lines: readonly MaterialLine[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [["Group", "Item", "Code", "Qty"], ...lines.map((l) => [l.group, l.item, l.sku, l.qty])].map((row) => row.map(cell).join(",")).join("\r\n");
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
