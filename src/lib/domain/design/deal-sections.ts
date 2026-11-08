/**
 * A deal's fields, in the tabs the deal shows them under (Martin: as Primero's
 * deal view has them: System, Installation, Network, Financials), and each
 * business's own arrangement of them (Settings → Deal fields): any tab or field
 * renamed, moved, hidden or put in another order, the choices on a dropdown
 * changed, and fields and tabs of its own added.
 *
 * Every field is one of four sources. **design**: a system detail the deal's
 * design fills in, typed over by hand. **typed**: one of ours, typed in on the
 * deal. **known**: filled from what the deal already knows (the install date,
 * the installer, the progress lists, and from the signed proposal its price,
 * STCs and deposit), shown, never typed. **custom**: the business's own, typed
 * in. Typed values are kept on the job's details, each cleaned by its kind and,
 * for a dropdown, against the business's own choices. Pure, tested.
 */

export type FieldKind = "text" | "long" | "date" | "select" | "money" | "number";
export type FieldSource = "design" | "typed" | "known" | "custom";

/** A field that can be typed in, as the server cleans it. */
export interface SectionField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
}

/** One of our fields, where it starts out and how it is filled. */
export interface FieldInfo extends SectionField {
  source: Exclude<FieldSource, "custom">;
  tab: BuiltinTab;
}

export const BUILTIN_TABS = ["system", "installation", "network", "financials"] as const;
export type BuiltinTab = (typeof BUILTIN_TABS)[number];
export const TAB_LABELS: Record<BuiltinTab, string> = {
  system: "System",
  installation: "Installation",
  network: "Network",
  financials: "Financials",
};

export const BOOKING_STATUS = ["Not booked", "Tentative", "Booked", "Confirmed", "Rescheduled"];
export const SITE_INSPECTION = ["Not needed", "To book", "Booked", "Done"];
export const PRE_APPROVAL = ["Not submitted", "Submitted", "Approved", "Approved, export limited", "Declined"];
export const SOLAR_VIC_STATUS = ["Not applying", "Eligibility to check", "Applied", "Approved", "Claimed", "Not eligible"];
export const FINANCE = ["None", "Solar Victoria loan", "Green loan", "Bank or broker", "Other"];

const design = (key: string, label: string): FieldInfo => ({ key, label, kind: "text", source: "design", tab: "system" });
const known = (tab: BuiltinTab, key: string, label: string): FieldInfo => ({ key, label, kind: "text", source: "known", tab });
const typed = (tab: BuiltinTab, key: string, label: string, kind: FieldKind, options?: string[]): FieldInfo => ({
  key,
  label,
  kind,
  source: "typed",
  tab,
  ...(options ? { options } : {}),
});

