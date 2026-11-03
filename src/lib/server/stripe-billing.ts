/**
 * Server only. The Stripe side of RENUABL charging solar businesses (tax invoices, Sol credits, users that follow the
 * team) and of the payment gateway those businesses use to be paid by their own customers (Stripe Connect).
 */
import type Stripe from "stripe";
import type { BillingDetails, InvoiceFacts } from "@/lib/domain/design/billing-invoice";
import { shownAbn } from "@/lib/domain/design/brand";
import type { SolPack } from "@/lib/domain/design/sol-credits";
import { RENUABL_BUSINESS } from "@/lib/domain/payouts";
import {
  COMMIT_SAVING_CENTS,
  COMMIT_SEAT_CENTS,
  SEAT_MONTHLY_CENTS,
  commitBillsBy,
  commitRunning,
  commitTerm,
  dollars,
  earlyExitCents,
  type PlanTerm,
} from "@/lib/domain/design/plans";

/*
 * Tax invoices. Every price includes GST, so Stripe is given an inclusive 10% GST rate on each line: its invoices and
 * receipts then show the GST inside the price and charge nothing more. Made once in the Stripe account (found again by
 * its metadata), then kept for the life of the server.
 */
let gstRateId: string | null = null;

export async function gstTaxRate(stripe: Stripe): Promise<string> {
  if (gstRateId) return gstRateId;
  const found = (await stripe.taxRates.list({ active: true, inclusive: true, limit: 100 })).data.find(
    (r) => r.metadata?.kind === "renuabl-gst",
  );
  const rate =
    found ??
    (await stripe.taxRates.create({
      display_name: "GST",
      description: "Australian GST, included in the price",
      percentage: 10,
      inclusive: true,
      country: "AU",
      jurisdiction: "AU",
      metadata: { kind: "renuabl-gst" },
    }));
  gstRateId = rate.id;
  return rate.id;
}

/** At the foot of every invoice RENUABL's Stripe account sends a business. */
export const INVOICE_FOOTER = `Tax invoice. ${RENUABL_BUSINESS.name} trading as ${RENUABL_BUSINESS.tradingAs}, ABN ${shownAbn(RENUABL_BUSINESS.abn)}. All prices include GST.`;

/** Stripe's invoice for a one-off pack, made as it is paid, so it sits among the business's invoices like any other. */
export const packInvoice = (businessId: string): Stripe.Checkout.SessionCreateParams.InvoiceCreation => ({
  enabled: true,
  invoice_data: { footer: INVOICE_FOOTER, metadata: { business: businessId } },
});

/** A pack of Sol credits for a business, paid now. Returns the page's URL. */
export async function createSolCheckout(
  stripe: Stripe,
  opts: { businessId: string; email: string; pack: SolPack; customer: string | null; origin: string },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(opts.customer ? { customer: opts.customer } : { customer_email: opts.email, customer_creation: "always" as const }),
    automatic_tax: { enabled: false },
    locale: "en-GB",
    line_items: [
      {
        quantity: 1,
        tax_rates: [await gstTaxRate(stripe)],
        price_data: {
          currency: "aud",
          unit_amount: opts.pack.cents,
          product_data: {
            name: `${opts.pack.credits.toLocaleString("en-AU")} Sol credits`,
            description: "One credit is one answer from Sol. They never expire. Includes GST.",
          },
        },
      },
    ],
    invoice_creation: packInvoice(opts.businessId),
    metadata: { kind: "sol-credits", business: opts.businessId, credits: String(opts.pack.credits), email: opts.email },
    success_url: `${opts.origin}/design/settings/billing?bought={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/design/settings/billing`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/**
 * The subscription's users brought into line with the people in the business. Stripe works out the difference for the
 * rest of the period and puts it on the next invoice. Nothing changes when it already matches, or once the plan is over.
 */
export async function setSeats(stripe: Stripe, subscriptionId: string, seats: number): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  const want = Math.max(1, seats);
  if (!item || item.quantity === want || ["canceled", "incomplete_expired"].includes(sub.status)) return false;
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, quantity: want }],
    proration_behavior: "create_prorations",
  });
  return true;
}

/** The business's billing details on its Stripe customer, so Stripe's own invoices and receipts carry them too. */
export async function syncBillingCustomer(stripe: Stripe, customer: string, details: BillingDetails): Promise<void> {
  await stripe.customers.update(customer, {
    name: details.legalName,
    email: details.email,
    ...(details.address ? { address: { line1: details.address, country: "AU" } } : {}),
    invoice_settings: {
      footer: INVOICE_FOOTER,
      custom_fields: details.abn ? [{ name: "Customer ABN", value: shownAbn(details.abn) }] : [],
    },
    metadata: { abn: details.abn },
  });
}

