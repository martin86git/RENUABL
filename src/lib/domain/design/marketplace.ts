/**
 * The Marketplace, part one: job listings (1 Nov 2026, Martin: "connecting retailers with installers to have their
 * customers who need an installation completed... job listings just like Airbnb listings, and then bid to take on the
 * installation"). It is the first thing in RENUABL one business shows others, so a listing carries only what an
 * installer needs to price the work: the suburb, the system, the site in words, when, and a guide price if the poster
 * gives one. Never the customer's name, phone, email or street, and never the poster's costs or margin. Installers bid
 * a price for the installation (ex GST) and the day they could start; the poster sees every bid with the business
 * behind it and chooses one. Only then do the two businesses see each other's contact and the street address; the
 * customer's own details stay with the poster to pass on. Pure, tested.
 */
import { addDaysISO } from "../scheduling";
import type { ISODate } from "../types";
import { todayInMarket } from "../market";
import { suburbOf } from "./pickup-slip";

export const LISTING_STATES = ["open", "awarded", "closed", "withdrawn"] as const;
export type ListingState = (typeof LISTING_STATES)[number];
export const BID_STATES = ["open", "accepted", "declined", "withdrawn"] as const;
export type BidState = (typeof BID_STATES)[number];

/** How long a listing takes bids, in days. */
export const OPEN_FOR = [3, 7, 14] as const;
export const DEFAULT_OPEN_FOR = 7;
export const NOTES_MAX = 1200;
export const BID_NOTE_MAX = 600;
export const MAX_BID = 200_000;

/** What a listing says about the system and the site, all in plain words, none of it the customer's. */
export interface ListingSystem {
  kw: number | null;
  panels: number | null;
  panel: string;
  inverter: string;
  batteryKwh: number | null;
  ev: boolean;
  storeys: string;
  roof: string;
  phases: string;
  /** Added 1 Nov 2026 (Martin: what any installer wants to know before bidding); older listings have none. */
  battery?: string;
  arrays?: number | null;
  strings?: number | null;
  tiltFrames?: boolean | null;
  /** From the quote: the switchboard upgrade included, left out (it may still apply), or not decided. */
  switchboard?: SwitchboardWork;
}

export const SWITCHBOARD_WORK = ["included", "excluded", "to-confirm"] as const;
export type SwitchboardWork = (typeof SWITCHBOARD_WORK)[number];

/** The switchboard upgrade from the quote line as it was decided (LineEdit: on, removed, or neither). */
export const switchboardWork = (edit: { on?: boolean; removed?: boolean } | undefined): SwitchboardWork =>
  edit?.on ? "included" : edit?.removed ? "excluded" : "to-confirm";

export interface BreakdownRow {
  label: string;
  value: string;
  /** Yes or no at a glance for what is either there or not; null for a plain fact. */
  has: boolean | null;
}

/**
 * What an installer wants to know before pricing a job, row by row, in the same order on every listing: panels,
 * inverter, battery, EV charger, switchboard upgrade, then the site. A row with nothing known says so rather than
 * disappearing, so two listings read alike.
 */
export function listingBreakdown(s: ListingSystem): BreakdownRow[] {
  const unknown = "Not given";
  const panels = s.panels ? `${s.panels} × ${s.panel || "panels"}` : s.panel || unknown;
  const rows: BreakdownRow[] = [
    { label: "System", value: s.kw ? `${s.kw.toFixed(2)} kW` : unknown, has: null },
    { label: "Panels", value: panels, has: null },
    { label: "Inverter", value: s.inverter || unknown, has: null },
    {
      label: "Battery",
      value: s.batteryKwh ? [`${s.batteryKwh} kWh`, s.battery].filter(Boolean).join(" · ") : "No battery",
      has: Boolean(s.batteryKwh),
    },
    { label: "EV charger", value: s.ev ? "Included" : "No EV charger", has: s.ev },
    {
      label: "Switchboard upgrade",
      value: s.switchboard === "included" ? "Included" : s.switchboard === "excluded" ? "Not included" : "To confirm on site",
      has: s.switchboard === "included" ? true : s.switchboard === "excluded" ? false : null,
    },
    { label: "Arrays", value: s.arrays ? String(s.arrays) : unknown, has: null },
    { label: "Strings", value: s.strings ? String(s.strings) : unknown, has: null },
    {
      label: "Tilt frames",
      value: s.tiltFrames === true ? "Yes" : s.tiltFrames === false ? "No" : unknown,
      has: s.tiltFrames ?? null,
    },
    { label: "Storeys", value: s.storeys || unknown, has: null },
    { label: "Roof", value: s.roof || unknown, has: null },
    { label: "Phase", value: s.phases || unknown, has: null },
  ];
  return rows;
}

