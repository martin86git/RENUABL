/**
 * Job offers. A new job is offered to one partner at a time: the approved
 * partner whose job radius covers the home, preferred partners first, then the
 * nearest. They have 24 hours to accept; if they decline or time runs out, it
 * goes to the next partner. Pure and tested.
 */
import { MIN_PUBLIC_LIABILITY, distanceKm } from "./partner";
import type { ISODate } from "./types";

export const OFFER_HOURS = 24;

export interface OfferPartner {
  id: string;
  status: "pending" | "approved" | "declined" | "paused";
  base: { lat?: number; lng?: number; state?: string } | null;
  radiusKm: number;
  /** Higher goes first (RENUABL's installer of choice). */
  priority: number;
  insuranceExpires: ISODate | null;
  publicLiability: number | null;
}

export interface OfferHome {
  lat?: number;
  lng?: number;
  state: string;
}

/** Whether a partner can take new offers today: approved, and insured for at least $10M. */
export function canTakeOffers(p: OfferPartner, today: ISODate) {
  return (
    p.status === "approved" &&
    Boolean(p.insuranceExpires && p.insuranceExpires >= today) &&
    (p.publicLiability ?? 0) >= MIN_PUBLIC_LIABILITY
  );
}

/**
 * Partners who could be offered the job, best first. Partners already offered
 * it (declined or let it lapse) are left out. Without coordinates for the
 * home, partners based in the same state are used.
 */
export function rankPartners(home: OfferHome, partners: OfferPartner[], alreadyOffered: Set<string>, today: ISODate) {
  const hasHome = typeof home.lat === "number" && typeof home.lng === "number";
  return partners
    .filter((p) => canTakeOffers(p, today) && !alreadyOffered.has(p.id))
    .map((p) => {
      const b = p.base;
      const km =
        hasHome && typeof b?.lat === "number" && typeof b?.lng === "number"
          ? distanceKm({ lat: home.lat!, lng: home.lng! }, { lat: b.lat, lng: b.lng })
          : null;
      return { partner: p, km };
    })
    .filter(({ partner, km }) => (km === null ? partner.base?.state?.toUpperCase() === home.state.toUpperCase() : km <= partner.radiusKm))
    .sort((a, b) => b.partner.priority - a.partner.priority || (a.km ?? 9e9) - (b.km ?? 9e9) || a.partner.id.localeCompare(b.partner.id));
}

export function offerExpiry(offeredAt: Date) {
  return new Date(offeredAt.getTime() + OFFER_HOURS * 3_600_000);
}

/** "23 h 12 min left", "40 min left", or expired. */
export function timeLeft(expiresAt: string | Date, now: Date = new Date()) {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return { expired: true, label: "Offer expired" };
  const mins = Math.ceil(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { expired: false, label: h ? `${h} h ${m} min left` : `${m} min left` };
}