export interface StripeInvoiceRow extends InvoiceFacts {
  /** Stripe's own page for the invoice: pay it when due, or see the receipt. */
  hostedUrl: string | null;
}

const invoiceRow = (inv: Stripe.Invoice): StripeInvoiceRow => ({
  id: inv.id ?? "",
  number: inv.number ?? null,
  created: inv.created,
  paidAt: inv.status_transitions?.paid_at ?? null,
  status: inv.status ?? "draft",
  totalCents: inv.total,
  lines: inv.lines.data.map((l) => ({ description: l.description ?? "RENUABL", quantity: l.quantity ?? 1, amountCents: l.amount })),
  hostedUrl: inv.hosted_invoice_url ?? null,
});

/** The business's invoices from RENUABL, newest first, drafts left out. */
export async function invoicesOf(stripe: Stripe, customer: string): Promise<StripeInvoiceRow[]> {
  const list = await stripe.invoices.list({ customer, limit: 36 });
  return list.data.filter((i) => i.status !== "draft").map(invoiceRow);
}

/** One invoice, only when it is that customer's. */
export async function invoiceOf(stripe: Stripe, customer: string, id: string): Promise<StripeInvoiceRow | null> {
  const inv = await stripe.invoices.retrieve(id).catch(() => null);
  const owner = inv && (typeof inv.customer === "string" ? inv.customer : inv.customer?.id);
  return inv && owner === customer && inv.status !== "draft" ? invoiceRow(inv) : null;
}

/*
 * The payment gateway for businesses (`domain/design/proposal-payments.ts`): each business connects a Stripe account of
 * its own (a standard account, which it owns and runs from Stripe's own Dashboard). A customer's payment is a direct
 * charge on that account, so the money goes to the business; RENUABL's 1% comes to RENUABL as an application fee.
 */

/** Opens a Stripe account for a business. Returns its id. */
export async function createConnectAccount(stripe: Stripe, opts: { businessId: string; email: string; name: string }): Promise<string> {
  const account = await stripe.accounts.create({
    type: "standard",
    country: "AU",
    email: opts.email,
    business_profile: { name: opts.name },
    metadata: { business: opts.businessId },
  });
  return account.id;
}

/** Stripe's own pages where the business gives (or finishes giving) its details. Returns the first page's URL. */
export async function connectOnboardingUrl(stripe: Stripe, account: string, origin: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account,
    type: "account_onboarding",
    refresh_url: `${origin}/design/settings/card-payments?connect=again`,
    return_url: `${origin}/design/settings/card-payments?connect=back`,
  });
  return link.url;
}

/** Whether a business's account can take card payments yet. */
export function connectFacts(account: Stripe.Account) {
  return { chargesEnabled: Boolean(account.charges_enabled), detailsSubmitted: Boolean(account.details_submitted) };
}

/** Stripe's Dashboard for the business's own account (payouts, refunds, disputes). */
export const dashboardUrl = "https://dashboard.stripe.com/";

/**
 * A customer paying the next amount due on their proposal, on Stripe's page, straight to the business's own account.
 * Everything in it is worked out on the server from the accepted proposal. Returns the page's URL.
 */
export async function createProposalPaymentCheckout(
  stripe: Stripe,
  opts: {
    account: string;
    business: string;
    businessId: string;
    versionId: string;
    due: { key: string; name: string };
    amountCents: number;
    feeCents: number;
    reference: string | null;
    token: string;
    origin: string;
  },
): Promise<string> {
  const back = `${opts.origin}/p/${opts.token}`;
  const tag = { kind: "proposal-payment", business: opts.businessId, version: opts.versionId, due: opts.due.key };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      locale: "en-GB",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: opts.amountCents,
            product_data: {
              name: `${opts.due.name}: ${opts.business}`,
              ...(opts.reference ? { description: `Reference ${opts.reference}` } : {}),
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: opts.feeCents,
        description: `${opts.due.name}${opts.reference ? ` ${opts.reference}` : ""}`,
        metadata: tag,
      },
      metadata: tag,
      success_url: `${back}?paid=1#pay`,
      cancel_url: `${back}#pay`,
    },
    { stripeAccount: opts.account },
  );
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/*
 * The 12-month plan (plans.ts): $29 a user a month for 12 months, chosen in Billing. The subscription's price is
 * changed with no proration (this month stays as billed), and the term is kept on the subscription's own metadata, so
 * whatever Stripe sends back about it carries the term too (`subscriptionFacts`). When the 12 months are up the daily
 * cron puts it back to $59 (`endTwelveMonths`).
 */

