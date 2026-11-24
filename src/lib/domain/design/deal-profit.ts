/**
 * What a signed deal makes, from the business's side of the signed proposal (24 Nov 2026, Martin: "every deal card
 * to show its gross margin profitability and commission value… derived from the associated proposal that's signed").
 *
 * The quote counts sales commission as a cost before margin (quote.ts), so the proposal's own `margin` is what is left
 * after commission. Gross margin here is before commission: the price ex GST less the hardware and installation.
 * Never shown to anyone who can't see costs.
 */

import type { ProposalInternal } from "./proposal";

export interface DealProfit {
  /** The price ex GST less the hardware and installation, dollars. */
  grossMargin: number;
  /** Gross margin as a share of the price ex GST, 0 to 1; null with no price. */
  grossShare: number | null;
  /** The sales commission on the signed system, dollars. */
  commission: number;
  /** What is left after commission (the quote's own margin), dollars. */
  afterCommission: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function dealProfit(internal: Pick<ProposalInternal, "cost" | "margin" | "priceExGst" | "lines">): DealProfit {
  const commission = cents(internal.lines.filter((l) => l.group === "Commission").reduce((s, l) => s + (l.amount || 0), 0));
  const price = internal.priceExGst || 0;
  const grossMargin = cents(price - (internal.cost - commission));
  return {
    grossMargin,
    grossShare: price > 0 ? grossMargin / price : null,
    commission,
    afterCommission: cents(price - internal.cost),
  };
}

/** "$4,200 · 28%", for a card. */
export function marginWords(p: Pick<DealProfit, "grossMargin" | "grossShare">): string {
  const dollars = `$${Math.round(p.grossMargin).toLocaleString("en-AU")}`;
  return p.grossShare === null ? dollars : `${dollars} · ${Math.round(p.grossShare * 100)}%`;
}
