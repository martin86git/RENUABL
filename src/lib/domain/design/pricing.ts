/**
 * What a business has told the designer about its own costs: the supplier
 * price lists it has uploaded, the parts every job needs (rails, roof kits,
 * meter, isolator), its installation rates, and its margin and commission.
 * Together these are a `Workspace`: one business's settings. Nothing here
 * belongs to RENUABL or to any one supplier; the starting figures are only
 * somewhere to begin and every one can be changed. Pure, tested.
 *
 * A price list is rows of cell text (code | description | price), as a
 * wholesaler's spreadsheet has them. Every priced row is kept by its code, so
 * any part can be looked up, and the panels, inverters and batteries on it are
 * read out for the designer's lists.
 */
import { INVERTER_ELECTRICAL, PANEL_ELECTRICAL } from "./electrical";
import type { CatalogueBattery, CatalogueInverter, CataloguePanel } from "./catalogue";
import { PANEL } from "./roof-design";

export const GST = 0.1;

// ---------------------------------------------------------------------------
// Supplier price lists
// ---------------------------------------------------------------------------

export interface ListItem {
  sku: string;
  name: string;
  /** Ex GST. */
  cost: number;
}
export interface PanelProduct extends ListItem {
  watts: number;
}
export interface InverterProduct extends ListItem {
  kw: number;
}
export interface BatteryProduct extends ListItem {
  kwh: number;
}

/** One supplier price list as it was read. Uploading a file of the same name again replaces it. */
export interface SupplierList {
  name: string;
  uploadedAt: string;
  /** Every priced row, by its code. */
  items: ListItem[];
  panels: PanelProduct[];
  inverters: InverterProduct[];
  batteries: BatteryProduct[];
}

export const MAX_SUPPLIER_LISTS = 6;
const MAX_ITEMS = 4000;

/**
 * A supplier price cell: "870", "1755.55", "24.0c/w ($114.00)",
 * "Under 1 Pallet - 39.0c/w ($171.60)". The dollar figure in brackets wins.
 */
export function parsePriceCell(cell: string | undefined): number | null {
  if (!cell) return null;
  const bracket = cell.match(/\(\$\s*([\d,]+(?:\.\d+)?)\)/);
  const plain = cell.trim().match(/^\$?\s*([\d,]+(?:\.\d+)?)$/);
  const raw = bracket?.[1] ?? plain?.[1];
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 && n < 100_000 ? Math.round(n * 100) / 100 : null;
}

const described = (r: string[]) => r[1]?.replace(/\s+/g, " ").trim() ?? "";

/** Every row with a code, a description and a price. Where a row has two prices, the first is taken. */
export function parseListItems(rows: string[][]): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const sku = r[0]?.trim();
    const name = described(r);
    const cost = parsePriceCell(r[2]) ?? parsePriceCell(r[3]);
    if (!sku || sku.length > 60 || !name || cost === null || seen.has(sku)) continue;
    seen.add(sku);
    items.push({ sku, name: name.slice(0, 100), cost });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

/**
 * The panels on a list: the rows priced per watt ("24.0c/w ($114.00)") whose description gives an output
 * ("Jinko 475W ..."). Where a row has a price for part pallets and one for full pallets, the first (the dearer) is taken.
 */
export function parseSupplierPanels(rows: string[][]): PanelProduct[] {
  const panels: PanelProduct[] = [];
  for (const r of rows) {
    const sku = r[0]?.trim();
    const name = described(r);
    const priced = [r[2], r[3]].find((cell) => cell && /c\/w/i.test(cell));
    const watts = name.match(/\b(\d{3})\s?w\b/i);
    const cost = parsePriceCell(priced?.match(/\(\$\s*[\d,]+(?:\.\d+)?\)/)?.[0]);
    if (!sku || !name || !watts || cost === null || panels.some((p) => p.sku === sku)) continue;
    panels.push({ sku, name: name.slice(0, 100), watts: Number(watts[1]), cost });
    if (panels.length >= 40) break;
  }
  return panels;
}