/** The month-to-month or 12-month price on the plan's own product, for a subscription item. */
const seatPrice = (product: string, cents: number): Stripe.SubscriptionUpdateParams.Item.PriceData => ({
  currency: "aud",
  product,
  unit_amount: cents,
  recurring: { interval: "month" },
});

export interface TermChange {
  term: PlanTerm;
  /** The 12-month plan's first own bill, and the day it ends. */
  from: string | null;
  until: string | null;
}

/** The subscription's term as kept on it. */
export function termOf(sub: Pick<Stripe.Subscription, "metadata">): TermChange {
  const m = sub.metadata ?? {};
  return m.term === "commit"
    ? { term: "commit", from: m.commit_from || null, until: m.commit_until || null }
    : { term: "flex", from: null, until: null };
}

/** Puts a monthly subscription on the 12-month plan from the start of its current month. Refuses a yearly or ended one. */
export async function commitToTwelveMonths(stripe: Stripe, subscriptionId: string): Promise<TermChange | "not-monthly" | "ended"> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item || ["canceled", "incomplete_expired"].includes(sub.status)) return "ended";
  if (item.price.recurring?.interval !== "month") return "not-monthly";
  const iso = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
  const { from, until } = commitTerm(iso(item.current_period_start), iso(item.current_period_end));
  const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price_data: seatPrice(product, COMMIT_SEAT_CENTS), tax_rates: [await gstTaxRate(stripe)] }],
    proration_behavior: "none",
    cancel_at_period_end: false,
    metadata: { ...sub.metadata, term: "commit", commit_from: from, commit_until: until },
  });
  return { term: "commit", from, until };
}

/** The 12-month plan over: back to $59 a user a month, month to month. Nothing happens to one already month to month. */
export async function endTwelveMonths(stripe: Stripe, subscriptionId: string): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item || termOf(sub).term !== "commit" || ["canceled", "incomplete_expired"].includes(sub.status)) return false;
  const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price_data: seatPrice(product, SEAT_MONTHLY_CENTS), tax_rates: [await gstTaxRate(stripe)] }],
    proration_behavior: "none",
    metadata: { ...sub.metadata, term: "flex", commit_from: "", commit_until: "" },
  });
  return true;
}

/**
 * Cancelling from Billing: the plan runs to the end of the month paid for. On the 12-month plan before it ends, what it
 * saved is charged first (`earlyExitCents`), on an invoice of its own, and only then is it cancelled. Answers what was
 * charged, in cents (0 month to month).
 */
export async function cancelPlan(stripe: Stripe, subscriptionId: string, today: string): Promise<{ chargedCents: number }> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  const term = termOf(sub);
  let chargedCents = 0;
  if (term.term === "commit" && term.from && commitRunning(term.until, today)) {
    chargedCents = earlyExitCents(item?.quantity ?? 1, commitBillsBy(term.from, today));
    if (chargedCents > 0) {
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const invoice = await stripe.invoices.create({
        customer,
        collection_method: "charge_automatically",
        pending_invoice_items_behavior: "exclude",
        footer: INVOICE_FOOTER,
        metadata: { kind: "design-early-exit", subscription: subscriptionId },
      });
      await stripe.invoiceItems.create({
        customer,
        invoice: invoice.id,
        amount: chargedCents,
        currency: "aud",
        description: `Leaving the 12-month plan early: ${dollars(COMMIT_SAVING_CENTS)} a user for each month billed at ${dollars(COMMIT_SEAT_CENTS)}`,
        tax_rates: [await gstTaxRate(stripe)],
      });
      if (invoice.id) {
        await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices
          .pay(invoice.id)
          .catch((e) => console.error("early exit not paid at once", e instanceof Error ? e.message : e));
      }
    }
  }
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  return { chargedCents };
}

/**
 * Stripe's own page for the card, details and invoices, with cancelling and plan changes taken off: those go through
 * Billing (`cancelPlan`), which charges what leaving the 12-month plan early costs. Made once, found again by metadata.
 */
let portalConfigId: string | null = null;
export async function portalWithoutCancel(stripe: Stripe): Promise<string> {
  if (portalConfigId) return portalConfigId;
  const found = (await stripe.billingPortal.configurations.list({ active: true, limit: 100 })).data.find(
    (c) => c.metadata?.kind === "renuabl-no-cancel",
  );
  const config =
    found ??
    (await stripe.billingPortal.configurations.create({
      business_profile: { headline: "RENUABL: your card, details and invoices" },
      features: {
        customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
      },
      metadata: { kind: "renuabl-no-cancel" },
    }));
  portalConfigId = config.id;
  return config.id;
}
