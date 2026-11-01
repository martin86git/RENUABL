/**
 * Paying a business by card from its proposal (Martin, 1 Nov 2026: the payment gateway for RENUABL's businesses).
 * Pure, tested (`proposal-payments.test.ts`).
 *
 * A business connects its own Stripe account (Stripe Connect, a standard account it owns). The customer pays on
 * Stripe's page, and the money goes straight into the business's Stripe account as a direct charge: RENUABL never
 * holds it. RENUABL's fee, `PLATFORM_FEE` of each payment (GST inclusive), is taken by Stripe as an application fee;
 * Stripe's own processing fees are the business's, as with any Stripe account of its own.
 *
 * What can be paid is what the accepted proposal asked for, to the cent, and nothing else: the deposit first, then each
 * payment milestone in turn. The deposit counts towards the milestones: it comes off the first of them (and the next,
 * should it be larger than the first). Only the next amount due can be paid, so nothing is paid twice or out of order.
 */
import { money } from "./deposit";

/** RENUABL's share of each card payment taken through a proposal, GST inclusive. */
export const PLATFORM_FEE = 0.01;

export type DueKey = "deposit" | `m${number}`;

export interface Due {
  key: DueKey;
  name: string;
  /** Dollars, to the cent. */
  amount: number;
}

/** What the accepted proposal asks to be paid, in order. Nothing for an amount of $0. */
export function paymentsDue(terms: { deposit: number | null; milestones: { name: string; amount: number }[] } | undefined): Due[] {
  if (!terms) return [];
  const out: Due[] = [];
  let credit = 0;
  if (typeof terms.deposit === "number" && terms.deposit > 0) {
    out.push({ key: "deposit", name: "Deposit", amount: terms.deposit });
    credit = Math.round(terms.deposit * 100);
  }
  terms.milestones.forEach((m, i) => {
    const cents = Math.round(m.amount * 100);
    const off = Math.min(cents, credit);
    credit -= off;
    if (cents - off > 0) out.push({ key: `m${i}`, name: m.name, amount: (cents - off) / 100 });
  });
  return out;
}

/** What the customer's link shows: each amount asked for and when it was paid, the next due, and whether cards are taken here. */
export interface PublicPayments {
  dues: (Due & { paidAt: string | null })[];
  next: DueKey | null;
  /** The business takes card payments through its own Stripe account. */
  cards: boolean;
}

/** The next amount due: the first not yet paid. Null once everything asked for is paid. */
export function nextDue(dues: Due[], paid: ReadonlySet<string>): Due | null {
  return dues.find((d) => !paid.has(d.key)) ?? null;
}

export const isDueKey = (raw: unknown): raw is DueKey => raw === "deposit" || (typeof raw === "string" && /^m[0-7]$/.test(raw));

/** RENUABL's fee on a payment, cents. */
export const platformFeeCents = (amountCents: number) => Math.round(amountCents * PLATFORM_FEE);

/** A business's Stripe account as we know it: whether it can take card payments yet. */
export interface ConnectState {
  connected: boolean;
  /** Stripe has checked the business and card payments can be taken. */
  chargesEnabled: boolean;
  /** Stripe still wants something from the business before it can. */
  detailsSubmitted: boolean;
}

export const NOT_CONNECTED: ConnectState = { connected: false, chargesEnabled: false, detailsSubmitted: false };

/** Card payments are offered on a proposal only once the business's account can take them and it has them switched on. */
export const takesCards = (state: ConnectState, switchedOn: boolean) => switchedOn && state.connected && state.chargesEnabled;

/** For a business's screens. */
export function connectWords(state: ConnectState): string {
  if (!state.connected) return "Not connected";
  if (state.chargesEnabled) return "Connected: card payments are on";
  return state.detailsSubmitted ? "Stripe is checking your details" : "Stripe needs a few more details";
}

/** Beside "Pay by card" on the customer's page. */
export const payCardNote = (business: string) =>
  `You pay ${business} on Stripe's secure page. No card details are taken or kept on this page.`;

/** What the customer's record says when a payment comes through. */
export const paidByCard = (due: Pick<Due, "name">, amountCents: number) =>
  `${due.name} of ${money(amountCents / 100)} paid by card through Stripe.`;

export const NOTHING_DUE = "There's nothing to pay on this proposal right now.";
export const CARDS_OFF = "Card payments aren't available for this proposal.";
export const NOT_NEXT = "That payment isn't the next one due.";
