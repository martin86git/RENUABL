/**
 * Server only. A receipt emailed from RENUABL when a business pays one of its invoices (26 Nov 2026, Martin): the
 * plan, a pack of Sol credits or design jobs, an add-on, usage beyond the allowances, all as Stripe invoices on the
 * business's own Stripe customer. Sent from the webhook's `invoice.paid`, once an invoice (claimed in
 * `design_receipts_sent` before sending), to the billing email on the invoices else the owner, with the owner copied
 * in when they differ, and our tax invoice attached (`taxInvoicePdf`, the same as Settings → Billing's download).
 * Never for a made-up business (an owner on a .example address). Never blocks the webhook.
 */
import type Stripe from "stripe";
import { EMPTY_BILLING, taxInvoice } from "@/lib/domain/design/billing-invoice";
import { receiptEmail, receiptFileName } from "@/lib/domain/design/receipt-email";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";
import { billingDetailsOf } from "./design-billing-repo";
import { sendEmail } from "./email";
import { invoiceRow } from "./stripe-billing";
import { taxInvoicePdf } from "./tax-invoice-pdf";

let ready: Promise<unknown> | null = null;
const ensure = () =>
  (ready ??= query(`create table if not exists design_receipts_sent (
    invoice_id text primary key,
    business_id text not null,
    sent_to text not null,
    sent_at timestamptz not null default now()
  )`).catch((e) => {
    ready = null;
    throw e;
  }));

/** The business a Stripe customer bills: its plan's, else one made for it to buy packs. */
async function businessOfCustomer(customer: string): Promise<string | null> {
  const rows = await query<{ business_id: string }>(
    `select business_id from design_subscriptions where stripe_customer = $1 and business_id is not null
     union all
     select business_id from design_stripe_customers where stripe_customer = $1
     limit 1`,
    [customer],
  );
  return rows[0]?.business_id ?? null;
}

async function cardOf(stripe: Stripe, invoiceId: string): Promise<{ brand: string; last4: string } | null> {
  try {
    const paid = await stripe.invoicePayments.list({ invoice: invoiceId, expand: ["data.payment.payment_intent.latest_charge"] });
    for (const p of paid.data) {
      const intent = p.payment?.payment_intent;
      const charge = intent && typeof intent !== "string" ? intent.latest_charge : null;
      const c = charge && typeof charge !== "string" ? charge.payment_method_details?.card : null;
      if (c?.last4) return { brand: c.brand ?? "", last4: c.last4 };
    }
  } catch {
    // The card is a nicety: the receipt goes without it.
  }
  return null;
}

export async function sendReceipt(stripe: Stripe, invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id || invoice.status !== "paid" || invoice.total <= 0) return;
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customer) return;
  const businessId = await businessOfCustomer(customer);
  if (!businessId) return;
  const [owner, details] = await Promise.all([
    query<{ email: string; name: string }>(
      `select m.email, b.name from business_members m join businesses b on b.id = m.business_id
        where m.business_id = $1 and m.role = 'owner' limit 1`,
      [businessId],
    ),
    billingDetailsOf(businessId).catch(() => null),
  ]);
  const ownerEmail = owner[0]?.email?.trim().toLowerCase();
  if (!ownerEmail || /\.example$/i.test(ownerEmail)) return;
  const billing = details?.email?.trim().toLowerCase();
  const to = billing && !/\.example$/i.test(billing) ? billing : ownerEmail;
  const cc = to !== ownerEmail ? [ownerEmail] : [];

  await ensure();
  // Claimed before sending, so a webhook delivered twice sends one receipt.
  const claimed = await query<{ invoice_id: string }>(
    `insert into design_receipts_sent (invoice_id, business_id, sent_to) values ($1, $2, $3)
     on conflict (invoice_id) do nothing returning invoice_id`,
    [invoice.id, businessId, to],
  );
  if (!claimed.length) return;

  const view = taxInvoice(invoiceRow(invoice), details ?? { ...EMPTY_BILLING, legalName: owner[0]?.name ?? "", email: to });
  const site = siteUrl();
  const mail = receiptEmail({
    invoice: view,
    card: await cardOf(stripe, invoice.id),
    link: site ? `${site}/design/settings/billing` : null,
    renews: null,
  });
  const pdf = await taxInvoicePdf(view);
  await sendEmail({
    to,
    cc,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: [{ filename: receiptFileName(view), content: pdf, contentType: "application/pdf" }],
  });
}