/** Our fields, in their starting order. The design ones are the system details (`DETAIL_KEYS`, less those moved here). */
export const BUILTIN_FIELDS: readonly FieldInfo[] = [
  design("systemType", "System type"),
  design("systemSize", "System size"),
  design("propertyType", "Property type"),
  design("storeys", "Property storeys"),
  design("roofType", "Roof type"),
  design("phases", "Phases"),
  design("panel", "PV panel"),
  design("panelQty", "Panel qty"),
  design("inverter", "Inverter"),
  design("inverterQty", "Inverter qty"),
  design("additionalInverter", "Additional inverter"),
  design("inverterCapacity", "Inverter capacity"),
  design("optimisers", "Optimisers"),
  design("battery", "Battery"),
  design("batteryQty", "Battery qty"),
  design("batteryStorage", "Battery storage"),
  design("evCharger", "EV charger"),
  design("arrays", "Arrays"),
  design("strings", "Strings"),
  design("tiltFrames", "Tilt frames"),
  design("switchboard", "Switchboard"),

  known("installation", "installDate", "Installation date"),
  known("installation", "installer", "Installer"),
  typed("installation", "generalNotes", "General important notes", "long"),
  typed("installation", "installNotes", "Installation notes", "long"),
  typed("installation", "bookingStatus", "Booking status", "select", BOOKING_STATUS),
  typed("installation", "siteInspection", "Site inspection", "select", SITE_INSPECTION),
  typed("installation", "siteInspectionDate", "Site inspection date", "date"),
  typed("installation", "siteAccess", "Site access", "text"),

  typed("network", "distributor", "Distributor", "text"),
  typed("network", "nmi", "NMI", "text"),
  typed("network", "retailer", "Electricity retailer", "text"),
  typed("network", "meterNo", "Meter number", "text"),
  typed("network", "preApproval", "Network pre-approval", "select", PRE_APPROVAL),
  typed("network", "preApprovalRef", "Pre-approval reference", "text"),
  typed("network", "exportLimiting", "Export limiting", "select", ["No", "Yes"]),
  typed("network", "exportLimit", "Export limit (kW)", "text"),
  known("network", "gridConnection", "Grid connection"),

  known("financials", "incGst", "Price, inc. GST"),
  known("financials", "stc", "STC value"),
  known("financials", "youPay", "Customer pays"),
  known("financials", "depositAsked", "Deposit"),
  known("financials", "depositReceived", "Deposit received"),
  typed("financials", "solarVicStatus", "Solar Victoria status", "select", SOLAR_VIC_STATUS),
  typed("financials", "solarVicRebate", "Solar Victoria rebate", "money"),
  typed("financials", "solarVicLoan", "Solar Victoria loan", "money"),
  typed("financials", "batteryRebate", "Battery rebate", "money"),
  typed("financials", "finance", "Finance", "select", FINANCE),
  typed("financials", "commission", "Commission", "money"),
  typed("financials", "discount", "Discount", "money"),
  known("financials", "customerInvoice", "Customer invoice"),
  known("financials", "stcClaim", "STCs"),
];

const BUILTIN = new Map(BUILTIN_FIELDS.map((f) => [f.key, f]));
/** System details shown under another tab instead (they are typed in there). */
export const MOVED_FROM_SYSTEM = ["distributor", "nmi", "siteAccess"] as const;

// ---------------------------------------------------------------------------
// A business's arrangement
// ---------------------------------------------------------------------------

export interface FieldSetting {
  key: string;
  label: string;
  hidden: boolean;
  /** A custom field's kind; ours keep theirs. */
  kind?: FieldKind;
  /** A dropdown's choices: a custom one's, or the business's own for one of ours. */
  options?: string[];
}
export interface TabSetting {
  id: string;
  label: string;
  hidden: boolean;
  fields: FieldSetting[];
}
export interface DealFieldsConfig {
  tabs: TabSetting[];
}

export const MAX_TABS = 8;
export const MAX_CUSTOM_FIELDS = 40;
export const MAX_OPTIONS = 30;
export const CUSTOM_KINDS: readonly FieldKind[] = ["text", "long", "date", "select", "money", "number"];
export const KIND_LABELS: Record<FieldKind, string> = {
  text: "Text",
  long: "Notes",
  date: "Date",
  select: "Dropdown",
  money: "Dollars",
  number: "Number",
};
const CUSTOM_KEY = /^c_[a-z0-9]{4,20}$/;
const CUSTOM_TAB = /^t_[a-z0-9]{4,20}$/;

/** The arrangement every business starts with: our four tabs, our fields in our order. */
export function defaultDealFields(): DealFieldsConfig {
  return {
    tabs: BUILTIN_TABS.map((id) => ({
      id,
      label: TAB_LABELS[id],
      hidden: false,
      fields: BUILTIN_FIELDS.filter((f) => f.tab === id).map((f) => ({ key: f.key, label: f.label, hidden: false })),
    })),
  };
}

const words = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
const cleanOptions = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((o) => words(o, 60)).filter(Boolean))].slice(0, MAX_OPTIONS) : [];

/**
 * What the browser sent, as an arrangement to keep: known tabs and fields only, each field once, every one of ours
 * present (one left out goes back at the end of its own tab, shown), a dropdown always with at least one choice, and at
 * least one tab.
 */
