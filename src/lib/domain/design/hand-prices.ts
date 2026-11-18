/**
 * Prices set by hand (18 Nov 2026, Martin: "a shopping cart icon in the quote builder that allows us to upload our price
 * lists, or a price when we don't have them"). A price typed in the quote builder's cart is kept for every quote, not
 * just this one: it goes on a list of the business's own, "Prices set by hand", read like any supplier's list and put
 * first, so it wins over an uploaded one. Typing over a line in the quote changes that quote only. Pure, tested.
 */
import { MAX_SUPPLIER_LISTS, type ListItem, type SupplierList } from "./pricing";
import type { CostLine } from "./quote";

export const HAND_LIST = "Prices set by hand";
/** The most prices the hand-kept list holds. */
export const MAX_HAND_PRICES = 300;

/** A part or product on the quote with no cost on file, to be priced in the cart: one a product code. */
export interface PriceWanted {
  sku: string;
  name: string;
}

/** The lines with no cost on file that carry a product code, once each, named as the quote names them. */
export function pricesWanted(lines: readonly Pick<CostLine, "label" | "sku" | "missing">[]): PriceWanted[] {
  const out: PriceWanted[] = [];
  for (const l of lines) {
    if (!l.missing || !l.sku || out.some((p) => p.sku === l.sku)) continue;
    out.push({
      sku: l.sku,
      name:
        l.label
          .replace(/^\d+ × /, "")
          .replace(/\s*\([^)]*\)\s*$/, "")
          .trim() || l.sku,
    });
  }
  return out;
}

/** A price as typed: dollars ex GST, more than nothing and under a million. Null otherwise. */
export function cleanHandPrice(typed: string): number | null {
  const n = Number(typed.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
}

/**
 * The lists with these prices set by hand: the hand-kept list (made when there is none) gets them, replacing a price
 * of the same code, and goes first, so it wins. The oldest list is dropped past the limit, as an upload does.
 */
export function withHandPrices(lists: readonly SupplierList[], prices: readonly ListItem[], today: string): SupplierList[] {
  const had = lists.find((l) => l.name === HAND_LIST);
  const items = [...prices, ...(had?.items ?? []).filter((i) => !prices.some((p) => p.sku === i.sku))].slice(0, MAX_HAND_PRICES);
  const hand: SupplierList = { name: HAND_LIST, uploadedAt: today, items, panels: [], inverters: [], batteries: [], chargers: [] };
  return [hand, ...lists.filter((l) => l.name !== HAND_LIST)].slice(0, MAX_SUPPLIER_LISTS);
}

/** The lists with the hand-kept one first, wherever an upload put it, so a price set by hand still wins. */
export function handFirst(lists: readonly SupplierList[]): SupplierList[] {
  return [...lists.filter((l) => l.name === HAND_LIST), ...lists.filter((l) => l.name !== HAND_LIST)];
}
