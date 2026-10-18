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
  evCharger: "EV charger",
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

/** The seven days of the week a day falls in, Monday first (all YYYY-MM-DD). */
export function weekOf(today: ISODate): ISODate[] {
  const at = Date.parse(`${today}T00:00:00Z`);
  // Monday is 0, Sunday 6.
  const fromMonday = (new Date(at).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(at + (i - fromMonday) * 86_400_000).toISOString().slice(0, 10) as ISODate);
}

/** Kilowatts as they are said: "24.2 kW", or "1.25 MW" from a megawatt up. */
export function power(kw: number): string {
  return kw >= 1000 ? `${Math.round(kw / 10) / 100} MW` : `${Math.round(kw * 10) / 10} kW`;
}

// ---------------------------------------------------------------------------
// The overview's three views
// ---------------------------------------------------------------------------

/** What the overview is looking at: the selling, the installations to come, or the installations done. */
export type OverviewView = "sales" | "upcoming" | "completed";

export const OVERVIEW_VIEWS: readonly { id: OverviewView; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "upcoming", label: "Upcoming installs" },
  { id: "completed", label: "Completed installs" },
];

/** The pipeline each view shows the stages of: the sale, from won to installed, and after the install. */
export const VIEW_PIPELINE: Record<OverviewView, string> = { sales: "sales", upcoming: "post-sale", completed: "post-installation" };

export type UpcomingJob = Pick<Job, "stage" | "value" | "kw" | "installDate" | "updatedAt">;

export interface UpcomingInstalls {
  /** Every installation sold and not yet done (won, ordered or scheduled), what they come to and their solar. */
  total: number;
  value: number;
  kw: number;
  /** With a date from today on; with a date this week (Monday to Sunday) and this calendar month. */
  booked: number;
  thisWeek: number;
  thisMonth: number;
  /** With no date yet. */
  toBook: number;
  /** With a date that has passed while still not marked installed. */
  overdue: number;
  /** Sold but nothing ordered yet (still at Won), and ordered (stock on its way). */
  toOrder: number;
  ordered: number;
  /** The next date with an installation on it, and how many are on it. Null with none booked. */
  next: { date: ISODate; count: number } | null;
}

/** The installations still to come, as the overview's "Upcoming installs" shows them. */
export function upcomingInstalls<T extends UpcomingJob>(jobs: readonly T[], today: ISODate): UpcomingInstalls {
  const coming = inTheWorks(jobs);
  const week = weekOf(today);
  const dated = coming.filter((j) => j.installDate);
  const ahead = dated.filter((j) => j.installDate! >= today);
  const first = ahead.map((j) => j.installDate!).sort()[0];
  return {
    total: coming.length,
    value: coming.reduce((n, j) => n + (j.value ?? 0), 0),
    kw: Math.round(coming.reduce((n, j) => n + (j.kw ?? 0), 0) * 100) / 100,
    booked: ahead.length,
    thisWeek: dated.filter((j) => j.installDate! >= week[0] && j.installDate! <= week[6]).length,
    thisMonth: dated.filter((j) => j.installDate!.startsWith(today.slice(0, 7))).length,
    toBook: coming.length - dated.length,
    overdue: dated.filter((j) => j.installDate! < today).length,
    toOrder: coming.filter((j) => j.stage === "won").length,
    ordered: coming.filter((j) => j.stage === "ordered").length,
    next: first ? { date: first as ISODate, count: ahead.filter((j) => j.installDate === first).length } : null,
  };
}

export type CompletedJob = Pick<Job, "stage" | "value" | "kw" | "installedAt">;

export interface CompletedInstalls {
  /** Installed this financial year (by the day it was marked installed), what they came to and their solar. */
  yearCount: number;
  yearValue: number;
  yearKw: number;
  yearLabel: string;
  /** Installed this month to date, and against the same days of last month, as a whole percentage (null with none then). */
  monthCount: number;
  monthKw: number;
  vsLastMonth: number | null;
  /** Where the installed jobs stand now: inspection booked, certificate of compliance received, at grid connection, rebates claimed. */
  inspection: number;
  coes: number;
  grid: number;
  claimed: number;
  /** Installed but not yet through to claimed: the paperwork still open. */
  paperwork: number;
}

