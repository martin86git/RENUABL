/**
 * The deposit on a proposal a customer has accepted (the roof designer):
 * what is asked, where it stands, and what each side is told. Pure.
 *
 * What this is and isn't. RENUABL takes no money and holds none: the
 * customer pays the business, by bank transfer into the business's own
 * account or by card on the business's own payment page (a link the business
 * gives us; we only open it). So nothing here ever knows that a payment was
 * made. A customer can say they have paid, which is kept as exactly that,
 * said and not confirmed, and only the business, looking at its own account,
 * marks a deposit received.
 *
 * The amount is the one on the proposal as it was accepted (`terms.deposit`,
 * worked out by `depositOf` from `price.youPay`: the price after the federal
 * rebate and without any Solar Victoria rebate, which is what stands if that
 * isn't approved). It is never worked out again from settings changed since.
 */
import type { Cleaned } from "./crm";
import type { ProposalView } from "./proposal";

/** How a customer says they paid. */
export const PAID_WAYS = ["bank", "card"] as const;
export type PaidWay = (typeof PAID_WAYS)[number];
export const WAY_WORDS: Record<PaidWay, string> = { bank: "bank transfer", card: "card" };

/** Where a deposit stands: asked for, said by the customer to be paid, or marked received by the business. */
export type DepositStanding = "due" | "said" | "received";

/** What is kept beside the accepted copy of a proposal. It never changes the copy itself. */
export interface DepositRecord {
  /** The short reference a customer puts on their payment, made when the proposal was accepted. */
  reference: string | null;
  saidWay: PaidWay | null;
  saidAt: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
}

/** The deposit as the business's own screens show it. Null on a proposal with no deposit, or not accepted. */
export interface DepositStatus {
  /** Dollars, to the cent. */
  amount: number;
  reference: string | null;
  standing: DepositStanding;
  /** How the customer says they paid, and when they said so. Null until they do. */
  way: PaidWay | null;
  saidAt: string | null;
  receivedAt: string | null;
  /** The member who marked it received. Never sent to the customer. */
  receivedBy: string | null;
}

/** The deposit as the customer's own link shows it: never who at the business marked it. */
export interface PublicDeposit {
  amount: number;
  reference: string | null;
  standing: DepositStanding;
  way: PaidWay | null;
  saidAt: string | null;
}

/** Received once the business says so; said once the customer says so; otherwise due. What a customer says never makes it received. */
export function depositStanding(record: Pick<DepositRecord, "saidAt" | "receivedAt">): DepositStanding {
  if (record.receivedAt) return "received";
  return record.saidAt ? "said" : "due";
}

/** The deposit a proposal asks for, in dollars. Null when the business asks for none. */
export function depositAsked(view: Pick<ProposalView, "terms">): number | null {
  const amount = view.terms?.deposit;
  return typeof amount === "number" && amount > 0 ? amount : null;
}

/** The deposit on a proposal for the business's screens. Null with no deposit, or until the proposal is accepted (nothing is due before). */
export function depositStatus(view: Pick<ProposalView, "terms">, accepted: boolean, record: DepositRecord): DepositStatus | null {
  const amount = depositAsked(view);
  if (amount === null || !accepted) return null;
  return {
    amount,
    reference: record.reference,
    standing: depositStanding(record),
    way: record.saidWay,
    saidAt: record.saidAt,
    receivedAt: record.receivedAt,
    receivedBy: record.receivedBy,
  };
}

/** The same for the customer's link, without who at the business marked it. */
export function publicDeposit(status: DepositStatus | null): PublicDeposit | null {
  if (!status) return null;
  const { amount, reference, standing, way, saidAt } = status;
  return { amount, reference, standing, way, saidAt };
}

/** The ways this proposal can be paid: into the account it was sent with, and on the business's payment page when it gave a link. */
export function waysToPay(view: Pick<ProposalView, "terms">): PaidWay[] {
  return [...(view.terms?.bank ? (["bank"] as const) : []), ...(view.terms?.payLink ? (["card"] as const) : [])];
}

