/**
 * Watching job listings and job alerts on the Marketplace (2 Nov 2026, Martin: as eBay and Facebook Marketplace do:
 * save a job to come back to, and hear when one is listed near you). Each is a person's own, not the business's: a
 * member watches a listing (the count of watchers is shown to everyone, never who), and a member chooses whether new
 * jobs near the business's base are emailed to them. A watched job closing tomorrow that the business hasn't bid on is
 * a reminder email, once. Nothing here shows another business anything new. Pure, tested.
 */
import type { ListingSystem } from "./marketplace";

/** How far a job may be from the business's base for an alert; null is anywhere. */
export const ALERT_DISTANCES = [25, 50, 100, null] as const;
export type AlertDistance = (typeof ALERT_DISTANCES)[number];

export interface JobAlert {
  on: boolean;
  withinKm: AlertDistance;
  /** Only jobs with a battery. */
  battery: boolean;
}

export const DEFAULT_ALERT: JobAlert = { on: false, withinKm: 50, battery: false };

/** An alert as saved, from what the browser sent: known distances only. */
export function cleanAlert(raw: unknown): JobAlert {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const within = r.withinKm === null ? null : Number(r.withinKm);
  return {
    on: r.on === true,
    withinKm: (ALERT_DISTANCES as readonly (number | null)[]).includes(within) ? (within as AlertDistance) : DEFAULT_ALERT.withinKm,
    battery: r.battery === true,
  };
}

/**
 * Whether a new listing is one this alert asks about. `km` is from the business's base to the listing's rough place;
 * null when either isn't known, which only an alert for anywhere lets through (near can't be told).
 */
export function alertMatches(alert: JobAlert, system: Pick<ListingSystem, "batteryKwh">, km: number | null): boolean {
  if (!alert.on) return false;
  if (alert.battery && !(system.batteryKwh && system.batteryKwh > 0)) return false;
  if (alert.withinKm === null) return true;
  return km !== null && km <= alert.withinKm;
}

/** The alert in a line, for the card that sets it. */
export function alertWords(a: JobAlert): string {
  if (!a.on) return "Off. Turn it on to have new jobs emailed to you.";
  const where = a.withinKm === null ? "anywhere" : `within ${a.withinKm} km of your base`;
  return `New jobs ${where}${a.battery ? " with a battery" : ""} are emailed to you.`;
}

/** "3 watching", or nothing when no one is. */
export const watchWords = (n: number) => (n > 0 ? `${n} watching` : "");

/** A watched listing is reminded the day before it closes. */
export const REMIND_DAYS_BEFORE = 1;
/** At most this many alert emails go out for one new listing (a guard, far above any real area). */
export const MAX_ALERT_EMAILS = 300;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "A new job near you", from RENUABL: the suburb, the system, how far and when it closes; nothing of the customer. */
export function newListingEmail(input: {
  suburb: string;
  system: string;
  km: number | null;
  closes: string;
  link: string;
  settings: string;
}) {
  const far = input.km === null ? "" : ` (${input.km} km from you)`;
  return {
    subject: `New job in ${input.suburb}: ${input.system}`,
    text: `A job has been listed on the RENUABL Marketplace in ${input.suburb}${far}: ${input.system}. ${input.closes}.

See it and bid: ${input.link}

You're getting this because you turned on job alerts. Change or turn them off: ${input.settings}`,
    html: `<p>A job has been listed on the RENUABL Marketplace in <strong>${esc(input.suburb)}</strong>${esc(far)}: ${esc(input.system)}. ${esc(input.closes)}.</p><p><a href="${esc(input.link)}">See it and bid</a></p><p style="color:#6b6f76;font-size:13px">You're getting this because you turned on job alerts. <a href="${esc(input.settings)}">Change or turn them off</a>.</p>`,
  };
}

/** What may be watched: a job listing, or an item of equipment. */
export const WATCH_KINDS = ["listing", "item"] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

/** A watched item that has gone: sold, or taken down by the seller. */
export function itemGoneEmail(input: { title: string; sold: boolean; link: string }) {
  const what = input.sold ? "has been sold" : "has been taken down by the seller";
  return {
    subject: `${input.sold ? "Sold" : "Taken down"}: ${input.title}`,
    text: `The ${input.title} you were watching on the RENUABL Marketplace ${what}.

See what else is for sale near you: ${input.link}`,
    html: `<p>The <strong>${esc(input.title)}</strong> you were watching on the RENUABL Marketplace ${esc(what)}.</p><p><a href="${esc(input.link)}">See what else is for sale near you</a></p>`,
  };
}

/** "Closes tomorrow" for a job someone is watching and their business hasn't bid on. */
export function closingSoonEmail(input: { suburb: string; system: string; link: string }) {
  return {
    subject: `Closes tomorrow: the ${input.suburb} job you're watching`,
    text: `The job in ${input.suburb} you're watching (${input.system}) stops taking bids tomorrow, and your business hasn't bid on it.

See it and bid: ${input.link}`,
    html: `<p>The job in <strong>${esc(input.suburb)}</strong> you're watching (${esc(input.system)}) stops taking bids tomorrow, and your business hasn't bid on it.</p><p><a href="${esc(input.link)}">See it and bid</a></p>`,
  };
}
