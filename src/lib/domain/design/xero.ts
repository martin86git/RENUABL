/**
 * Xero for a business's own books (25 Nov 2026, Martin: "yes all 3"): connect the business's Xero organisation, then
 * (1) raise the customer's invoice in Xero when a proposal is signed, (2) mark the deal's customer invoice paid when
 * Xero says it is paid, and (3) send installer invoices to Xero as bills once they match the job's allowance.
 * Pure, tested (`xero.test.ts`). The Xero calls are in server/xero.ts and server/design-xero.ts.
 *
 * Everything sent is built here from what RENUABL already holds: the customer's signed copy (never a cost or margin)
 * and the installer invoice's checked figures. Field names follow Xero's Accounting API as read on 25 Nov 2026
 * (VERIFY on a first real organisation): Invoices with Type ACCREC (a sale) or ACCPAY (a bill), LineAmountTypes,
 * LineItems with AccountCode and TaxType, Australian tax types OUTPUT, INPUT and BASEXCLUDED.
 */
import type { InstallerInvoice } from "./installer-invoices";
import type { ISODate } from "@/lib/domain/types";

/**
 * What Xero is asked for: sign-in, a refresh token, invoices and bills (read and written: the paid status is read off
 * the invoice itself) and the contacts on them. Xero's granular scopes, which every app made since 2 March 2026 must use
 * (25 Nov 2026: 'accounting.transactions' was refused as invalid_scope).
 */
export const XERO_SCOPES = "openid profile email offline_access accounting.invoices accounting.contacts";

export type InvoiceStatus = "DRAFT" | "AUTHORISED";
export type StcTax = "BASEXCLUDED" | "OUTPUT";
export type BillsWhen = "matched" | "any" | "off";

/** How a business's invoices and bills go to Xero. Its own choices, cleaned by `cleanXeroSettings`. */
export interface XeroSettings {
  /** Raise the customer's invoice when a proposal is signed. */
  invoices: boolean;
  /** Draft (someone approves it in Xero) or approved straight away. */
  status: InvoiceStatus;
  /** Days after the invoice's date it falls due (approved invoices need a due date). */
  dueDays: number;
  /** Account code for the system's price. Xero's Australian chart starts Sales at 200. */
  salesAccount: string;
  /** Account code and tax type for the federal rebate (STCs) taken off the price. VERIFY with the accountant. */
  stcAccount: string;
  stcTax: StcTax;
  /** Installer invoices as bills: once they match the allowance, as soon as they're on a job, or not at all. */
  bills: BillsWhen;
  /** Account code for installation bills. Xero's Australian chart has Cost of Goods Sold at 310. */
  billsAccount: string;
}

export const DEFAULT_XERO_SETTINGS: XeroSettings = {
  invoices: true,
  status: "DRAFT",
  dueDays: 7,
  salesAccount: "200",
  stcAccount: "200",
  stcTax: "BASEXCLUDED",
  bills: "matched",
  billsAccount: "310",
};

const bag = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
/** An account code as Xero keeps them: up to 10 letters, digits, dots or dashes. */
const code = (v: unknown, fallback: string) => (typeof v === "string" && /^[A-Za-z0-9.-]{1,10}$/.test(v.trim()) ? v.trim() : fallback);

export function cleanXeroSettings(raw: unknown): XeroSettings {
  const r = bag(raw);
  const d = DEFAULT_XERO_SETTINGS;
  const days = typeof r.dueDays === "number" && Number.isInteger(r.dueDays) ? r.dueDays : d.dueDays;
  return {
    invoices: typeof r.invoices === "boolean" ? r.invoices : d.invoices,
    status: r.status === "AUTHORISED" ? "AUTHORISED" : "DRAFT",
    dueDays: Math.min(90, Math.max(0, days)),
    salesAccount: code(r.salesAccount, d.salesAccount),
    stcAccount: code(r.stcAccount, d.stcAccount),
    stcTax: r.stcTax === "OUTPUT" ? "OUTPUT" : "BASEXCLUDED",
    bills: r.bills === "any" || r.bills === "off" ? r.bills : "matched",
    billsAccount: code(r.billsAccount, d.billsAccount),
  };
}

interface LineItem {
  Description: string;
  Quantity?: number;
  UnitAmount?: number;
  AccountCode?: string;
  TaxType?: string;
}

export interface XeroInvoiceBody {
  Type: "ACCREC" | "ACCPAY";
  Contact: { Name: string; EmailAddress?: string };
  Date: ISODate;
  DueDate?: ISODate;
  LineAmountTypes: "Inclusive" | "Exclusive";
  Status: InvoiceStatus;
  Reference?: string;
  InvoiceNumber?: string;
  LineItems: LineItem[];
}

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cents = (n: number) => Math.round(n * 100) / 100;
const line = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export function addDays(day: ISODate, days: number): ISODate {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) as ISODate;
}

/** What a signed proposal says the customer pays, as the customer's own copy has it (never a cost). */
export interface SignedSale {
  customer: { name: string; email: string | null; address: string };
  /** "Solar and battery". */
  title: string;
  /** "6.60 kW solar with a 13.5 kWh battery". */
  system: string;
  price: { incGst: number; stc: number; youPay: number };
  terms?: { deposit: number | null; milestones: { name: string; amount: number }[] };
  /** The job's reference, as the order and installer invoices carry it. */
  reference: string;
}