export function cleanDealFields(raw: unknown): DealFieldsConfig {
  const r = raw && typeof raw === "object" ? (raw as { tabs?: unknown }) : {};
  const given = Array.isArray(r.tabs) ? r.tabs : [];
  const seenTabs = new Set<string>();
  const seenFields = new Set<string>();
  let customs = 0;
  const tabs: TabSetting[] = [];
  for (const t of given) {
    if (!t || typeof t !== "object" || tabs.length >= MAX_TABS) continue;
    const tab = t as Record<string, unknown>;
    const id = typeof tab.id === "string" ? tab.id : "";
    if (seenTabs.has(id) || !((BUILTIN_TABS as readonly string[]).includes(id) || CUSTOM_TAB.test(id))) continue;
    seenTabs.add(id);
    const fields: FieldSetting[] = [];
    for (const f of Array.isArray(tab.fields) ? tab.fields : []) {
      if (!f || typeof f !== "object") continue;
      const field = f as Record<string, unknown>;
      const key = typeof field.key === "string" ? field.key : "";
      if (seenFields.has(key)) continue;
      const ours = BUILTIN.get(key);
      if (!ours && !(CUSTOM_KEY.test(key) && customs < MAX_CUSTOM_FIELDS)) continue;
      const kind = ours ? ours.kind : CUSTOM_KINDS.includes(field.kind as FieldKind) ? (field.kind as FieldKind) : "text";
      const label = words(field.label, 60) || ours?.label || "Untitled field";
      const setting: FieldSetting = { key, label, hidden: field.hidden === true };
      if (!ours) setting.kind = kind;
      if (kind === "select" && (!ours || ours.source === "typed")) {
        const options = cleanOptions(field.options);
        if (options.length) setting.options = options;
        else if (!ours) setting.options = ["Yes", "No"];
      }
      seenFields.add(key);
      if (!ours) customs++;
      fields.push(setting);
    }
    tabs.push({ id, label: words(tab.label, 30) || TAB_LABELS[id as BuiltinTab] || "Untitled tab", hidden: tab.hidden === true, fields });
  }
  // Every one of ours is somewhere: back at the end of its own tab (made again if it was taken out), else the first.
  for (const f of BUILTIN_FIELDS) {
    if (seenFields.has(f.key)) continue;
    let home = tabs.find((t) => t.id === f.tab);
    if (!home && tabs.length < MAX_TABS) tabs.push((home = { id: f.tab, label: TAB_LABELS[f.tab], hidden: false, fields: [] }));
    (home ?? tabs[0]).fields.push({ key: f.key, label: f.label, hidden: false });
  }
  return { tabs };
}

/** A field as the deal shows it: ours or the business's, with the business's name, choices and whether it is shown. */
export interface ResolvedField extends SectionField {
  source: FieldSource;
  hidden: boolean;
}
export interface ResolvedTab {
  id: string;
  label: string;
  hidden: boolean;
  fields: ResolvedField[];
}

/** The arrangement with each field's kind and choices filled in. Null (never set) is our starting one. */
export function resolveDealFields(config: DealFieldsConfig | null | undefined): ResolvedTab[] {
  const c = config ? cleanDealFields(config) : defaultDealFields();
  return c.tabs.map((t) => ({
    id: t.id,
    label: t.label,
    hidden: t.hidden,
    fields: t.fields.map((f): ResolvedField => {
      const ours = BUILTIN.get(f.key);
      const kind = ours?.kind ?? f.kind ?? "text";
      const options = kind === "select" ? (f.options ?? ours?.options) : undefined;
      return { key: f.key, label: f.label, kind, source: ours?.source ?? "custom", hidden: f.hidden, ...(options ? { options } : {}) };
    }),
  }));
}

/** Every field that is typed in under this arrangement (ours and the business's), as the server cleans them. */
export function typedFields(config: DealFieldsConfig | null | undefined): SectionField[] {
  return resolveDealFields(config)
    .flatMap((t) => t.fields)
    .filter((f) => f.source === "typed" || f.source === "custom")
    .map(({ key, label, kind, options }) => ({ key, label, kind, ...(options ? { options } : {}) }));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** One typed value as kept: in range for its kind, or "" (left out). */
export function cleanFieldValue(field: SectionField, raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (!text) return "";
  switch (field.kind) {
    case "long":
      return text.replace(/\r/g, "").slice(0, 2000);
    case "date":
      return DATE.test(text) ? text : "";
    case "select":
      return field.options?.includes(text) ? text : "";
    case "money":
    case "number": {
      const n = Number(text.replace(/[$,\s]/g, ""));
      return Number.isFinite(n) && Math.abs(n) <= 10_000_000 && (field.kind === "number" || n >= 0)
        ? String(Math.round(n * 100) / 100)
        : "";
    }
    default:
      return text.replace(/\n/g, " ").slice(0, 120);
  }
}

/** Every typed field's value, cleaned against the business's arrangement (ours when it has none); the rest left out. */
export function cleanSectionDetails(
  raw: Record<string, unknown>,
  fields: readonly SectionField[] = typedFields(null),
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const f of fields) {
    const v = cleanFieldValue(f, raw[f.key]);
    if (v) kept[f.key] = v;
  }
  return kept;
}