/** The inverters on a list: rows described as an inverter with a rating in kilowatts and a price. Microinverters are left out. */
export function parseSupplierInverters(rows: string[][]): InverterProduct[] {
  const inverters: InverterProduct[] = [];
  for (const r of rows) {
    const sku = r[0]?.trim();
    const name = described(r);
    const kw = name.match(/([\d.]+)\s?kw\b/i);
    const cost = parsePriceCell(r[2]) ?? parsePriceCell(r[3]);
    if (!sku || !name || !kw || cost === null || !/inverter|controller/i.test(name) || /micro/i.test(name)) continue;
    if (inverters.some((p) => p.sku === sku)) continue;
    inverters.push({ sku, name: name.slice(0, 100), kw: Number(kw[1]), cost });
    if (inverters.length >= 150) break;
  }
  return inverters;
}

/**
 * The batteries on a list: priced rows under a heading with "battery" in it (lists are set out in sections, each
 * under a heading row, with makers' names as headings of their own beneath), whose description says battery and
 * gives a size. Some lists write a battery's size as "kW": for a battery that figure is its kWh. Cables, stands,
 * covers, controllers and the like are left out. VERIFY sizes read this way against the datasheets.
 */
export function parseSupplierBatteries(rows: string[][]): BatteryProduct[] {
  const batteries: BatteryProduct[] = [];
  let underBatteries = false;
  for (const r of rows) {
    const sku = r[0]?.trim();
    const name = described(r);
    const cost = parsePriceCell(r[2]) ?? parsePriceCell(r[3]);
    if (sku && !name && cost === null) {
      if (/batter/i.test(sku)) underBatteries = true;
      else if (/panel|inverter|rack|mount|cable|optimi[sz]er|charger|meter/i.test(sku)) underBatteries = false;
      continue;
    }
    const size = name.match(/([\d.]+)\s?kwh?\b/i);
    if (!sku || cost === null || !size || !underBatteries || !/batter/i.test(name)) continue;
    if (/cable|handle|cover|stand|control|combiner|gateway|interface|accessor|inverter/i.test(name)) continue;
    if (batteries.some((b) => b.sku === sku)) continue;
    batteries.push({ sku, name: name.slice(0, 100), kwh: Number(size[1]), cost });
    if (batteries.length >= 60) break;
  }
  return batteries;
}

export function readSupplierList(name: string, rows: string[][], uploadedAt: string): SupplierList {
  return {
    name: name.slice(0, 120),
    uploadedAt,
    items: parseListItems(rows),
    panels: parseSupplierPanels(rows),
    inverters: parseSupplierInverters(rows),
    batteries: parseSupplierBatteries(rows),
  };
}

/** The lists with one added: newest first, a list of the same name replaced, the oldest dropped past the limit. */
export function withSupplierList(lists: readonly SupplierList[], added: SupplierList): SupplierList[] {
  return [added, ...lists.filter((l) => l.name !== added.name)].slice(0, MAX_SUPPLIER_LISTS);
}

// ---------------------------------------------------------------------------
// The parts every job needs, and what installing costs
// ---------------------------------------------------------------------------

/**
 * Parts the quote adds by rule. Each has a product code to look up on the uploaded lists, and may have a cost
 * typed in instead (which wins). The codes they start with are common wholesaler codes: change them to your own.
 */
export const COMPONENTS = [
  { key: "rail", label: "Rail, 4.8 m length", sku: "ANTRAIL4800/B" },
  { key: "splice", label: "Rail splice", sku: "ANTSPLICE" },
  { key: "tileKit", label: "Tile roof kit (per 2 kW)", sku: "ANTTILE20" },
  { key: "tinKit", label: "Tin roof kit (per 2 kW)", sku: "ANTTIN20" },
  { key: "kliplok", label: "Kliplok interface (flat roofs)", sku: "CLNER-I-34" },
  { key: "tiltLow", label: "Tilt kit, 10 to 15 degrees (per 2 kW)", sku: "ANTTILT10/15" },
  { key: "tiltHigh", label: "Tilt kit, 15 to 30 degrees (per 2 kW)", sku: "ANTTILT15/30" },
  { key: "meter1ph", label: "Smart meter, single phase", sku: "SGWS100" },
  { key: "meter3ph", label: "Smart meter, three phase", sku: "SGWDTSU666-20" },
  { key: "mc4", label: "MC4 connectors (pack)", sku: "MC4GENPR20" },
  { key: "isolator1ph", label: "AC isolator, single phase", sku: "NHPNL140L" },
  { key: "isolator3ph", label: "AC isolator, three phase", sku: "NHPNL340L" },
] as const;
export type ComponentKey = (typeof COMPONENTS)[number]["key"];

export interface ComponentChoice {
  sku: string;
  /** A cost typed in, ex GST: used in place of the price list's. */
  cost: number | null;
}

