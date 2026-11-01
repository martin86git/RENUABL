/**
 * The quote that follows a roof design: what the system on the drawing costs
 * the business and what it would sell for, from that business's own price
 * lists, parts, installation rates and margin (`pricing.ts`).
 * Cost = hardware + installation + commission; price = cost + margin + GST,
 * less STCs. Pure, tested.
 *
 * Nothing is guessed. A product with no cost on file becomes a line marked
 * `missing` at $0, so the quote still adds up and says exactly what to fill in
 * rather than failing or inventing a figure. No inverter or battery is added
 * unless the design names one.
 */
import { deemingYears, batteryFactor, taperedKwh, type RebateRates } from "../rebates";
import { zoneRating } from "../zone-ratings";
import { GST, commissionFor, componentCost, listed, marginFor, type ComponentKey, type Workspace } from "./pricing";
import { MAX_DESIGNS } from "./roof-design";

export const COST_GROUPS = ["Panels", "Inverters", "Battery", "Racking", "Electrical", "Installation", "Commission"] as const;
export type CostGroup = (typeof COST_GROUPS)[number];

export interface CostLine {
  group: CostGroup;
  label: string;
  /** Ex GST. */
  amount: number;
  /** How many, when the line is a count of one product. */
  qty?: number;
  /** The product's code, where the line is one product. */
  sku?: string;
  /** No cost is on file for it: the line is $0 until one is set. */
  missing?: boolean;
}

/** What the quote needs to know about the home that the drawing doesn't show. */
export interface QuoteForm {
  phase: "single" | "three";
  roof: "tile" | "tin" | "flat";
  storeys: "single" | "double";
  postcode: string;
  /** The Solar Victoria rebate is put on this quote (and so on its proposal): always subject to eligibility and approval. */
  solarVicRebate?: boolean;
  /** The Solar Victoria interest-free loan too. It goes with the rebate, never without it. */
  solarVicLoan?: boolean;
  /** The roof's pitch in degrees, one figure for the home (1 Nov 2026, Martin, as Primero's): new panels and traced faces start at it. */
  pitch?: number;
  /** A person has set the pitch for this home: until then the designer asks for it. */
  pitchSet?: boolean;
}

/** The system on the drawing. */
export interface SystemSpec {
  panels: number;
  panel: { sku: string; name: string; watts: number; short: number };
  inverters: { sku: string; name: string }[];
  /** `backup`: wired for blackouts, which adds the backup wiring to the installation. */
  battery: { sku: string; name: string; kwh: number; qty: number; backup?: boolean } | null;
  /** Separate arrays on the roof, counted from the drawing. */
  arrays: number;
  /** Panels drawn at a tilt, and the steepest of them: on a flat roof they are taken to be on tilt frames. */
  tiltedPanels: number;
  tiltDegrees: number;
}

export interface Costing {
  panels: number;
  pvKw: number;
  batteryKwh: number;
  lines: CostLine[];
  hardware: number;
  install: number;
  commission: number;
  /** Ex GST. */
  cost: number;
  margin: number;
  priceExGst: number;
  priceIncGst: number;
  /** How many lines have no cost on file. */
  missing: number;
}

/** Rail comes in these lengths, with this much spare allowed for. */
const RAIL = { lengthM: 4.8, perPanelExtraM: 0.1, spare: 1.05 } as const;

