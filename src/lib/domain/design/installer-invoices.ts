/**
 * Installer Invoices: what each signed job's installation was allowed for in
 * its quote, against what the installer billed. The allowance is fixed when
 * the customer signs (the Installation lines of the version they accepted,
 * after any changes by hand), so a later change to the rates doesn't move
 * it. The installer's invoice is uploaded (read for its figures, which the
 * business checks) or typed in, and the difference shown: within the
 * business's tolerance it matches. All figures ex GST. Pure, tested.
 */
import type { CostGroup } from "./quote";

export interface InstallLine {
  label: string;
  amount: number;
}

/** What a job's installation was allowed for, as signed. */
export interface InstallCost {
  lines: InstallLine[];
  total: number;
  /** When it was fixed. */
  at: string;
  /** Fixed at signing, or worked out later (a job signed before this was kept, or worked out again by hand). */
  from: "signing" | "later";
}

/** The installation lines of a quote, as the installer is paid them. */
export function installCostOf(
  lines: readonly { group: CostGroup; label: string; amount: number }[],
  at: string,
  from: InstallCost["from"],
): InstallCost {
  const kept = lines.filter((l) => l.group === "Installation" && l.amount !== 0).map((l) => ({ label: l.label, amount: round2(l.amount) }));
  return { lines: kept, total: round2(kept.reduce((s, l) => s + l.amount, 0)), at, from };
}

export interface InvoiceLine {
  description: string;
  /** Ex GST. */
  amount: number;
}

/** An installer's invoice, as read from their file or typed in. */
export interface InstallerInvoice {
  id: string;
  /** The job it is against, or null while it is waiting to be put against one. */
  jobId: string | null;
  installer: string;
  number: string;
  /** YYYY-MM-DD, or "". */
  date: string;
  /** Ex GST. */
  subTotal: number;
  gst: number;
  lines: InvoiceLine[];
  fileName: string;
  uploadedBy: string;
  at: string;
}

/** "upcoming": signed but not installed yet, so no installer's invoice is expected. */
export type Variance = "match" | "over" | "under" | "awaiting" | "upcoming";
export const VARIANCE_LABELS: Record<Variance, string> = {
  match: "Matches",
  over: "Over",
  under: "Under",
  awaiting: "Awaiting invoice",
  upcoming: "Not installed yet",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Billed less allowed, and what that means against the tolerance. */
export function varianceOf(cost: InstallCost | null, invoices: readonly Pick<InstallerInvoice, "subTotal">[], tolerance: number) {
  if (!invoices.length || !cost)
    return {
      billed: invoices.length ? round2(invoices.reduce((s, i) => s + i.subTotal, 0)) : null,
      difference: null,
      status: "awaiting" as Variance,
    };
  const billed = round2(invoices.reduce((s, i) => s + i.subTotal, 0));
  const difference = round2(billed - cost.total);
  const status: Variance = Math.abs(difference) <= tolerance ? "match" : difference > 0 ? "over" : "under";
  return { billed, difference, status };
}

/** "Over by $200", "Under by $40", "Matches (+$10)", "Awaiting invoice". */
export function varianceText(v: { difference: number | null; status: Variance }): string {
  const money = (n: number) => `$${Math.abs(n).toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
  if (v.status === "upcoming") return VARIANCE_LABELS.upcoming;
  if (v.difference === null) return VARIANCE_LABELS.awaiting;
  if (v.status === "over") return `Over by ${money(v.difference)}`;
  if (v.status === "under") return `Under by ${money(v.difference)}`;
  return v.difference === 0 ? "Matches" : `Matches (${v.difference > 0 ? "+" : "-"}${money(v.difference)})`;
}

export const MAX_INVOICE_LINES = 40;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const words = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
const dollars = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : Number(v);
  return Number.isFinite(n) && Math.abs(n) < 1_000_000 ? round2(n) : null;
};

/**
 * An invoice's figures, from the reader or the business's own typing, as
 * something to keep: the installer's name, its number and date, the lines
 * and the total ex GST (worked out from the lines when only they are given,
 * or from the total and GST). Null when there is no total to compare.
 */
export function cleanInvoiceFigures(
  raw: unknown,
): Pick<InstallerInvoice, "installer" | "number" | "date" | "subTotal" | "gst" | "lines"> | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const lines: InvoiceLine[] = [];
  if (Array.isArray(r.lines))
    for (const l of r.lines.slice(0, MAX_INVOICE_LINES)) {
      const v = (l ?? {}) as Record<string, unknown>;
      const amount = dollars(v.amount);
      const description = words(v.description, 160);
      if (amount !== null && description) lines.push({ description, amount });
    }
  const gst = dollars(r.gst) ?? 0;
  const total = dollars(r.total);
  const sub =
    dollars(r.subTotal) ?? (lines.length ? round2(lines.reduce((s, l) => s + l.amount, 0)) : total !== null ? round2(total - gst) : null);
  if (sub === null || sub <= 0) return null;
  const date = words(r.date, 10);
  return {
    installer: words(r.installer, 120),
    number: words(r.number, 40),
    date: DATE.test(date) ? date : "",
    subTotal: sub,
    gst: gst >= 0 ? gst : 0,
    lines,
  };
}

/**
 * How likely an invoice is to be a job's, for putting a waiting invoice
 * against a job: the job's reference on it beats its street number and
 * street, which beat the customer's surname. 0 when nothing ties them.
 */
export function matchScore(
  job: { reference: string; address: string; surname: string },
  invoice: Pick<InstallerInvoice, "number" | "lines" | "installer"> & { text?: string },
): number {
  const hay = [invoice.number, invoice.text ?? "", ...invoice.lines.map((l) => l.description)].join(" ").toLowerCase();
  if (job.reference && hay.includes(job.reference.toLowerCase())) return 100;
  const m = job.address
    .toLowerCase()
    .match(
      /^\s*(?:unit\s+\d+\s*,?\s*|\d+\/)?(\d+[a-z]?)\s+([a-z' -]+?)\s+(street|st|road|rd|avenue|ave|court|ct|drive|dr|place|pl|crescent|cres|parade|pde|way|lane|ln|close|cl|boulevard|blvd|grove|gr|terrace|tce)\b/,
    );
  const surname = job.surname.toLowerCase().trim();
  const hasSurname = surname.length > 1 && new RegExp(`\\b${surname.replace(/[^a-z' -]/g, "")}\\b`).test(hay);
  if (m) {
    const [, num, street] = m;
    const hasStreet = hay.includes(street.trim());
    const hasNumber = new RegExp(`\\b${num}\\b`).test(hay);
    if (hasStreet && hasNumber) return hasSurname ? 90 : 75;
    if (hasStreet) return hasSurname ? 55 : 20;
  }
  return hasSurname ? 30 : 0;
}

/** Above this, a waiting invoice is offered as the job's first. */
export const LIKELY_MATCH = 70;