export const PAID_WAY_WRONG = "Say whether you paid by bank transfer or by card.";
export const NO_DEPOSIT = "There is no deposit to pay on this proposal.";
export const NOT_ACCEPTED = "The deposit is asked for once the proposal has been accepted.";

/** "I've paid", as sent from the customer's page: only the way, and only one this proposal offers. */
export function cleanPaid(raw: unknown, view: Pick<ProposalView, "terms">): Cleaned<{ way: PaidWay }> {
  const way = raw && typeof raw === "object" ? (raw as { way?: unknown }).way : undefined;
  const offered = waysToPay(view);
  return typeof way === "string" && offered.includes(way as PaidWay)
    ? { ok: true, value: { way: way as PaidWay } }
    : { ok: false, message: PAID_WAY_WRONG };
}

// A reference: short enough for a bank's reference box, with no letters or digits that are mistaken for each other.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERENCE_LENGTH = 8;

/** A payment reference from random bytes (at least `REFERENCE_LENGTH` of them): 8 letters and digits. Says nothing of the link or the job. */
export function newReference(random: Uint8Array): string {
  let out = "";
  for (let i = 0; i < REFERENCE_LENGTH; i++) out += ALPHABET[random[i] % ALPHABET.length];
  return out;
}
export const isReference = (text: unknown): text is string => typeof text === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(text);

/** "$1,145.40", or "$1,145" when there are no cents. */
export function money(amount: number): string {
  const cents = Math.round(amount * 100);
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Which price the deposit was worked out from, said plainly beside it. */
export function depositBasis(view: Pick<ProposalView, "price">): string {
  const base = `Worked out from the price you pay, ${money(view.price.youPay)}`;
  return view.price.solarVic
    ? `${base}: the price without the Solar Victoria rebate, which is what stands if that isn't approved.`
    : `${base}.`;
}

// What goes on the customer's record. "Says" is the word: nothing here is a payment we have seen.
export const saidPaid = (way: PaidWay, amount: number, reference: string | null) =>
  `The customer says they paid the deposit of ${money(amount)} by ${WAY_WORDS[way]}${reference ? ` (reference ${reference})` : ""}. Not confirmed: check your account.`;
export const markedReceived = (amount: number) => `Deposit of ${money(amount)} marked received`;
export const markedNotReceived = (amount: number) => `Deposit of ${money(amount)} marked not received: it is due again`;

/** Where the deposit stands, in a line, for the business's own screens. */
export function standingWords(status: DepositStatus, day: (iso: string) => string): string {
  if (status.standing === "received")
    return `Deposit of ${money(status.amount)} received${status.receivedAt ? ` on ${day(status.receivedAt)}` : ""}`;
  if (status.standing === "said")
    return `The customer says they paid ${money(status.amount)} by ${WAY_WORDS[status.way ?? "bank"]}${status.saidAt ? ` on ${day(status.saidAt)}` : ""}. Not confirmed: check your account.`;
  return `Deposit of ${money(status.amount)} due`;
}

/** The same for the customer, once they have said they paid or the business has it. Null while it is simply due. */
export function customerStandingWords(deposit: PublicDeposit, business: string, day: (iso: string) => string): string | null {
  if (deposit.standing === "received") return `${business} has your deposit of ${money(deposit.amount)}. Thank you.`;
  if (deposit.standing === "said")
    return `You told ${business}${deposit.saidAt ? ` on ${day(deposit.saidAt)}` : ""} that you paid ${money(deposit.amount)} by ${WAY_WORDS[deposit.way ?? "bank"]}. They will confirm once they have it.`;
  return null;
}

/** Beside "Pay by card": whose page it is and who is paid. We never see a card. */
export const cardNote = (business: string) =>
  `This opens ${business}'s own payment page in a new tab. You pay ${business} there: no card details are taken on this page.`;
/** When the business gave no account and no payment page. */
export const noWayToPay = (business: string) => `${business} will be in touch about how to pay the deposit.`;