export function costSystem(spec: SystemSpec, form: QuoteForm, workspace: Workspace): Costing {
  const panels = Math.max(0, Math.round(spec.panels));
  const pvKw = Math.round(panels * spec.panel.watts) / 1000;
  const three = form.phase === "three";
  const batteryQty = spec.battery ? Math.max(1, Math.round(spec.battery.qty)) : 0;
  const batteryKwh = spec.battery ? Math.round(spec.battery.kwh * batteryQty * 10) / 10 : 0;
  const arrays = Math.max(1, Math.round(spec.arrays));
  const kits = Math.ceil(pvKw / 2);
  const lines: CostLine[] = [];

  /** A line for so many of one product from the price lists. */
  const product = (group: CostGroup, sku: string, name: string, qty: number) => {
    const each = listed(workspace, sku)?.cost ?? null;
    lines.push({
      group,
      label: qty > 1 || group === "Panels" ? `${qty} × ${name}` : name,
      qty,
      sku,
      amount: qty * (each ?? 0),
      ...(each === null ? { missing: true } : {}),
    });
  };
  /** A line for so many of one of the parts set in the settings. */
  const part = (group: CostGroup, key: ComponentKey, label: string, qty: number) => {
    const each = componentCost(workspace, key);
    lines.push({
      group,
      label,
      qty,
      sku: workspace.components[key].sku || undefined,
      amount: qty * (each ?? 0),
      ...(each === null ? { missing: true } : {}),
    });
  };

  if (panels) product("Panels", spec.panel.sku, spec.panel.name, panels);
  for (const inverter of spec.inverters) product("Inverters", inverter.sku, inverter.name, 1);
  if (spec.battery) product("Battery", spec.battery.sku, spec.battery.name, batteryQty);

  if (panels) {
    // Racking: two rails under each portrait panel, its width and a little more, with some spare; kits per 2 kW.
    const railLengths = Math.ceil((panels * (spec.panel.short + RAIL.perPanelExtraM) * 2 * RAIL.spare) / RAIL.lengthM);
    part("Racking", "rail", `Rails (${railLengths} lengths for ${panels} panels)`, railLengths);
    part("Racking", "splice", `Rail splices (${railLengths})`, railLengths);
    if (form.roof === "flat") {
      part("Racking", "tinKit", `Roof kits (tin, ${kits})`, kits);
      part("Racking", "kliplok", `Kliplok interfaces (${panels * 2 + arrays * 2})`, panels * 2 + arrays * 2);
    } else part("Racking", form.roof === "tin" ? "tinKit" : "tileKit", `Roof kits (${form.roof}, ${kits})`, kits);
    const tilted = form.roof === "flat" ? Math.min(panels, Math.max(0, Math.round(spec.tiltedPanels))) : 0;
    if (tilted) {
      const low = spec.tiltDegrees <= 15;
      const tiltKits = Math.ceil((tilted * spec.panel.watts) / 2000);
      part(
        "Racking",
        low ? "tiltLow" : "tiltHigh",
        `Tilt kits, ${low ? "10 to 15" : "15 to 30"} degrees (${tiltKits} for ${tilted} tilted panels)`,
        tiltKits,
      );
    }
    part("Electrical", three ? "meter3ph" : "meter1ph", "Smart meter", 1);
    part("Electrical", "mc4", "MC4 connectors", 1);
    part("Electrical", three ? "isolator3ph" : "isolator1ph", "AC isolator", 1);
    lines.push({ group: "Electrical", label: "Cable, conduit, labels and sundries (allowance)", amount: workspace.settings.sundries });

    const r = workspace.install;
    const install = (label: string, amount: number, qty?: number) =>
      lines.push({ group: "Installation", label, amount, ...(qty ? { qty } : {}) });
    install(`Solar installation: ${pvKw} kW at ${Math.round(r.pvPerWatt * 1000) / 10}c a watt`, pvKw * 1000 * r.pvPerWatt);
    if (form.storeys === "double") install("Double storey", r.doubleStorey);
    install(
      arrays > 2 ? `Split arrays: ${arrays} on the roof, ${arrays - 2} more than the 2 allowed for` : `Arrays: ${arrays} on the roof`,
      Math.max(0, arrays - 2) * r.extraArray,
    );
    if (tilted) install(`Tilt frames: ${tilted} panels`, tilted * r.tiltPerPanel, tilted);
    if (three) install("Three-phase installation", r.threePhase);
    if (spec.inverters.length > 1)
      install(`Additional inverter installation (${spec.inverters.length - 1})`, (spec.inverters.length - 1) * r.extraInverter);
    if (spec.battery) install("Battery installation", r.battery);
    if (spec.battery?.backup) install("Backup circuits for blackouts", r.backup);
    if (r.inspection) install("Electrical inspection", r.inspection);
    if (r.smartMeter) install("Smart meter installation", r.smartMeter);
    if (r.fallProtection) install("Fall protection", r.fallProtection);
  }

  const commission = panels ? commissionFor(pvKw, batteryKwh, workspace.settings.commission) : 0;
  if (commission)
    lines.push({
      group: "Commission",
      label: `Commission ($${workspace.settings.commission.perPvKw}/kW + $${workspace.settings.commission.perBatteryKwh}/kWh)`,
      amount: commission,
    });

  const rounded = lines.map((l) => ({ ...l, amount: Math.round(l.amount * 100) / 100 }));
  const sum = (groups: readonly CostGroup[]) =>
    Math.round(rounded.filter((l) => groups.includes(l.group)).reduce((s, l) => s + l.amount, 0));
  const hardware = sum(["Panels", "Inverters", "Battery", "Racking", "Electrical"]);
  const install = sum(["Installation"]);
  const cost = hardware + install + commission;
  const margin = panels ? marginFor(pvKw, batteryKwh, workspace.settings.margin) : 0;
  const priceExGst = cost + margin;
  return {
    panels,
    pvKw,
    batteryKwh,
    lines: rounded,
    hardware,
    install,
    commission,
    cost,
    margin,
    priceExGst,
    priceIncGst: Math.round(priceExGst * (1 + GST)),
    missing: rounded.filter((l) => l.missing).length,
  };
}

