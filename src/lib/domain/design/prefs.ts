/**
 * A business's smaller settings for what happens after a sale: its
 * suppliers' order addresses, the tolerance an installer's invoice is
 * checked against, and the automations that reach its customers (each with
 * its own switch, off until the business turns it on). Kept as one record a
 * business (`design_prefs`), always through `cleanPrefs`. Pure, tested.
 */
import { cleanDealFields, type DealFieldsConfig } from "./deal-sections";
import { NO_TARGETS, cleanTargets, type SalesTargets } from "./sales-rings";

/** A supplier's details for orders, against the name its price list was uploaded under. */
export interface SupplierContact {
  /** The supplier's name as it should read on an order ("AWM Clayton"); the list's name when blank. */
  label: string;
  /** Where its purchase orders are emailed. */
  email: string;
}

export interface BusinessPrefs {
  /** By price list name. */
  suppliers: Record<string, SupplierContact>;
  /** Price list names, the preferred first: a product on several lists is ordered from the first. */
  supplierRank: string[];
  /** An installer's invoice within this many dollars (ex GST) of the quote's allowance matches. */
  invoiceTolerance: number;
  automations: {
    /** Emails the customer before their installation day, so they can get ready. */
    installReminders: boolean;
  };
  /** How many days before the installation the reminder goes. */
  reminderDaysBefore: number;
  /** The business's own arrangement of a deal's fields (Settings → Deal fields); null: ours. */
  dealFields: DealFieldsConfig | null;
  /** The month's sales targets the overview's rings close at (Settings → Sales targets); null each: its own 3-month average. */
  targets: SalesTargets;
}

export const DEFAULT_PREFS: BusinessPrefs = {
  suppliers: {},
  supplierRank: [],
  invoiceTolerance: 50,
  automations: { installReminders: false },
  reminderDaysBefore: 2,
  dealFields: null,
  targets: NO_TARGETS,
};

export const MAX_SUPPLIERS = 12;
export const REMINDER_DAY_CHOICES = [1, 2, 3, 5, 7] as const;

const EMAIL = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,24}$/i;

const text = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** Whatever was sent, as a whole and valid set of preferences: anything unknown or out of range falls back to the default. */
export function cleanPrefs(raw: unknown): BusinessPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const suppliers: Record<string, SupplierContact> = {};
  const given = r.suppliers && typeof r.suppliers === "object" ? (r.suppliers as Record<string, unknown>) : {};
  for (const [name, value] of Object.entries(given).slice(0, MAX_SUPPLIERS)) {
    const key = text(name, 120);
    if (!key || !value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const email = text(v.email, 254);
    suppliers[key] = { label: text(v.label, 80), email: EMAIL.test(email) ? email : "" };
  }
  const rank = Array.isArray(r.supplierRank)
    ? [...new Set(r.supplierRank.map((n) => text(n, 120)).filter(Boolean))].slice(0, MAX_SUPPLIERS)
    : [];
  const tolerance = Number(r.invoiceTolerance);
  const auto = r.automations && typeof r.automations === "object" ? (r.automations as Record<string, unknown>) : {};
  const days = Number(r.reminderDaysBefore);
  return {
    suppliers,
    supplierRank: rank,
    invoiceTolerance:
      Number.isFinite(tolerance) && tolerance >= 0 && tolerance <= 2000 ? Math.round(tolerance) : DEFAULT_PREFS.invoiceTolerance,
    automations: { installReminders: auto.installReminders === true },
    reminderDaysBefore: (REMINDER_DAY_CHOICES as readonly number[]).includes(days) ? days : DEFAULT_PREFS.reminderDaysBefore,
    dealFields: r.dealFields && typeof r.dealFields === "object" ? cleanDealFields(r.dealFields) : null,
    targets: cleanTargets(r.targets),
  };
}

/** A supplier's name as it reads on an order: the name the business gave it, else one read from its price list's file name. */
export function supplierLabel(prefs: BusinessPrefs, list: string): string {
  return prefs.suppliers[list]?.label || nameFromList(list);
}

const MONTHS =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/gi;
/**
 * A supplier's name from its price list's file name: "AWM CLAYTON OCTOBER SOLAR PRICE LIST (1).xlsx" reads as "AWM
 * Clayton". The file's extension, copy numbers, months, years and the words "solar" and "price list" go; short words in
 * capitals (AWM) stay as they are.
 */
export function nameFromList(list: string): string {
  const words = list
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/\(\d+\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\bprice ?lists?\b|\bpricelist\b|\bsolar\b|\bq[1-4]\b|\b20\d\d\b|\b\d{1,2}\b/gi, " ")
    .replace(MONTHS, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));
  return words.join(" ") || list;
}

/** Price list names in the business's order of preference: the ranked ones first, then the rest as uploaded (newest first). */
export function rankedLists(prefs: BusinessPrefs, lists: readonly string[]): string[] {
  return [...prefs.supplierRank.filter((n) => lists.includes(n)), ...lists.filter((n) => !prefs.supplierRank.includes(n))];
}