// ---------------------------------------------------------------------------
// What a deal shows
// ---------------------------------------------------------------------------

/** What the signed proposal says, for Financials. Null fields: not known (no signed proposal, or not on it). */
export interface SignedFigures {
  incGst: number | null;
  stc: number | null;
  youPay: number | null;
  depositAsked: number | null;
  depositReceived: number | null;
  solarVicRebate: number | null;
  solarVicLoan: number | null;
}

export interface SectionLine {
  key: string;
  label: string;
  source: FieldSource;
  /** What shows: typed, else filled from what is known, else null. */
  value: string | null;
  /** Filled from what is known, when it was. */
  filled: string | null;
  typed: boolean;
  /** The field to type into; null for a known line. */
  field: SectionField | null;
}

const money = (n: number | null) =>
  n === null ? null : `$${n.toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const PROGRESS_WORDS: Record<string, string> = {
  "not-issued": "Not issued",
  pending: "Pending",
  paid: "Paid",
  "not-claimed": "Not claimed",
  claimed: "Claimed",
  underway: "Underway",
  completed: "Completed",
};

/**
 * One field's line on the deal. A design field's value is what the design says or what was typed over it (`designed`
 * holds the design's own); a typed or custom one is what was typed, else what is filled from the proposal; a known one
 * is what the deal already knows.
 */
export function fieldLine(
  f: ResolvedField,
  details: Record<string, string>,
  ctx: {
    installDate: string | null;
    installer: string | null;
    signed: SignedFigures | null;
    designed?: Record<string, string>;
    /** The distributor worked out from the deal's NMI or address (networks.ts `distributorFor`), until one is typed. */
    distributor?: string | null;
  },
): SectionLine {
  const s = ctx.signed;
  if (f.source === "known") {
    const value: Record<string, string | null> = {
      installDate: ctx.installDate,
      installer: ctx.installer,
      incGst: money(s?.incGst ?? null),
      stc: money(s?.stc ?? null),
      youPay: money(s?.youPay ?? null),
      depositAsked: s ? (s.depositAsked ? money(s.depositAsked) : "None asked") : null,
      depositReceived: s ? (s.depositReceived ? money(s.depositReceived) : "Not yet") : null,
      gridConnection: details.gridConnection ? (PROGRESS_WORDS[details.gridConnection] ?? details.gridConnection) : null,
      customerInvoice: details.customerInvoice ? (PROGRESS_WORDS[details.customerInvoice] ?? details.customerInvoice) : null,
      stcClaim: details.stcClaim ? (PROGRESS_WORDS[details.stcClaim] ?? details.stcClaim) : null,
    };
    const v = value[f.key] ?? null;
    return { key: f.key, label: f.label, source: "known", value: v, filled: v, typed: false, field: null };
  }
  const field: SectionField = { key: f.key, label: f.label, kind: f.kind, ...(f.options ? { options: f.options } : {}) };
  const filled =
    f.source === "design"
      ? (ctx.designed?.[f.key] ?? null)
      : f.key === "solarVicRebate" && s?.solarVicRebate
        ? money(s.solarVicRebate)
        : f.key === "solarVicLoan" && s?.solarVicLoan
          ? money(s.solarVicLoan)
          : f.key === "distributor"
            ? (ctx.distributor ?? null)
            : null;
  const raw = details[f.key];
  const shown = raw ? (f.kind === "money" ? money(Number(raw)) : raw) : null;
  return { key: f.key, label: f.label, source: f.source, value: shown ?? filled, filled, typed: Boolean(raw), field };
}