/** A quote line changed by hand: a quantity or a cost typed over the worked-out one, or the line taken out. */
export interface LineEdit {
  amount?: number;
  /** How many, typed over the worked-out count: the line is priced again at its cost each, unless a cost is typed too. */
  qty?: number;
  removed?: boolean;
}

/** The most a quantity typed over a line may be. */
export const MAX_LINE_QTY = 999;

/** One design's quote: what was asked about the home, and the lines changed by hand (by `lineKey`). */
export interface QuoteFields {
  form: QuoteForm;
  edits: Record<string, LineEdit>;
}

/**
 * A line's name with its figures taken out, so an edit made to "Rails (23 lengths for 42 panels)" still belongs
 * to that line once the design has grown and it reads "(25 lengths for 46 panels)".
 */
export function lineKey(line: Pick<CostLine, "group" | "label">): string {
  return `${line.group}|${line.label.replace(/[\d.,]+/g, "#")}`.slice(0, 160);
}

/** The lines as they stand: the worked-out ones with any hand changes laid over them, and those taken out left out. */
export function editedLines(lines: readonly CostLine[], edits: Record<string, LineEdit>): CostLine[] {
  return lines
    .filter((l) => !edits[lineKey(l)]?.removed)
    .map((l) => {
      const edit = edits[lineKey(l)];
      let line = l;
      // A quantity typed over a counted line prices it again at its cost each (a line with no cost on file stays at $0).
      if (edit?.qty !== undefined && l.qty !== undefined) {
        const each = l.qty > 0 ? l.amount / l.qty : 0;
        line = { ...line, qty: edit.qty, amount: Math.round(each * edit.qty * 100) / 100 };
      }
      // A cost typed over a line settles it, and wins over the quantity's.
      return edit?.amount === undefined ? line : { ...line, amount: edit.amount, missing: undefined };
    });
}

/**
 * A costing's totals for lines changed by hand: the cost is what the lines now come to, the margin is as it was
 * (it goes by the system's size, not by what things cost), and the price follows.
 */
export function repriced(costing: Pick<Costing, "margin">, lines: readonly CostLine[]) {
  const cost = Math.round(lines.reduce((sum, l) => sum + l.amount, 0));
  const priceExGst = cost + costing.margin;
  return { cost, priceExGst, priceIncGst: Math.round(priceExGst * (1 + GST)) };
}

/** Melbourne's zone, used when a postcode isn't known. */
const DEFAULT_ZONE_RATING = 1.185;

/** The STCs a system creates, in dollars at the business's own price per certificate. */
export function stcValue(
  system: { pvKw: number; batteryKwh: number },
  postcode: string | null,
  date: string,
  rates: RebateRates,
  stcPrice: number,
): number {
  const rating = (postcode && zoneRating(postcode)?.rating) || DEFAULT_ZONE_RATING;
  const solar = Math.floor(system.pvKw * rating * deemingYears(date, rates));
  const battery = Math.floor(taperedKwh(system.batteryKwh, rates) * batteryFactor(date, rates));
  return Math.round((solar + battery) * stcPrice);
}

