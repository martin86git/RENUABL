/**
 * The founding-customer WHOOP offer: a free WHOOP One (12-month membership)
 * with any order that includes a battery, for the first `cap` confirmed
 * orders, one per order. Claims are counted on the server (whoop_claims);
 * everything customers see hides itself once the cap is reached. Pure, tested.
 */
import type { SystemConfig } from "./types";

export const WHOOP_OFFER = {
  product: "WHOOP One",
  membership: "12-month membership",
  /** The only colour we supply. */
  colour: "Jet Black",
  /** VERIFY on launch day: WHOOP One's Australian retail price, in dollars. */
  value: 299,
  cap: 50,
} as const;

export type WhoopStatus = "claimed" | "shipped" | "delivered" | "released";

/** What customers see for each status. */
export const WHOOP_STATUS_LABELS: Record<Exclude<WhoopStatus, "released">, string> = {
  claimed: "Reserved",
  shipped: "Shipped",
  delivered: "Delivered",
};

const value = `$${WHOOP_OFFER.value}`;

export const WHOOP_COPY = {
  badge: "Free WHOOP included",
  addBattery: `Add a battery to get a free WHOOP (valued at ${value}).`,
  strip: `Free WHOOP, valued at ${value}, with any plan that includes a battery`,
  first: `First ${WHOOP_OFFER.cap} customers`,
  bannerLabel: `For our first ${WHOOP_OFFER.cap} founding customers`,
  bannerHeading: "A free WHOOP with any plan that includes a battery.",
  bannerSmall: `Valued at ${value} (${WHOOP_OFFER.product} in ${WHOOP_OFFER.colour}, ${WHOOP_OFFER.membership}). First ${WHOOP_OFFER.cap} customers. Ships after installation.`,
  giftLine: `${WHOOP_OFFER.product} in ${WHOOP_OFFER.colour} — ${WHOOP_OFFER.membership}. Gift. Valued at ${value}.`,
  ships: "Ships after installation.",
  confirmed: "Your free WHOOP ships after your installation.",
  guideLine: `Founding offer: a free WHOOP (valued at ${value}) with any plan that includes a battery, for our first ${WHOOP_OFFER.cap} customers.`,
} as const;

/** One per order, when the order includes a battery. */
export function whoopEligible(config: Pick<SystemConfig, "batteryKwh">): boolean {
  return config.batteryKwh > 0;
}

/** The offer is open while fewer than `cap` claims are held (released claims don't count). */
export function whoopOfferOpen(heldClaims: number): boolean {
  return heldClaims < WHOOP_OFFER.cap;
}

/** Status moves forward only: claimed → shipped → delivered. Released is final. */
export function nextWhoopStatus(current: WhoopStatus, next: WhoopStatus): boolean {
  const order: WhoopStatus[] = ["claimed", "shipped", "delivered"];
  if (current === "released") return false;
  if (next === "released") return current === "claimed";
  return order.indexOf(next) === order.indexOf(current) + 1;
}
