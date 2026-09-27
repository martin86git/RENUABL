/**
 * Variations: extra work a partner finds on site (a switchboard upgrade, a
 * third array), priced and sent to the customer to approve in the app before
 * it's done. The partner prices it ex GST; the customer sees the price they'd
 * pay, with margin and GST, like the rest of their system. Pure and tested.
 */
import { COSTING, sellPrice } from "./costing";
import { plainText } from "./emails";
import type { InstallRates, PartnerType } from "./partner";

export type VariationStatus = "sent" | "approved" | "declined" | "withdrawn";

export interface VariationItem {
  label: string;
  /** The partner's price, ex GST. */
  amount: number;
}

export interface Variation {
  id: string;
  reason: string;
  items: VariationItem[];
  /** What the partner is paid for it, ex GST. */
  partnerAmount: number;
  /** What the customer pays, incl. GST. */
  customerPrice: number;
  status: VariationStatus;
  sentAt: string;
  decidedAt?: string;
}

export const VARIATION_PRESETS: { id: string; label: string; rate?: keyof InstallRates }[] = [
  { id: "switchboard", label: "Switchboard upgrade", rate: "switchboardUpgrade" },
  { id: "array", label: "Extra array", rate: "extraArray" },
  { id: "storey", label: "Double-storey access", rate: "doubleStorey" },
  { id: "cable", label: "Longer cable run" },
  { id: "other", label: "Other work" },
];

export const VARIATION_LIMITS = { items: 5, maxItemAmount: 20_000, reason: 500, label: 80 } as const;

/** The customer's price: margin (RENUABL's, or a retailer's own) and GST on the partner's price. */
export function priceVariation(items: VariationItem[], opts: { type: PartnerType; margin?: number }) {
  const partnerAmount = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const margin = opts.type === "retailer" ? (opts.margin ?? COSTING.margin) : COSTING.margin;
  return { partnerAmount, customerPrice: sellPrice(partnerAmount, margin) };
}

/** A variation from the portal, checked: 1–5 items with a label and a price, and a reason. Null if unusable. */
export function cleanVariationInput(raw: unknown): { reason: string; items: VariationItem[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { reason?: unknown; items?: unknown };
  const reason = plainText(r.reason, VARIATION_LIMITS.reason);
  if (reason.length < 3 || !Array.isArray(r.items)) return null;
  const items: VariationItem[] = [];
  for (const it of r.items.slice(0, VARIATION_LIMITS.items)) {
    if (!it || typeof it !== "object") return null;
    const { label, amount } = it as { label?: unknown; amount?: unknown };
    const l = plainText(label, VARIATION_LIMITS.label);
    if (!l || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > VARIATION_LIMITS.maxItemAmount) return null;
    items.push({ label: l, amount: Math.round(amount * 100) / 100 });
  }
  return items.length ? { reason, items } : null;
}

/** Only a variation still waiting can be decided or withdrawn. */
export function canDecide(v: Variation) {
  return v.status === "sent";
}

/** Approved variations add to the partner's payout and the customer's total. */
export function approvedTotals(variations: Variation[] = []) {
  const approved = variations.filter((v) => v.status === "approved");
  return {
    partnerAmount: approved.reduce((s, v) => s + v.partnerAmount, 0),
    customerPrice: approved.reduce((s, v) => s + v.customerPrice, 0),
  };
}

export const VARIATION_STATUS_LABEL: Record<VariationStatus, string> = {
  sent: "Waiting for the customer",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

/** Adds a priced variation, waiting for the customer. */
export function addVariation(
  list: Variation[] = [],
  input: { reason: string; items: VariationItem[] },
  pricing: { type: PartnerType; margin?: number },
  opts: { id: string; now: string },
): Variation[] {
  const { partnerAmount, customerPrice } = priceVariation(input.items, pricing);
  return [
    ...list,
    { id: opts.id, reason: input.reason, items: input.items, partnerAmount, customerPrice, status: "sent", sentAt: opts.now },
  ];
}

export type VariationAction = "approve" | "decline" | "withdraw";

/** The customer approves or declines, or the partner withdraws, a variation still waiting. Null if it can't be. */
export function decideVariation(list: Variation[] = [], id: string, action: VariationAction, now: string): Variation[] | null {
  const v = list.find((x) => x.id === id);
  if (!v || !canDecide(v)) return null;
  const status: VariationStatus = action === "approve" ? "approved" : action === "decline" ? "declined" : "withdrawn";
  return list.map((x) => (x.id === id ? { ...x, status, decidedAt: now } : x));
}

export function isVariationAction(v: unknown): v is VariationAction {
  return v === "approve" || v === "decline" || v === "withdraw";
}