export interface Listing {
  id: string;
  /** The business that posted it, by name (its id never leaves the server). */
  business: string;
  title: string;
  suburb: string;
  state: string;
  postcode: string;
  /** The place to about a kilometre, for distance only (never the home's own point). */
  near: { lat: number; lng: number } | null;
  system: ListingSystem;
  notes: string;
  /** The earliest and latest days the work could be done; null each when flexible. */
  from: ISODate | null;
  to: ISODate | null;
  /** A guide price for the installation ex GST, or null: open to offers. */
  guide: number | null;
  status: ListingState;
  closesOn: ISODate;
  createdAt: string;
  bids: number;
  /** Whether the roof design was drawn for it (listing-picture.ts): served at /api/design/marketplace/<id>/picture. */
  picture: boolean;
  /** Set for the business that posted it. */
  mine: boolean;
  /** This business's own bid on it, if any. */
  myBid: Bid | null;
  /** How many people are watching it (never who), and whether the person reading is (market-alerts.ts). */
  watching?: number;
  watched?: boolean;
}

export interface Bid {
  id: string;
  listingId: string;
  /** The bidding business, by name. */
  business: string;
  amount: number;
  /** The first day they could do it. */
  start: ISODate | null;
  note: string;
  status: BidState;
  at: string;
}

/** The suburb alone, from an address: a state and postcode written in the same part ("Glen Waverley VIC 3150") are shown apart. */
export function suburbAlone(address: string): string {
  return suburbOf(address)
    .replace(/\s+\b(VIC|NSW|QLD|SA|WA|TAS|ACT|NT)\b.*$/i, "")
    .replace(/\s+\d{4}$/, "")
    .trim();
}

/** Rounds a place to about a kilometre: enough to say how far, never where the home is. */
export const roughPlace = (p: { lat: number; lng: number }) => ({ lat: Math.round(p.lat * 100) / 100, lng: Math.round(p.lng * 100) / 100 });

const PHONE = /(\+?61|0)[\s-]?[2-478](?:[\s-]?\d){8}\b|\b\d{4}[\s-]?\d{3}[\s-]?\d{3}\b/g;
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const STREET =
  /\b\d+[a-z]?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(Street|St|Road|Rd|Avenue|Ave|Court|Ct|Drive|Dr|Place|Pl|Crescent|Cres|Lane|Ln|Way|Parade|Pde|Close|Cl|Grove|Gr|Terrace|Tce|Boulevard|Bvd|Highway|Hwy)\b\.?/g;

/**
 * Words a business writes on a listing, made safe to show other businesses: phone numbers, emails, links and street
 * addresses taken out (contact is exchanged through the marketplace, and the customer's details aren't shared).
 */
export function publicWords(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f<>]/g, "")
    .replace(EMAIL, "[email removed]")
    .replace(LINK, "[link removed]")
    .replace(PHONE, "[phone removed]")
    .replace(STREET, "[address removed]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const date = (v: unknown): ISODate | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** A listing as posted: the words, the window, the guide and how long it's open; or why not. */
export function cleanListingInput(
  raw: unknown,
  today: ISODate,
):
  | { ok: true; notes: string; from: ISODate | null; to: ISODate | null; guide: number | null; openFor: number }
  | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const from = date(r.from);
  const to = date(r.to);
  if (from && from < today) return { ok: false, message: "The earliest day can't be in the past." };
  if (from && to && to < from) return { ok: false, message: "The latest day is before the earliest." };
  const g = r.guide === null || r.guide === "" || r.guide === undefined ? null : Math.round(Number(r.guide));
  if (g !== null && (!Number.isFinite(g) || g <= 0 || g > MAX_BID))
    return { ok: false, message: "A guide price is a dollar amount, or leave it open to offers." };
  const openFor = (OPEN_FOR as readonly number[]).includes(Number(r.openFor)) ? Number(r.openFor) : DEFAULT_OPEN_FOR;
  return { ok: true, notes: publicWords(r.notes, NOTES_MAX), from, to, guide: g, openFor };
}

/** A bid as placed: a price ex GST, the first day they could start, a short note; or why not. */
export function cleanBidInput(
  raw: unknown,
  today: ISODate,
): { ok: true; amount: number; start: ISODate | null; note: string } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const amount = Math.round(Number(r.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BID)
    return { ok: false, message: "Your price is a dollar amount for the installation, ex GST." };
  const start = date(r.start);
  if (start && start < today) return { ok: false, message: "The day you could start can't be in the past." };
  return { ok: true, amount, start, note: publicWords(r.note, BID_NOTE_MAX) };
}

/** The day a listing stops taking bids. */
export const closesOn = (today: ISODate, openFor: number) => addDaysISO(today, openFor);

/** Whether a listing still takes bids today. */
export const takesBids = (l: Pick<Listing, "status" | "closesOn">, today: ISODate = todayInMarket()) =>
  l.status === "open" && l.closesOn >= today;