// ---------------------------------------------------------------------------
// Solar Victoria: the rebate and the interest-free loan, when the business puts them on a quote
// ---------------------------------------------------------------------------

export interface SolarVic {
  /** Taken off the price, if Solar Victoria approves it. */
  rebate: number;
  /** Paid back over `loanMonths` with no interest, if approved. It lowers what is paid up front, not the price. 0 without the loan. */
  loan: number;
  loanMonths: number;
  /** A month, while the loan is paid back. 0 without the loan. */
  monthly: number;
  /** The price after STCs and the rebate. */
  afterRebate: number;
  /** What is paid up front: after the rebate, less the loan. */
  upfront: number;
}

/** Victorian postcodes: 3000 to 3999, and the 8000s. */
const inVictoria = (postcode: string) => /^[38]\d{3}$/.test(postcode);

/**
 * The Solar Victoria rebate (and loan) on a quote, when the business has
 * switched it on: for a Victorian home getting solar panels, the rebate is
 * the lesser of the most Solar Victoria gives and its share of the price
 * after STCs, and the loan is up to the same again. Null when it is switched
 * off, the home isn't in Victoria, there are no panels, or Solar Victoria
 * isn't offering one. Only ever an "if approved" figure: see `solarVicNote`.
 */
export function solarVicFor(form: QuoteForm, panels: number, priceIncGst: number, stc: number, rates: RebateRates): SolarVic | null {
  const sv = rates.solarVictoria;
  if (!form.solarVicRebate || !inVictoria(form.postcode) || panels <= 0 || sv.pvRebateMax <= 0) return null;
  const afterStc = priceIncGst - stc;
  const rebate = Math.round(Math.min(sv.pvRebateMax, Math.max(0, afterStc * sv.pvRebateShare)));
  if (rebate <= 0) return null;
  const loan = form.solarVicLoan ? Math.min(sv.pvLoanMax, rebate) : 0;
  const afterRebate = afterStc - rebate;
  return {
    rebate,
    loan,
    loanMonths: sv.loanMonths,
    monthly: loan ? Math.round((loan / sv.loanMonths) * 100) / 100 : 0,
    afterRebate,
    upfront: afterRebate - loan,
  };
}

/** Whether the Solar Victoria toggles can do anything for this quote, and if not, why, in words for the screen. */
export function solarVicBar(form: QuoteForm, panels: number, rates: RebateRates): string | null {
  if (!inVictoria(form.postcode)) return "Solar Victoria is for homes in Victoria: this address isn't one.";
  if (rates.solarVictoria.pvRebateMax <= 0) return "Solar Victoria isn't offering a solar panel rebate at the moment.";
  if (panels <= 0) return "The rebate is for solar panels: put panels on the roof first.";
  return null;
}

/**
 * What must always be said beside a Solar Victoria figure, on the quote and
 * on the proposal: it depends on eligibility and approval, and what the
 * price is without it.
 */
export function solarVicNote(sv: Pick<SolarVic, "loan" | "rebate" | "afterRebate">): string {
  const both = sv.loan > 0;
  const without = "$" + Math.round(sv.afterRebate + sv.rebate).toLocaleString("en-AU");
  return `The Solar Victoria rebate${both ? " and interest-free loan are" : " is"} subject to eligibility and to Solar Victoria's approval. If you are not eligible, or are not approved, ${
    both ? "they do" : "it does"
  } not apply, and the price is ${without}${both ? " with nothing to pay back by the month" : ""}.`;
}

// ---------------------------------------------------------------------------
// The customer's electricity bill, and what the design does to it
// ---------------------------------------------------------------------------

/** How often the bill comes, as the days it covers. */
export const BILL_INTERVALS = { annual: 365, quarterly: 365 / 4, bimonthly: 365 / 6, monthly: 365 / 12 } as const;
export type BillInterval = keyof typeof BILL_INTERVALS;

