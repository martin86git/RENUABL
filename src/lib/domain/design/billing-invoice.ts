/**
 * RENUABL's tax invoices to the solar businesses that use it (Martin, 1 Nov 2026). Pure, tested
 * (`billing-invoice.test.ts`).
 *
 * Stripe keeps the invoices (each subscription period, each pack of design jobs or Sol credits); this turns one into a
 * tax invoice as the ATO asks for one: the words "Tax invoice", RENUABL's legal name and ABN, the date, what was sold,
 * the GST in it and the total, and the buyer's name (and ABN when they gave one, which the ATO asks for from $1,000).
 * Every price includes GST, so the GST is one eleventh of each line. Never a card number: Stripe has the card.
 */
import { RENUABL_BUSINESS } from "../payouts";
import type { Cleaned } from "./crm";
import { isAbn, shownAbn } from "./brand";

/** Who RENUABL bills: kept by the business on its Billing page, shown on every tax invoice and given to Stripe. */
export interface BillingDetails {
  /** The business's legal name (or trading name), as it should appear on the invoice. */
  legalName: string;
  /** 11 digits, checked; empty when they haven't given one. */
  abn: string;
  /** Where Stripe sends invoices and receipts. */
  email: string;
  /** One line: street, suburb, state and postcode. */
  address: string;
}

export const EMPTY_BILLING: BillingDetails = { legalName: "", abn: "", email: "", address: "" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const line = (raw: unknown, most: number) => (typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, most) : "");

export const BILLING_NAME_MISSING = "Add the business's name as it should appear on your invoices.";
export const BILLING_ABN_WRONG = "That ABN doesn't look right. Check the 11 digits.";
export const BILLING_EMAIL_WRONG = "Add an email address for invoices and receipts.";

/** Billing details from the browser: a name and an email are needed; an ABN, when given, must be a real one. */
export function cleanBillingDetails(raw: unknown): Cleaned<BillingDetails> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legalName = line(r.legalName, 120);
  const abn = line(r.abn, 20).replace(/\D/g, "");
  const email = line(r.email, 200).toLowerCase();
  const address = line(r.address, 240);
  if (!legalName) return { ok: false, message: BILLING_NAME_MISSING };
  if (abn && !isAbn(abn)) return { ok: false, message: BILLING_ABN_WRONG };
  if (!EMAIL.test(email)) return { ok: false, message: BILLING_EMAIL_WRONG };
  return { ok: true, value: { legalName, abn, email, address } };
}

/** What Stripe tells us of an invoice, already read into plain figures (cents, GST inclusive). */
export interface InvoiceFacts {
  id: string;
  number: string | null;
  /** Seconds since 1970, as Stripe gives them. */
  created: number;
  paidAt: number | null;
  status: string;
  totalCents: number;
  lines: { description: string; quantity: number; amountCents: number }[];
}

export interface TaxInvoiceView {
  title: "Tax invoice";
  number: string;
  issued: string;
  paid: string | null;
  supplier: { name: string; tradingAs: string; abn: string };
  buyer: { name: string; abn: string | null; email: string; address: string };
  lines: { description: string; quantity: number; gstCents: number; totalCents: number }[];
  exGstCents: number;
  gstCents: number;
  totalCents: number;
  notes: string[];
}

/** One eleventh, to the cent: the GST in a GST-inclusive price. */
export const gstIn = (cents: number) => Math.round(cents / 11);

const dateOf = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" });

/** The ATO asks for the buyer's identity or ABN on a tax invoice of $1,000 or more. */
export const BUYER_DETAILS_FROM_CENTS = 100_000;

export function taxInvoice(facts: InvoiceFacts, buyer: BillingDetails): TaxInvoiceView {
  const lines = facts.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    gstCents: gstIn(l.amountCents),
    totalCents: l.amountCents,
  }));
  const gstCents = lines.reduce((s, l) => s + l.gstCents, 0);
  const notes = ["All prices include GST.", "Paid by card through Stripe. RENUABL never sees or keeps card details."];
  if (facts.totalCents >= BUYER_DETAILS_FROM_CENTS && !buyer.abn)
    notes.push("Add your ABN in Settings → Billing for it to appear on invoices of $1,000 or more.");
  return {
    title: "Tax invoice",
    number: facts.number ?? facts.id,
    issued: dateOf(facts.created),
    paid: facts.paidAt ? dateOf(facts.paidAt) : null,
    supplier: { name: RENUABL_BUSINESS.name, tradingAs: RENUABL_BUSINESS.tradingAs, abn: shownAbn(RENUABL_BUSINESS.abn) },
    buyer: { name: buyer.legalName, abn: buyer.abn ? shownAbn(buyer.abn) : null, email: buyer.email, address: buyer.address },
    lines,
    exGstCents: facts.totalCents - gstCents,
    gstCents,
    totalCents: facts.totalCents,
    notes,
  };
}

/** How an invoice stands, in words for the list. */
export const INVOICE_STATUS: Record<string, string> = {
  paid: "Paid",
  open: "Due",
  draft: "Being prepared",
  void: "Cancelled",
  uncollectible: "Not paid",
};
