/** The refundable deposit, paid after the confirmation call via a link from RENUABL. */
import { ASSUMPTIONS } from "./recommendation";

export const DEPOSIT = {
  amount: ASSUMPTIONS.deposit,
  currency: "aud",
  description: "RENUABL refundable reservation deposit",
} as const;

/** Reservation references look like RN-1234. */
export function parseReference(raw: string | null | undefined): string | null {
  const ref = raw?.trim().toUpperCase() ?? "";
  return /^RN-\d{4,8}$/.test(ref) ? ref : null;
}

/** Amount in cents, as Stripe expects. */
export function depositCents(amount: number = DEPOSIT.amount) {
  return Math.round(amount * 100);
}