/**
 * The customer's invoice for a signed proposal: the system at its price with GST, the federal rebate (STCs) taken
 * off, so it comes to what the customer pays. The deposit and each milestone are written under it as lines without
 * an amount, so the invoice shows the schedule agreed. One invoice for the whole sale.
 */
export function customerInvoice(sale: SignedSale, s: XeroSettings, today: ISODate): XeroInvoiceBody {
  const items: LineItem[] = [
    {
      Description: line(`${sale.title}: ${sale.system}. ${sale.customer.address}`, 400),
      Quantity: 1,
      UnitAmount: cents(sale.price.incGst),
      AccountCode: s.salesAccount,
      TaxType: "OUTPUT",
    },
  ];
  if (sale.price.stc > 0)
    items.push({
      Description: "Federal rebate (small-scale technology certificates) assigned to us",
      Quantity: 1,
      UnitAmount: -cents(sale.price.stc),
      AccountCode: s.stcAccount,
      TaxType: s.stcTax,
    });
  const schedule = scheduleLines(sale.terms);
  if (schedule.length) items.push({ Description: "Payment schedule:" }, ...schedule.map((d) => ({ Description: d })));
  return {
    Type: "ACCREC",
    Contact: { Name: line(sale.customer.name, 255) || "Customer", ...(sale.customer.email ? { EmailAddress: sale.customer.email } : {}) },
    Date: today,
    ...(s.status === "AUTHORISED" ? { DueDate: addDays(today, s.dueDays) } : {}),
    LineAmountTypes: "Inclusive",
    Status: s.status,
    Reference: line(sale.reference, 255),
    LineItems: items,
  };
}

/** "Deposit on signing: $2,000.00", then each milestone, the deposit coming off the first as on the proposal. */
export function scheduleLines(terms: SignedSale["terms"]): string[] {
  if (!terms) return [];
  const out: string[] = [];
  if (typeof terms.deposit === "number" && terms.deposit > 0) out.push(`Deposit on signing: ${money(terms.deposit)}`);
  for (const m of terms.milestones) if (m.amount > 0) out.push(`${line(m.name, 60)}: ${money(m.amount)}`);
  return out;
}

/** An installer's invoice as a bill in Xero: its lines ex GST, GST worked by Xero (none when they charged none). Always a draft. */
export function installerBill(
  inv: Pick<InstallerInvoice, "installer" | "number" | "date" | "subTotal" | "gst" | "lines">,
  s: XeroSettings,
  reference: string,
  today: ISODate,
): XeroInvoiceBody {
  const tax = inv.gst > 0 ? "INPUT" : "BASEXCLUDED";
  const lines = inv.lines.filter((l) => l.amount !== 0);
  const items: LineItem[] = (lines.length ? lines : [{ description: "Installation", amount: inv.subTotal }]).map((l) => ({
    Description: line(l.description || "Installation", 400),
    Quantity: 1,
    UnitAmount: cents(l.amount),
    AccountCode: s.billsAccount,
    TaxType: tax,
  }));
  return {
    Type: "ACCPAY",
    Contact: { Name: line(inv.installer, 255) || "Installer" },
    Date: /^\d{4}-\d{2}-\d{2}$/.test(inv.date) ? (inv.date as ISODate) : today,
    LineAmountTypes: "Exclusive",
    Status: "DRAFT",
    ...(inv.number ? { InvoiceNumber: line(inv.number, 255) } : {}),
    Reference: line(reference, 255),
    LineItems: items,
  };
}

/** Whether a matched or any installer invoice is to go to Xero under the business's choice. */
export const billGoes = (when: BillsWhen, status: "match" | "over" | "under" | "awaiting" | "upcoming") =>
  when === "any" || (when === "matched" && status === "match");

export type CustomerInvoiceProgress = "not-issued" | "pending" | "paid";

/** What Xero's status says for the deal's "Customer invoice": paid once Xero says so; approved and unpaid is sent. */
export function progressFromXero(status: string, amountDue: number): CustomerInvoiceProgress | null {
  if (status === "PAID" || (status === "AUTHORISED" && amountDue <= 0)) return "paid";
  if (status === "AUTHORISED" || status === "SUBMITTED") return "pending";
  if (status === "DRAFT") return "not-issued";
  return null;
}

/** A link from Xero's own invoice page, for the business's screens. */
export const xeroInvoiceUrl = (id: string, kind: "invoice" | "bill") =>
  kind === "invoice"
    ? `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${encodeURIComponent(id)}`
    : `https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=${encodeURIComponent(id)}`;

/** What the deal's record says. */
export const raisedLine = (number: string, status: InvoiceStatus, total: number) =>
  `Invoice ${number} raised in Xero (${status === "DRAFT" ? "draft" : "approved"}) for ${money(total)}`;
export const paidLine = (number: string) => `Invoice ${number} paid in Xero`;
export const billLine = (number: string, installer: string) =>
  `Installer's invoice ${number || ""} from ${installer} sent to Xero as a bill`.replace("  ", " ");

export const XERO_MESSAGE = "renuabl-xero";
export const XERO_RESULTS = ["connected", "failed", "off", "signed-out", "no-organisation"] as const;
export type XeroResult = (typeof XERO_RESULTS)[number];
export const XERO_RESULT_WORDS: Record<XeroResult, string> = {
  connected: "Xero is connected.",
  failed: "Xero didn't connect. Please try again.",
  off: "Xero isn't set up on RENUABL yet.",
  "signed-out": "Sign in to your business to connect Xero.",
  "no-organisation": "Xero didn't give us an organisation to connect. Pick one when Xero asks.",
};
