/**
 * A deal's fields beyond its system, in the tabs the deal shows them under
 * (Martin: as Primero's deal view has them): Installation, Network and
 * Financials. Each is typed in on the deal and kept on the job's details;
 * a few are filled from what is already known (the install date, the
 * installer, the progress lists, and from the signed proposal its price,
 * STCs, deposit and Solar Victoria figures), and a typed value always wins.
 * Pure, tested.
 */

export type FieldKind = "text" | "long" | "date" | "select" | "money";

export interface SectionField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
}

export interface DealSection {
  id: "system" | "installation" | "network" | "financials";
  label: string;
  /** System's fields are the system details (`DETAIL_KEYS`); the others are these. */
  fields: readonly SectionField[];
}

export const BOOKING_STATUS = ["Not booked", "Tentative", "Booked", "Confirmed", "Rescheduled"] as const;
export const SITE_INSPECTION = ["Not needed", "To book", "Booked", "Done"] as const;
export const PRE_APPROVAL = ["Not submitted", "Submitted", "Approved", "Approved, export limited", "Declined"] as const;
export const SOLAR_VIC_STATUS = ["Not applying", "Eligibility to check", "Applied", "Approved", "Claimed", "Not eligible"] as const;
export const FINANCE = ["None", "Solar Victoria loan", "Green loan", "Bank or broker", "Other"] as const;

export const DEAL_SECTIONS: readonly DealSection[] = [
  { id: "system", label: "System", fields: [] },
  {
    id: "installation",
    label: "Installation",
    fields: [
      { key: "generalNotes", label: "General important notes", kind: "long" },
      { key: "installNotes", label: "Installation notes", kind: "long" },
      { key: "bookingStatus", label: "Booking status", kind: "select", options: BOOKING_STATUS },
      { key: "siteInspection", label: "Site inspection", kind: "select", options: SITE_INSPECTION },
      { key: "siteInspectionDate", label: "Site inspection date", kind: "date" },
      { key: "siteAccess", label: "Site access", kind: "text" },
    ],
  },
  {
    id: "network",
    label: "Network",
    fields: [
      { key: "distributor", label: "Distributor", kind: "text" },
      { key: "nmi", label: "NMI", kind: "text" },
      { key: "retailer", label: "Electricity retailer", kind: "text" },
      { key: "meterNo", label: "Meter number", kind: "text" },
      { key: "preApproval", label: "Network pre-approval", kind: "select", options: PRE_APPROVAL },
      { key: "preApprovalRef", label: "Pre-approval reference", kind: "text" },
      { key: "exportLimiting", label: "Export limiting", kind: "select", options: ["No", "Yes"] },
      { key: "exportLimit", label: "Export limit (kW)", kind: "text" },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    fields: [
      { key: "solarVicStatus", label: "Solar Victoria status", kind: "select", options: SOLAR_VIC_STATUS },
      { key: "solarVicRebate", label: "Solar Victoria rebate", kind: "money" },
      { key: "solarVicLoan", label: "Solar Victoria loan", kind: "money" },
      { key: "batteryRebate", label: "Battery rebate", kind: "money" },
      { key: "finance", label: "Finance", kind: "select", options: FINANCE },
      { key: "commission", label: "Commission", kind: "money" },
      { key: "discount", label: "Discount", kind: "money" },
    ],
  },
];

export const SECTION_FIELDS: readonly SectionField[] = DEAL_SECTIONS.flatMap((s) => s.fields);

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
    case "money": {
      const n = Number(text.replace(/[$,\s]/g, ""));
      return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? String(Math.round(n * 100) / 100) : "";
    }
    default:
      return text.replace(/\n/g, " ").slice(0, 120);
  }
}

/** System details shown under another tab instead (they are typed in there). */
export const MOVED_FROM_SYSTEM = ["distributor", "nmi", "siteAccess"] as const;

/** Every section field typed in, cleaned; the rest left out. */
export function cleanSectionDetails(raw: Record<string, unknown>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const f of SECTION_FIELDS) {
    const v = cleanFieldValue(f, raw[f.key]);
    if (v) kept[f.key] = v;
  }
  return kept;
}

/** What the signed proposal says, for the Financials tab. Null fields: not known (no signed proposal, or not on it). */
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
  /** What shows: typed, else filled from what is known, else null. */
  value: string | null;
  /** Filled from what is known (shown as such), when it was. */
  filled: string | null;
  typed: boolean;
  field: SectionField | null;
}

const money = (n: number | null) =>
  n === null ? null : `$${n.toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** A known line no one types: shown read-only. */
const known = (key: string, label: string, value: string | null): SectionLine => ({
  key,
  label,
  value,
  filled: value,
  typed: false,
  field: null,
});

/**
 * One tab's lines, in order: the fields that can be typed in (typed wins over what is filled from the deal), with the
 * lines already known elsewhere set among them.
 */
export function sectionLines(
  id: Exclude<DealSection["id"], "system">,
  details: Record<string, string>,
  ctx: { installDate: string | null; installer: string | null; signed: SignedFigures | null },
): SectionLine[] {
  const section = DEAL_SECTIONS.find((s) => s.id === id)!;
  const filled: Record<string, string | null> = {
    solarVicRebate: ctx.signed?.solarVicRebate ? money(ctx.signed.solarVicRebate) : null,
    solarVicLoan: ctx.signed?.solarVicLoan ? money(ctx.signed.solarVicLoan) : null,
  };
  const typedLines = section.fields.map((f): SectionLine => {
    const typed = details[f.key] ? (f.kind === "money" ? money(Number(details[f.key])) : details[f.key]) : null;
    return {
      key: f.key,
      label: f.label,
      value: typed ?? filled[f.key] ?? null,
      filled: filled[f.key] ?? null,
      typed: Boolean(typed),
      field: f,
    };
  });
  const s = ctx.signed;
  const progress = (key: string, label: string) => known(key, label, details[key] ? (PROGRESS_WORDS[details[key]] ?? details[key]) : null);
  if (id === "installation")
    return [known("installDate", "Installation date", ctx.installDate), known("installer", "Installer", ctx.installer), ...typedLines];
  if (id === "network") return [...typedLines, progress("gridConnection", "Grid connection")];
  return [
    known("incGst", "Price, inc. GST", money(s?.incGst ?? null)),
    known("stc", "STC value", money(s?.stc ?? null)),
    known("youPay", "Customer pays", money(s?.youPay ?? null)),
    known("depositAsked", "Deposit", s ? (s.depositAsked ? money(s.depositAsked) : "None asked") : null),
    known("depositReceived", "Deposit received", s ? (s.depositReceived ? money(s.depositReceived) : "Not yet") : null),
    ...typedLines,
    progress("customerInvoice", "Customer invoice"),
    progress("stcClaim", "STCs"),
  ];
}

const PROGRESS_WORDS: Record<string, string> = {
  "not-issued": "Not issued",
  pending: "Pending",
  paid: "Paid",
  "not-claimed": "Not claimed",
  claimed: "Claimed",
  underway: "Underway",
  completed: "Completed",
};