/** Installation, all ex GST. */
export const INSTALL_RATES = [
  { key: "pvPerWatt", label: "Solar installation", unit: "$ per watt", step: 0.01, max: 2 },
  { key: "doubleStorey", label: "Double storey", unit: "$", step: 10, max: 5000 },
  { key: "extraArray", label: "Each array beyond two", unit: "$", step: 10, max: 5000 },
  { key: "tiltPerPanel", label: "Tilt frames", unit: "$ per panel", step: 1, max: 500 },
  { key: "threePhase", label: "Three-phase installation", unit: "$", step: 10, max: 5000 },
  { key: "extraInverter", label: "Each additional inverter", unit: "$", step: 10, max: 10000 },
  { key: "battery", label: "Battery installation", unit: "$", step: 10, max: 20000 },
  { key: "backup", label: "Backup circuits for blackouts", unit: "$", step: 10, max: 10000 },
  { key: "inspection", label: "Electrical inspection", unit: "$", step: 10, max: 5000 },
  { key: "smartMeter", label: "Smart meter installation", unit: "$", step: 10, max: 5000 },
  { key: "fallProtection", label: "Fall protection", unit: "$", step: 10, max: 5000 },
] as const;
export type InstallKey = (typeof INSTALL_RATES)[number]["key"];
export type InstallRates = Record<InstallKey, number>;

export interface QuoteSettings {
  margin: {
    /** Base margin for systems with a battery, $ ex GST. */
    base: number;
    /** Base margin for solar-only systems. */
    solarOnlyBase: number;
    /** Solar beyond this size adds `perKwAbove` a kW. */
    baseKw: number;
    perKwAbove: number;
    perBatteryKwh: number;
  };
  /** Sales commission, counted as a cost before margin. */
  commission: { perPvKw: number; perBatteryKwh: number };
  /** $ per STC credited to customers (a market price; the clearing house caps it at $40). */
  stcPrice: number;
  /** Cable, conduit, labels and sundries not itemised, $ per job. */
  sundries: number;
  bill: {
    /** Share of solar a home uses as it's made, without a battery (0 to 1). */
    selfUseShare: number;
    /** What a new job's bill starts with, until the customer's own figures are typed in. */
    rate: number;
    feedIn: number;
    supplyPerDay: number;
  };
}

export interface SettingField {
  path: string;
  label: string;
  help?: string;
  unit: "$" | "kW" | "%" | "$/kWh" | "$/day";
  min: number;
  max: number;
  step: number;
}

/** The settings form, and the bounds every saved value is held to. Shares (0 to 1) are edited as percentages. */
export const SETTING_GROUPS: { title: string; intro: string; fields: SettingField[] }[] = [
  {
    title: "Margin",
    intro: "Your margin on each job, after hardware, installation and commission. It grows with system size, not with supplier prices.",
    fields: [
      { path: "margin.base", label: "Base margin, with a battery", unit: "$", min: 0, max: 50000, step: 50 },
      { path: "margin.solarOnlyBase", label: "Base margin, solar only", unit: "$", min: 0, max: 50000, step: 50 },
      { path: "margin.baseKw", label: "Solar size the base covers", unit: "kW", min: 0, max: 100, step: 0.1 },
      { path: "margin.perKwAbove", label: "Added per kW above that", unit: "$", min: 0, max: 5000, step: 10 },
      { path: "margin.perBatteryKwh", label: "Added per kWh of battery", unit: "$", min: 0, max: 2000, step: 5 },
    ],
  },
  {
    title: "Fixed costs",
    intro: "Costs counted on every job before margin.",
    fields: [
      { path: "sundries", label: "Sundries allowance per job", unit: "$", min: 0, max: 5000, step: 10, help: "Cable, conduit, labels." },
      { path: "commission.perPvKw", label: "Sales commission per kW of solar", unit: "$", min: 0, max: 2000, step: 5 },
      { path: "commission.perBatteryKwh", label: "Sales commission per kWh of battery", unit: "$", min: 0, max: 2000, step: 5 },
      {
        path: "stcPrice",
        label: "STC price credited to customers",
        unit: "$",
        min: 1,
        max: 40,
        step: 0.5,
        help: "The clearing house caps this at $40.",
      },
    ],
  },
  {
    title: "Electricity bill",
    intro: "What a new job's bill starts with, until you type in the customer's own figures, and how a home is taken to use its solar.",
    fields: [
      { path: "bill.rate", label: "Price per kWh", unit: "$/kWh", min: 0.05, max: 1.5, step: 0.01 },
      { path: "bill.feedIn", label: "Feed-in tariff", unit: "$/kWh", min: 0, max: 0.5, step: 0.005 },
      { path: "bill.supplyPerDay", label: "Daily supply charge", unit: "$/day", min: 0, max: 5, step: 0.01 },
      { path: "bill.selfUseShare", label: "Solar used as it's made (no battery)", unit: "%", min: 0.1, max: 0.8, step: 0.01 },
    ],
  },
];