/** The bill as it is typed, kept as typed so a half-entered figure isn't lost. */
export interface BillFields {
  interval: BillInterval;
  amount: string;
  supplyPerDay: string;
  rate: string;
  feedIn: string;
}

export interface DesignFinance {
  /** What the home uses a day, worked back from the bill. */
  dailyKwh: number;
  /** A year's bill as it is now. */
  billNow: number;
  /** A year's bill with the system: may be a credit (below zero). */
  billAfter: number;
  saving: number;
  productionKwh: number;
  /** Of that, what the home uses itself, as it is made or from the battery. */
  usedKwh: number;
  exportedKwh: number;
  /** The share of what is made that the home uses itself, 0 to 1. */
  selfConsumption: number;
  /** The share of what the home uses that the system supplies, 0 to 1. */
  selfReliance: number;
}

/** The share of a day's use taken to fall after dark, and what a battery gives back of what is put in. */
export const DAY = { eveningShare: 0.6, batteryRoundTrip: 0.9 } as const;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * From a bill (how often it comes, what it comes to, the daily supply charge, the price a kWh and the feed-in
 * tariff) back to what the home uses a day; then the year a month at a time with what the design makes in that
 * month: solar used as it is made, a battery carrying some into the evening, the rest sold, and what is still
 * bought. Left out on purpose: the home's use is taken as the same every day, one price at all times of day, no
 * price rises, no shade. Always an estimate. Null when there isn't a bill to work from.
 */
export function designFinance(
  bill: { interval: BillInterval; amount: number; supplyPerDay: number; rate: number; feedIn: number },
  /** What the design makes in each month, kWh. */
  monthlyKwh: readonly number[],
  batteryKwh: number,
  selfUseShare: number,
): DesignFinance | null {
  const days = BILL_INTERVALS[bill.interval];
  if (!(bill.amount > 0) || !(bill.rate > 0) || !(bill.supplyPerDay >= 0) || !(bill.feedIn >= 0) || monthlyKwh.length !== 12) return null;
  const dailyKwh = (bill.amount / days - bill.supplyPerDay) / bill.rate;
  if (!(dailyKwh > 0)) return null;
  let production = 0;
  let used = 0;
  let exported = 0;
  let bought = 0;
  monthlyKwh.forEach((kwh, m) => {
    const n = MONTH_DAYS[m];
    const made = kwh / n;
    const asMade = Math.min(made * selfUseShare, dailyKwh * (1 - DAY.eveningShare), dailyKwh);
    const shifted = batteryKwh > 0 ? Math.min(batteryKwh * DAY.batteryRoundTrip, made - asMade, dailyKwh * DAY.eveningShare) : 0;
    const own = asMade + shifted;
    production += kwh;
    used += Math.min(own, made) * n;
    exported += Math.max(0, made - own) * n;
    bought += Math.max(0, dailyKwh - own) * n;
  });
  const billNow = Math.round((dailyKwh * bill.rate + bill.supplyPerDay) * 365);
  const billAfter = Math.round(bought * bill.rate + bill.supplyPerDay * 365 - exported * bill.feedIn);
  return {
    dailyKwh: Math.round(dailyKwh * 10) / 10,
    billNow,
    billAfter,
    saving: billNow - billAfter,
    productionKwh: Math.round(production),
    usedKwh: Math.round(used),
    exportedKwh: Math.round(exported),
    selfConsumption: production > 0 ? used / production : 0,
    selfReliance: Math.min(1, used / (dailyKwh * 365)),
  };
}

// ---------------------------------------------------------------------------
// What is kept with a roof's designs besides the drawings
// ---------------------------------------------------------------------------

export interface DesignExtras {
  bill: BillFields;
  /** One for each of the roof's designs, in their order. */
  quotes: QuoteFields[];
}

/** The postcode in an address, wherever it sits: the last four-digit number that could be an Australian postcode. */
export function postcodeIn(...texts: (string | null | undefined)[]): string {
  for (const text of texts) {
    const found = [...(text ?? "").matchAll(/(?<![\d/-])(\d{4})(?![\d/-])/g)].map((m) => m[1]).filter((p) => Number(p) >= 200);
    if (found.length) return found[found.length - 1];
  }
  return "";
}