/** The installations done, as the overview's "Completed installs" shows them. */
export function completedInstalls<T extends CompletedJob>(jobs: readonly T[], today: ISODate): CompletedInstalls {
  const day = (iso: string | null) => (iso ? todayInMarket(new Date(iso)) : null);
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const two = (n: number) => String(n).padStart(2, "0");
  const month = `${y}-${two(m)}`;
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${two(m - 1)}`;
  const yearFrom = m >= 7 ? y : y - 1;
  const toDate = (d: string | null, ofMonth: string) => d !== null && d >= `${ofMonth}-01` && d <= `${ofMonth}-${today.slice(8, 10)}`;
  const done = jobs.filter((j) => INSTALLED_STAGES.includes(j.stage)).map((j) => ({ ...j, on: day(j.installedAt) }));
  const kw = (list: typeof done) => Math.round(list.reduce((n, j) => n + (j.kw ?? 0), 0) * 100) / 100;
  const year = done.filter((j) => j.on !== null && j.on >= `${yearFrom}-07-01` && j.on <= today);
  const thisMonth = done.filter((j) => toDate(j.on, month));
  const at = (stage: JobStage) => done.filter((j) => j.stage === stage).length;
  return {
    yearCount: year.length,
    yearValue: year.reduce((n, j) => n + (j.value ?? 0), 0),
    yearKw: kw(year),
    yearLabel: `FY ${yearFrom}-${two((yearFrom + 1) % 100)}`,
    monthCount: thisMonth.length,
    monthKw: kw(thisMonth),
    vsLastMonth: change(thisMonth.length, done.filter((j) => toDate(j.on, lastMonth)).length),
    inspection: at("inspection"),
    coes: at("coes"),
    grid: at("grid"),
    claimed: at("claimed"),
    paperwork: done.filter((j) => j.stage !== "claimed").length,
  };
}

/**
 * The name to greet someone by, from their sign-in email: the part before the
 * @ when it is a plain word ("martin@…" → "Martin"), else nothing (an address
 * like "sales@" or "j.smith2@" is no one's name, so no guess is made).
 */
export function greetingName(email: string | null | undefined): string | null {
  const local = (email ?? "").split("@")[0] ?? "";
  if (!/^[a-z]{2,20}$/i.test(local)) return null;
  if (
    ["admin", "info", "sales", "office", "hello", "contact", "accounts", "team", "support", "enquiries", "mail"].includes(
      local.toLowerCase(),
    )
  )
    return null;
  return local[0].toUpperCase() + local.slice(1).toLowerCase();
}

/** One line for each view, shown under the greeting before a view is picked: where each part of the business stands, in a sentence. */
export function viewLines(jobs: readonly (DashJob & Pick<Job, "updatedAt">)[], today: ISODate): Record<OverviewView, string> {
  const d = dashboard(jobs, today);
  const u = upcomingInstalls(jobs, today);
  const c = completedInstalls(jobs, today);
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const monthName = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
  const proposals = jobs.filter((j) => j.stage === "proposal").length;
  const nextDay = u.next
    ? new Date(`${u.next.date}T00:00:00Z`).toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : null;
  return {
    sales: `${n(d.sold, "deal", "deals")} sold in ${monthName}, ${n(proposals, "proposal", "proposals")} with customers.`,
    upcoming:
      u.total === 0
        ? "Nothing sold is waiting to be installed."
        : `${n(u.thisWeek, "install", "installs")} this week${nextDay ? `, the next on ${nextDay}` : ""}. ${n(u.toBook, "still to book", "still to book")}.`,
    completed: `${n(c.yearCount, "install", "installs")} done this financial year, ${n(c.paperwork, "with paperwork open", "with paperwork open")}.`,
  };
}

// ---------------------------------------------------------------------------
// The Installations lists on the overview: awaiting install and completed
// ---------------------------------------------------------------------------

/** What a signed job carries for the lists, from its signed proposal (`/api/design/installs`). */
export interface JobExtra {
  jobId: string;
  batteryKwh: number;
  youPay: number;
  depositReceived: number;
  ordered: boolean;
}

/**
 * Install revenue this month to date: for the jobs awaiting install whose install date falls this month, what is still
 * payable on their contracts (what the customer pays, after the federal rebate, less any deposit received). A job with
 * no signed proposal counts at its value.
 */
export function installRevenueThisMonth(
  jobs: readonly Pick<Job, "id" | "stage" | "installDate" | "value">[],
  extras: readonly JobExtra[],
  today: ISODate,
): number {
  const month = today.slice(0, 7);
  return Math.round(
    inTheWorks(jobs)
      .filter((j) => j.installDate?.startsWith(month))
      .reduce((n, j) => {
        const x = extras.find((e) => e.jobId === j.id);
        return n + Math.max(0, (x ? x.youPay : (j.value ?? 0)) - (x?.depositReceived ?? 0));
      }, 0),
  );
}

/** Whether an installer is booked: someone is named on the job and it has an install date. */
export const installerBooked = (j: Pick<Job, "details" | "installDate">) => Boolean(j.details?.installer && j.installDate);

/** After the install, whether a job's paperwork is all done: the customer's invoice paid, the STCs claimed, the grid connected. */
export const paperworkDone = (j: Pick<Job, "details">) =>
  j.details?.customerInvoice === "paid" && j.details?.stcClaim === "claimed" && j.details?.gridConnection === "completed";

/** The days a job was installed on, for the calendar: its install date, else the day it was marked installed. */
export const installedOn = (j: Pick<Job, "installDate" | "installedAt">): ISODate | null =>
  j.installDate ?? (j.installedAt ? (j.installedAt.slice(0, 10) as ISODate) : null);

/** Where an installation is: still to come, under way (the day has come, but it isn't finished), or completed. */
export type InstallPhase = "upcoming" | "in-works" | "completed";
export const INSTALL_PHASES: readonly InstallPhase[] = ["upcoming", "in-works", "completed"];

/**
 * A sold job's installation phase, or null for one not sold (or lost). Upcoming: sold and its day not come (or no day
 * yet). In the works: its day has come or it is marked installed, and the customer's invoice, the STCs or the grid
 * connection is still open. Completed: installed with all three done.
 */
export function installPhase(j: Pick<Job, "stage" | "installDate" | "details">, today: ISODate): InstallPhase | null {
  if (INSTALLED_STAGES.includes(j.stage)) return paperworkDone(j) ? "completed" : "in-works";
  if (PRE_INSTALL_STAGES.includes(j.stage)) return j.installDate && j.installDate <= today ? "in-works" : "upcoming";
  return null;
}