/** One business's settings. */
export interface Workspace {
  /** Newest first. */
  lists: SupplierList[];
  components: Record<ComponentKey, ComponentChoice>;
  install: InstallRates;
  settings: QuoteSettings;
}

/** Somewhere to begin. The installation figures are placeholders: a business replaces them with its own. */
export const DEFAULT_WORKSPACE: Workspace = {
  lists: [],
  components: Object.fromEntries(COMPONENTS.map((c) => [c.key, { sku: c.sku, cost: null }])) as Record<ComponentKey, ComponentChoice>,
  install: {
    pvPerWatt: 0.3,
    doubleStorey: 400,
    extraArray: 150,
    tiltPerPanel: 15,
    threePhase: 150,
    extraInverter: 0,
    battery: 1800,
    backup: 1000,
    inspection: 0,
    smartMeter: 0,
    fallProtection: 0,
  },
  settings: {
    margin: { base: 2000, solarOnlyBase: 1000, baseKw: 6.6, perKwAbove: 100, perBatteryKwh: 60 },
    commission: { perPvKw: 0, perBatteryKwh: 0 },
    stcPrice: 38,
    sundries: 120,
    bill: { selfUseShare: 0.35, rate: 0.3, feedIn: 0.04, supplyPerDay: 1 },
  },
};

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === "object" ? (v as Bag) : {});
const read = (obj: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => bag(o)[k], obj);
function write(obj: Bag, path: string, value: number) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {}) as Bag;
  o[keys[keys.length - 1]] = value;
}
const numberIn = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function getSetting(settings: QuoteSettings, path: string): number {
  return read(settings, path) as number;
}

export function withSetting(settings: QuoteSettings, path: string, value: number): QuoteSettings {
  const next = structuredClone(settings) as unknown as Bag;
  write(next, path, value);
  return cleanSettings(next);
}

/** Saved settings read back: every field a number within its bounds, anything missing or wrong replaced by the starting figure. */
export function cleanSettings(raw: unknown): QuoteSettings {
  const out = structuredClone(DEFAULT_WORKSPACE.settings) as unknown as Bag;
  for (const f of SETTING_GROUPS.flatMap((g) => g.fields)) {
    const n = numberIn(read(raw, f.path), f.min, f.max);
    if (n !== null) write(out, f.path, n);
  }
  return out as unknown as QuoteSettings;
}

function cleanItems<T extends ListItem>(raw: unknown, max: number, extra: (r: Bag) => Partial<T> | null): T[] {
  const out: T[] = [];
  for (const entry of Array.isArray(raw) ? raw.slice(0, max) : []) {
    const r = bag(entry);
    const sku = text(r.sku, 60);
    const cost = numberIn(r.cost, 0, 100_000);
    const more = extra(r);
    if (!sku || cost === null || cost <= 0 || !more) continue;
    out.push({ sku, name: text(r.name, 100) || sku, cost, ...more } as T);
  }
  return out;
}

const sized = (key: string, max: number) => (r: Bag) => {
  const n = numberIn(r[key], 0, max);
  return n !== null && n > 0 ? { [key]: n } : null;
};