export function defaultBill(bill: { rate: number; feedIn: number; supplyPerDay: number }): BillFields {
  return {
    interval: "quarterly",
    amount: "",
    supplyPerDay: bill.supplyPerDay.toFixed(2),
    rate: bill.rate.toFixed(2),
    feedIn: bill.feedIn.toFixed(2),
  };
}

export function defaultQuote(postcode: string): QuoteFields {
  return { form: { phase: "single", roof: "tile", storeys: "single", postcode: /^\d{4}$/.test(postcode) ? postcode : "" }, edits: {} };
}

const figure = (v: unknown, fallback: string) => (typeof v === "string" && /^\d{0,7}(\.\d{0,4})?$/.test(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

/** Extras from outside (this device's storage, or a server), checked and trimmed, with one quote for each design. */
export function cleanExtras(raw: unknown, designs: number, defaults: { bill: BillFields; postcode: string }): DesignExtras {
  const r = (raw && typeof raw === "object" ? raw : {}) as { bill?: Record<string, unknown>; quotes?: unknown };
  const b = r.bill && typeof r.bill === "object" ? r.bill : {};
  const bill: BillFields = {
    interval: oneOf(b.interval, Object.keys(BILL_INTERVALS) as BillInterval[], defaults.bill.interval),
    amount: figure(b.amount, defaults.bill.amount),
    supplyPerDay: figure(b.supplyPerDay, defaults.bill.supplyPerDay),
    rate: figure(b.rate, defaults.bill.rate),
    feedIn: figure(b.feedIn, defaults.bill.feedIn),
  };
  const given = Array.isArray(r.quotes) ? r.quotes : [];
  const quotes: QuoteFields[] = [];
  for (let i = 0; i < Math.min(Math.max(1, designs), MAX_DESIGNS); i++) {
    const q = (given[i] && typeof given[i] === "object" ? given[i] : {}) as { form?: Record<string, unknown>; edits?: unknown };
    const f = q.form && typeof q.form === "object" ? q.form : {};
    const start = defaultQuote(defaults.postcode);
    const edits: Record<string, LineEdit> = {};
    for (const [key, value] of Object.entries(q.edits && typeof q.edits === "object" ? q.edits : {}).slice(0, 60)) {
      if (key.length > 160 || !value || typeof value !== "object") continue;
      const v = value as { amount?: unknown; qty?: unknown; removed?: unknown };
      if (v.removed === true) {
        edits[key] = { removed: true };
        continue;
      }
      const amount =
        typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount >= 0 && v.amount <= 1_000_000
          ? Math.round(v.amount * 100) / 100
          : undefined;
      const qty = typeof v.qty === "number" && Number.isInteger(v.qty) && v.qty >= 0 && v.qty <= MAX_LINE_QTY ? v.qty : undefined;
      if (amount !== undefined || qty !== undefined)
        edits[key] = { ...(amount !== undefined ? { amount } : {}), ...(qty !== undefined ? { qty } : {}) };
    }
    quotes.push({
      form: {
        phase: oneOf(f.phase, ["single", "three"] as const, start.form.phase),
        roof: oneOf(f.roof, ["tile", "tin", "flat"] as const, start.form.roof),
        storeys: oneOf(f.storeys, ["single", "double"] as const, start.form.storeys),
        // The postcode is the address's own whenever the address has one; only an address without one leaves what was typed.
        postcode: start.form.postcode || (typeof f.postcode === "string" && /^\d{0,4}$/.test(f.postcode) ? f.postcode : ""),
        // The loan goes with the rebate, never without it.
        ...(f.solarVicRebate === true ? { solarVicRebate: true, ...(f.solarVicLoan === true ? { solarVicLoan: true } : {}) } : {}),
        ...(typeof f.pitch === "number" && Number.isFinite(f.pitch) && f.pitch >= 0 && f.pitch <= 70 ? { pitch: Math.round(f.pitch) } : {}),
        ...(f.pitchSet === true ? { pitchSet: true } : {}),
      },
      edits,
    });
  }
  return { bill, quotes };
}
