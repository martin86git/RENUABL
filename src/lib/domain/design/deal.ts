/**
 * A deal is a job seen from the sales side. Pure: the pipelines a business
 * looks at its deals through, what a deal's design says the installation
 * needs, and which jobs are installations in the works.
 */
import {
  DETAIL_KEYS,
  INSTALLED_STAGES,
  JOB_STAGES,
  OPEN_STAGES,
  PRE_INSTALL_STAGES,
  WON_STAGES,
  type DetailKey,
  type Job,
  type JobStage,
} from "./crm";
import { todayInMarket } from "../market";
import type { ISODate } from "../types";
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
  // Selling: from a new lead to the deal signed.
  { id: "sales", name: "Sales pipeline", stages: ["lead", "designed", "proposal", "won"] },
  // Sold, and being got ready: the stock and the date.
  { id: "post-sale", name: "Post sale pipeline", stages: ["won", "ordered", "scheduled", "installed"] },
  // On the roof, and being finished off: inspection, the certificate, the grid connection, the rebates.
  { id: "post-installation", name: "Post installation pipeline", stages: ["installed", "inspection", "coes", "grid", "claimed"] },
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
  return [["Group", "Item", "Code", "Qty"], ...lines.map((l) => [l.group, l.item, l.sku, l.qty])]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}

// ---------------------------------------------------------------------------
// Installations
// ---------------------------------------------------------------------------

/** Installations in the works: jobs that are sold and not yet installed (won, stock ordered, installation scheduled). */
export function inTheWorks<T extends Pick<Job, "stage">>(jobs: readonly T[]): T[] {
  return jobs.filter((j) => PRE_INSTALL_STAGES.includes(j.stage));
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

// ---------------------------------------------------------------------------
// The overview's figures
// ---------------------------------------------------------------------------

export type DashJob = Pick<Job, "stage" | "value" | "kw" | "createdAt" | "wonAt" | "installedAt" | "installDate">;

export interface Dashboard {
  /** The financial year so far (1 July to today): the prices of the jobs sold in it, and how many. */
  salesYear: number;
  soldYear: number;
  /** "FY 2026-27". */
  yearLabel: string;
  /** This month to date. */
  salesMonth: number;
  /** Against the same days of last month, and of this month last year, as a whole percentage. Null with nothing to compare with. */
  vsLastMonth: number | null;
  vsLastYear: number | null;
  /** New deals (jobs started) this month. */
  newDeals: number;
  /** Deals sold this month, and that as a share of the new deals this month (0 to 1; null with no new deals). */
  sold: number;
  conversion: number | null;
  /** Solar sold, in kW, this month and this financial year. Only jobs whose design has been saved count. */
  kwMonth: number;
  kwYear: number;
  /** Installations with a date in this calendar month that aren't done yet, and installations completed this month. */
  installsBooked: number;
  installsDone: number;
  /** Deals at the grid connection stage. */
  inGrid: number;
  /** Deals still being sold, and what they are quoted at. */
  openDeals: number;
  openValue: number;
}

/** A change from `before` to `now` as a whole percentage; null when there was nothing before. */
function change(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

/**
 * The overview's figures, from the business's jobs as they stand. Every
 * date is taken in the market's own time zone. A sale counts in the month it
 * was sold (when the job first reached a won stage), at the job's quoted
 * price; a job later lost counts for nothing. The comparisons are like for
 * like: the same days of last month, and of this month last year.
 */
export function dashboard(jobs: readonly DashJob[], today: ISODate): Dashboard {
  const day = (iso: string | null) => (iso ? todayInMarket(new Date(iso)) : null);
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const dd = today.slice(8, 10);
  const two = (n: number) => String(n).padStart(2, "0");
  const month = `${y}-${two(m)}`;
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${two(m - 1)}`;
  const lastYear = `${y - 1}-${two(m)}`;
  const yearFrom = m >= 7 ? y : y - 1;
  const yearStart = `${yearFrom}-07-01`;
  /** Whether a day falls in a month, up to the same day of the month as today. */
  const toDate = (d: string | null, ofMonth: string) => d !== null && d >= `${ofMonth}-01` && d <= `${ofMonth}-${dd}`;

  const sold = jobs.filter((j) => WON_STAGES.includes(j.stage)).map((j) => ({ ...j, on: day(j.wonAt) }));
  const sum = (list: typeof sold) => list.reduce((n, j) => n + (j.value ?? 0), 0);
  const kw = (list: typeof sold) => Math.round(list.reduce((n, j) => n + (j.kw ?? 0), 0) * 100) / 100;
  const thisMonth = sold.filter((j) => toDate(j.on, month));
  const thisYear = sold.filter((j) => j.on !== null && j.on >= yearStart && j.on <= today);
  const salesMonth = sum(thisMonth);
  const newDeals = jobs.filter((j) => toDate(day(j.createdAt), month)).length;
  const open = jobs.filter((j) => OPEN_STAGES.includes(j.stage));

  return {
    salesYear: sum(thisYear),
    soldYear: thisYear.length,
    yearLabel: `FY ${yearFrom}-${two((yearFrom + 1) % 100)}`,
    salesMonth,
    vsLastMonth: change(salesMonth, sum(sold.filter((j) => toDate(j.on, lastMonth)))),
    vsLastYear: change(salesMonth, sum(sold.filter((j) => toDate(j.on, lastYear)))),
    newDeals,
    sold: thisMonth.length,
    conversion: newDeals > 0 ? thisMonth.length / newDeals : null,
    kwMonth: kw(thisMonth),
    kwYear: kw(thisYear),
    installsBooked: jobs.filter((j) => PRE_INSTALL_STAGES.includes(j.stage) && j.installDate?.startsWith(month)).length,
    installsDone: jobs.filter((j) => INSTALLED_STAGES.includes(j.stage) && day(j.installedAt)?.startsWith(month)).length,
    inGrid: jobs.filter((j) => j.stage === "grid").length,
    openDeals: open.length,
    openValue: open.reduce((n, j) => n + (j.value ?? 0), 0),
  };
}

/** Kilowatts as they are said: "24.2 kW", or "1.25 MW" from a megawatt up. */
export function power(kw: number): string {
  return kw >= 1000 ? `${Math.round(kw / 10) / 100} MW` : `${Math.round(kw * 10) / 10} kW`;
}