/** A workspace from outside (this device's storage, or a server): checked and trimmed, never trusted as it arrived. */
export function cleanWorkspace(raw: unknown): Workspace {
  const r = bag(raw);
  const lists: SupplierList[] = [];
  for (const entry of Array.isArray(r.lists) ? r.lists.slice(0, MAX_SUPPLIER_LISTS) : []) {
    const l = bag(entry);
    const name = text(l.name, 120);
    if (!name) continue;
    lists.push({
      name,
      uploadedAt: text(l.uploadedAt, 30),
      items: cleanItems<ListItem>(l.items, MAX_ITEMS, () => ({})),
      panels: cleanItems<PanelProduct>(l.panels, 40, sized("watts", 1000)),
      inverters: cleanItems<InverterProduct>(l.inverters, 150, sized("kw", 500)),
      batteries: cleanItems<BatteryProduct>(l.batteries, 60, sized("kwh", 500)),
    });
  }
  const components = structuredClone(DEFAULT_WORKSPACE.components);
  for (const c of COMPONENTS) {
    const given = bag(bag(r.components)[c.key]);
    const cost = numberIn(given.cost, 0, 100_000);
    components[c.key] = { sku: typeof given.sku === "string" ? text(given.sku, 60) : c.sku, cost: given.cost === null ? null : cost };
  }
  const install = { ...DEFAULT_WORKSPACE.install };
  for (const rate of INSTALL_RATES) {
    const n = numberIn(bag(r.install)[rate.key], 0, rate.max);
    if (n !== null) install[rate.key] = n;
  }
  return { lists, components, install, settings: cleanSettings(r.settings) };
}

// ---------------------------------------------------------------------------
// Looking things up
// ---------------------------------------------------------------------------

/** A product's row on the uploaded lists, the newest list that has it. */
export function listed(workspace: Pick<Workspace, "lists">, sku: string): ListItem | null {
  if (!sku) return null;
  for (const list of workspace.lists) {
    const hit = list.items.find((i) => i.sku === sku);
    if (hit) return hit;
  }
  return null;
}

/** What a part costs: the figure typed in, else the price list's. Null when neither is there. */
export function componentCost(workspace: Workspace, key: ComponentKey): number | null {
  const choice = workspace.components[key];
  return choice.cost ?? listed(workspace, choice.sku)?.cost ?? null;
}

const once = <T extends { sku: string }>(all: T[]) => all.filter((p, i) => all.findIndex((x) => x.sku === p.sku) === i);

/**
 * Panel sizes in metres, long side then short, by product code. A price list doesn't give a panel's size, so
 * these are from the makers' datasheets: VERIFY each. A panel that isn't here is drawn at the usual size and
 * the designer says so.
 */
const PANEL_SIZES: Record<string, [number, number]> = {
  "JKM475N-48QL6-DV": [PANEL.long, PANEL.short],
  "JKM475N-48QL6-DB": [PANEL.long, PANEL.short],
  "JKM595N-72HL4-BDV": [2.278, 1.134],
};

/** The designer's lists, from the uploaded price lists: null for a kind the lists don't carry. Never a cost. */
export function workspaceCatalogue(workspace: Pick<Workspace, "lists">): {
  panels: CataloguePanel[] | null;
  inverters: CatalogueInverter[] | null;
  batteries: CatalogueBattery[] | null;
} {
  const panels = once(workspace.lists.flatMap((l) => l.panels));
  const inverters = once(workspace.lists.flatMap((l) => l.inverters));
  const batteries = once(workspace.lists.flatMap((l) => l.batteries));
  return {
    panels: panels.length
      ? panels.map((p) => {
          const size = PANEL_SIZES[p.sku];
          return {
            sku: p.sku,
            name: p.name,
            watts: p.watts,
            long: size?.[0] ?? PANEL.long,
            short: size?.[1] ?? PANEL.short,
            sizeKnown: Boolean(size),
            ...(PANEL_ELECTRICAL[p.sku] ? { electrical: PANEL_ELECTRICAL[p.sku] } : {}),
          };
        })
      : null,
    inverters: inverters.length
      ? inverters.map((i) => ({
          sku: i.sku,
          name: i.name,
          kw: i.kw,
          ...(INVERTER_ELECTRICAL[i.sku] ? { electrical: INVERTER_ELECTRICAL[i.sku] } : {}),
        }))
      : null,
    batteries: batteries.length ? batteries.map((b) => ({ sku: b.sku, name: b.name, kwh: b.kwh })) : null,
  };
}

/** Margin: a base (lower for solar only) that grows with system size, never with supplier prices. */
export function marginFor(pvKw: number, batteryKwh: number, m: QuoteSettings["margin"]): number {
  const base = batteryKwh > 0 ? m.base : m.solarOnlyBase;
  return Math.round(base + Math.max(0, pvKw - m.baseKw) * m.perKwAbove + batteryKwh * m.perBatteryKwh);
}

export function commissionFor(pvKw: number, batteryKwh: number, c: QuoteSettings["commission"]): number {
  return Math.round(pvKw * c.perPvKw + batteryKwh * c.perBatteryKwh);
}