/** Why this business can't bid on a listing, or null. */
export function bidRefusal(l: Pick<Listing, "status" | "closesOn" | "mine">, today: ISODate): string | null {
  if (l.mine) return "You can't bid on your own listing.";
  if (l.status === "awarded") return "This job has gone to another installer.";
  if (l.status !== "open") return "This listing is closed.";
  if (l.closesOn < today) return "This listing has stopped taking bids.";
  return null;
}

/** "Closes today", "Closes in 3 days", "Closed". */
export function closesWords(l: Pick<Listing, "status" | "closesOn">, today: ISODate): string {
  if (l.status === "awarded") return "Awarded";
  if (l.status !== "open" || l.closesOn < today) return "Closed";
  const days = Math.round((Date.parse(`${l.closesOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days === 0 ? "Closes today" : `Closes in ${days} ${days === 1 ? "day" : "days"}`;
}

/** The system in a line: "6.65 kW · 14 panels · 13.5 kWh battery · EV charger". */
export function systemLine(s: ListingSystem): string {
  return (
    [
      s.kw ? `${s.kw.toFixed(2)} kW` : "",
      s.panels ? `${s.panels} panels` : "",
      s.batteryKwh ? `${s.batteryKwh} kWh battery` : "",
      s.ev ? "EV charger" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "System to be confirmed"
  );
}

/** The work window in words. */
export function windowWords(from: ISODate | null, to: ISODate | null): string {
  const d = (x: ISODate) => new Date(`${x}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
  if (from && to) return `${d(from)} to ${d(to)}`;
  if (from) return `From ${d(from)}`;
  if (to) return `By ${d(to)}`;
  return "Flexible dates";
}

/** Kilometres between two places, as the crow flies. */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const DISTANCES = [25, 50, 100, null] as const;
export type Distance = (typeof DISTANCES)[number];

/** Listings an installer browses: still open, not their own, within the distance of their base when it is marked, the soonest closing first. */
export function browse(
  listings: readonly Listing[],
  base: { lat: number; lng: number } | null,
  within: Distance,
  today: ISODate,
): (Listing & { km: number | null })[] {
  return listings
    .filter((l) => !l.mine && takesBids(l, today))
    .map((l) => ({ ...l, km: base && l.near ? Math.round(kmBetween(base, l.near)) : null }))
    .filter((l) => within === null || l.km === null || l.km <= within)
    .sort((a, b) => a.closesOn.localeCompare(b.closesOn) || b.createdAt.localeCompare(a.createdAt));
}

/** Bids as the poster weighs them: open ones first, the lowest price first, then the soonest start. */
export const bidOrder = (bids: readonly Bid[]) =>
  [...bids].sort(
    (a, b) =>
      Number(a.status !== "open" && a.status !== "accepted") - Number(b.status !== "open" && b.status !== "accepted") ||
      a.amount - b.amount ||
      (a.start ?? "9999").localeCompare(b.start ?? "9999"),
  );

/** "New bid on your listing" email to the poster, from RENUABL: the price and the bidder, nothing else of the job. */
export function newBidEmail(input: { suburb: string; system: string; bidder: string; amount: number; link: string }) {
  const money = `$${input.amount.toLocaleString("en-AU")} ex GST`;
  return {
    subject: `New bid on your ${input.suburb} listing: ${money}`,
    text: `${input.bidder} bid ${money} on your listing in ${input.suburb} (${input.system}).\n\nSee every bid and choose one: ${input.link}`,
    html: `<p>${esc(input.bidder)} bid <strong>${esc(money)}</strong> on your listing in ${esc(input.suburb)} (${esc(input.system)}).</p><p><a href="${esc(input.link)}">See every bid and choose one</a></p>`,
  };
}

/** "Your bid was accepted" email to the winning installer, from RENUABL, with the way to the job's details. */
/** To the winner. With `jobCard` the job is already in its Jobs (an installer's), and the link opens its job card. */
export function awardedEmail(input: { suburb: string; system: string; poster: string; amount: number; link: string; jobCard?: boolean }) {
  const money = `$${input.amount.toLocaleString("en-AU")} ex GST`;
  const where = input.jobCard
    ? "The job is in your Jobs, with the address and their contact"
    : "The address and their contact are on the listing";
  return {
    subject: `Your bid was accepted: ${input.suburb} installation`,
    text: `${input.poster} accepted your bid of ${money} for the installation in ${input.suburb} (${input.system}).

${where}: ${input.link}`,
    html: `<p>${esc(input.poster)} accepted your bid of <strong>${esc(money)}</strong> for the installation in ${esc(input.suburb)} (${esc(input.system)}).</p><p><a href="${esc(input.link)}">${esc(where)}</a></p>`,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
