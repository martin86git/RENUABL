/**
 * Custom proposals: the proposal builder as a paid add-on for a business (15 Nov 2026, Martin: "per business, build it";
 * the standard design is included, a design of the business's own is charged). Pure, tested.
 *
 * Anyone may open the builder and design: what is gated is publishing a proposal with a custom design. The price isn't
 * set yet (`CUSTOM_PROPOSALS_MONTHLY_CENTS`), and until it is, and while billing isn't enforced, nothing is held back.
 */

import { ADD_ON_MONTHLY_CENTS } from "./add-ons";

/** The add-on's price a month for the whole business, including GST (add-ons.ts). Null until Martin sets it. */
export const CUSTOM_PROPOSALS_MONTHLY_CENTS: number | null = ADD_ON_MONTHLY_CENTS["custom-proposals"];

/** The add-on's key where a business's add-ons are kept. */
export const CUSTOM_PROPOSALS = "custom-proposals" as const;

/** The add-on in words, for the builder. */
export function customPriceWords(cents: number | null = CUSTOM_PROPOSALS_MONTHLY_CENTS): string {
  if (cents === null) return "Custom proposals will be a monthly add-on for your business. Until it is priced, it's included.";
  const dollars = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `Custom proposals are $${dollars} a month for your whole business, including GST.`;
}

/**
 * Whether a business may publish a proposal with its own design: always, until the add-on is priced and billing is
 * enforced; then only with the add-on.
 */
export function mayPublishCustom(given: { enforced: boolean; cents: number | null; hasAddOn: boolean }): boolean {
  return !given.enforced || given.cents === null || given.hasAddOn;
}

/** Said when a custom design can't be published without the add-on. */
export const CUSTOM_NEEDS_ADD_ON =
  "Your proposals use a custom design, which needs the Custom proposals add-on. Add it in Billing, or switch the builder back to the standard design.";
