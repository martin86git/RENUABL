/**
 * What a partner is paid, when, and the paperwork for it. An installer
 * (installation only) is paid its installation rates for the job plus any
 * approved variations, released once the job is commissioned and its
 * documents are in. RENUABL issues a recipient-created tax invoice (RCTI) for
 * each payout, so partners don't have to invoice. Pure and tested.
 */
import { billOfMaterials, COSTING, type PartnerPricing } from "./costing";
import { isValidAbn } from "./partner";
import { roofFromNotes } from "./materials";
import type { Variation } from "./variations";
import type { ISODate, Job } from "./types";

export type PayoutStatus = "upcoming" | "processing" | "paid";

export interface PayoutLine {
  description: string;
  amount: number; // ex GST
}

export interface Payout {
  id: string;
  jobId: string;
  reference: string;
  customer: string;
  installDate: ISODate;
  status: PayoutStatus;
  /** When it was paid, or when it's expected. */
  date: ISODate;
  lines: PayoutLine[];
  subtotal: number;
}

/** Days after the install a payout is paid, once commissioning and documents are in. PLACEHOLDER: confirm terms. */
export const PAYOUT_DAYS_AFTER_INSTALL = 7;

const round2 = (n: number) => Math.round(n * 100) / 100;

function addDays(iso: ISODate, days: number): ISODate {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The installation lines for a job, at the partner's rates (RENUABL's when they have none). */
export function installationLines(job: Job, pricing?: PartnerPricing): PayoutLine[] {
  return billOfMaterials({
    ...job.system,
    roof: roofFromNotes(job.site.roof),
    tilt: job.site.tilt,
    storeys: job.site.storeys,
    phase: job.site.phase ?? "single",
    addOns: [],
    partner: pricing,
  })
    .filter((l) => l.sku === null && l.total > 0)
    .map((l) => ({ description: l.description, amount: l.total }));
}

/** The payout for a job: installation plus approved variations. */
export function jobPayout(job: Job, opts: { pricing?: PartnerPricing; variations?: Variation[]; today: ISODate }): Payout {
  const lines = installationLines(job, opts.pricing);
  for (const v of (opts.variations ?? []).filter((x) => x.status === "approved")) {
    for (const item of v.items) lines.push({ description: `Variation: ${item.label}`, amount: item.amount });
  }
  const due = addDays(job.preferredDate, PAYOUT_DAYS_AFTER_INSTALL);
  const status: PayoutStatus = job.stage !== "completed" ? "upcoming" : due <= opts.today ? "paid" : "processing";
  return {
    id: job.id,
    jobId: job.id,
    reference: job.reference,
    customer: job.customer.name,
    installDate: job.preferredDate,
    status,
    date: due,
    lines,
    subtotal: round2(lines.reduce((s, l) => s + l.amount, 0)),
  };
}

export function payoutTotals(payouts: Payout[]) {
  const sum = (s: PayoutStatus) => round2(payouts.filter((p) => p.status === s).reduce((t, p) => t + p.subtotal, 0));
  return { paid: sum("paid"), processing: sum("processing"), upcoming: sum("upcoming") };
}

// ---------------------------------------------------------------------------
// Bank details
// ---------------------------------------------------------------------------

export interface BankDetails {
  accountName: string;
  /** 6 digits. */
  bsb: string;
  /** 5 to 9 digits. */
  accountNumber: string;
  gstRegistered: boolean;
}

export type BankErrors = Partial<Record<keyof BankDetails, string>>;

export function validateBankDetails(raw: Partial<Record<keyof BankDetails, unknown>>): { bank: BankDetails } | { errors: BankErrors } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const accountName = text(raw.accountName).replace(/\s+/g, " ").slice(0, 64);
  const bsb = text(raw.bsb).replace(/[\s-]/g, "");
  const accountNumber = text(raw.accountNumber).replace(/[\s-]/g, "");
  const errors: BankErrors = {};
  if (accountName.length < 2) errors.accountName = "Enter the name on the account.";
  if (!/^\d{6}$/.test(bsb)) errors.bsb = "A BSB is 6 digits, e.g. 063-000.";
  if (!/^\d{5,9}$/.test(accountNumber)) errors.accountNumber = "Account numbers are 5 to 9 digits.";
  if (Object.keys(errors).length) return { errors };
  return { bank: { accountName, bsb, accountNumber, gstRegistered: raw.gstRegistered === true } };
}

export const formatBsb = (bsb: string) => `${bsb.slice(0, 3)}-${bsb.slice(3)}`;
export const maskAccount = (n: string) => `•••• ${n.slice(-3)}`;

// ---------------------------------------------------------------------------
// Recipient-created tax invoices
// ---------------------------------------------------------------------------

/** RENUABL's legal entity, for its invoices. */
export const RENUABL_BUSINESS = { name: "Reburthed Pty Ltd", tradingAs: "RENUABL", abn: "96662374905" };

export interface TaxInvoice {
  title: string;
  number: string;
  issued: ISODate;
  supplier: { name: string; abn: string };
  recipient: { name: string; tradingAs?: string; abn: string };
  lines: PayoutLine[];
  subtotal: number;
  gst: number;
  total: number;
  notes: string[];
}

/**
 * The invoice for a payout. A GST-registered partner gets a recipient-created
 * tax invoice with GST on top; one who isn't gets an invoice without GST
 * (an RCTI needs both sides registered). Needs the partner's ABN.
 */
export function payoutInvoice(payout: Payout, partner: { name: string; abn: string; gstRegistered: boolean }): TaxInvoice {
  const gst = partner.gstRegistered ? round2(payout.subtotal * COSTING.gst) : 0;
  const notes = partner.gstRegistered
    ? [
        "Recipient-created tax invoice. The recipient issues it under an RCTI agreement with the supplier.",
        "The supplier must not issue a tax invoice for this supply.",
      ]
    : ["The supplier isn't registered for GST, so no GST is charged."];
  if (!isValidAbn(partner.abn)) notes.push("Supplier ABN still to be confirmed.");
  return {
    title: partner.gstRegistered ? "Recipient-created tax invoice" : "Recipient-created invoice",
    number: `RCTI-${payout.reference}`,
    issued: payout.date,
    supplier: { name: partner.name, abn: partner.abn },
    recipient: { name: RENUABL_BUSINESS.name, tradingAs: RENUABL_BUSINESS.tradingAs, abn: RENUABL_BUSINESS.abn },
    lines: payout.lines,
    subtotal: payout.subtotal,
    gst,
    total: round2(payout.subtotal + gst),
    notes,
  };
}
