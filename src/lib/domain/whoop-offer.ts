/**
 * The WHOOP launch offer: a free WHOOP One (12-month membership) with any
 * order that includes a battery, one per order, while stocks last (`cap`).
 * No end date since 5 Oct 2026 (it was 31 October); set `endsOn` to a
 * "YYYY-MM-DD" (inclusive, Melbourne time) to close it on a day. Claims are counted on the server (whoop_claims);
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
  /** Stock: at most this many. */
  cap: 50,
  /** Last day to reserve (inclusive, in the launch market's time zone), or null: while stocks last. */
  endsOn: null as string | null,
  name: "Launch offer",
};

export type WhoopStatus = "claimed" | "shipped" | "delivered" | "released";

/** What customers see for each status. */
export const WHOOP_STATUS_LABELS: Record<Exclude<WhoopStatus, "released">, string> = {
  claimed: "Reserved",
  shipped: "Shipped",
  delivered: "Delivered",
};

const value = `$${WHOOP_OFFER.value}`;
/** "31 October 2026", or null when there's no end date (while stocks last). */
export const WHOOP_ENDS: string | null = WHOOP_OFFER.endsOn
  ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${WHOOP_OFFER.endsOn}T00:00:00Z`),
    )
  : null;

export const WHOOP_COPY = {
  badge: "Free WHOOP included",
  addBattery: `Add a battery to get a free WHOOP (valued at ${value}).`,
  strip: `Free WHOOP, valued at ${value}, with any plan that includes a battery`,
  first: WHOOP_OFFER.name,
  bannerLabel: WHOOP_OFFER.name,
  bannerHeading: "A free WHOOP with any plan that includes a battery.",
  bannerSmall: `Valued at ${value} (${WHOOP_OFFER.product} in ${WHOOP_OFFER.colour}, ${WHOOP_OFFER.membership}). ${WHOOP_ENDS ? `Reserve by ${WHOOP_ENDS}, while` : "While"} stocks last (${WHOOP_OFFER.cap} available). Ships after installation.`,
  giftLine: `${WHOOP_OFFER.product} in ${WHOOP_OFFER.colour} — ${WHOOP_OFFER.membership}. Gift. Valued at ${value}.`,
  ships: "Ships after installation.",
  confirmed: "Your free WHOOP ships after your installation.",
  guideLine: `${WHOOP_OFFER.name}: a free WHOOP (valued at ${value}) with any plan that includes a battery${WHOOP_ENDS ? `, reserved by ${WHOOP_ENDS}` : ", while stocks last"}.`,
} as const;

/** One per order, when the order includes a battery. */
export function whoopEligible(config: Pick<SystemConfig, "batteryKwh">): boolean {
  return config.batteryKwh > 0;
}

/** Open while fewer than `cap` claims are held (released claims don't count), and until the end of `endsOn` when there is one. */
export function whoopOfferOpen(heldClaims: number, today: string): boolean {
  return !whoopOfferEnded(today) && heldClaims < WHOOP_OFFER.cap;
}

/** True after `endsOn`; never, while there's no end date. */
export function whoopOfferEnded(today: string): boolean {
  return WHOOP_OFFER.endsOn !== null && today > WHOOP_OFFER.endsOn;
}

/** Status moves forward only: claimed → shipped → delivered. Released is final. */
export function nextWhoopStatus(current: WhoopStatus, next: WhoopStatus): boolean {
  const order: WhoopStatus[] = ["claimed", "shipped", "delivered"];
  if (current === "released") return false;
  if (next === "released") return current === "claimed";
  return order.indexOf(next) === order.indexOf(current) + 1;
}
