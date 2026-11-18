/**
 * Which house is the right one (18 Nov 2026, Martin: Primero's designer outlines the home as a new address opens; here
 * it is also Sol's first question, "Is this the home?"). The designer outlines **the lot the address is registered to**,
 * from Victoria's own land register (Vicmap Address and Vicmap Property, open data from the State of Victoria,
 * CC BY 4.0), and dims everything outside it until the question is answered.
 *
 * Why not just mark where Google put the pin: the pin is what is in doubt. It can land on a neighbour's roof, on the
 * street, or part-way along a court. The register is a second, independent answer: it lists every address with the
 * lot it belongs to. When Google's pin sits on a different lot from the one the register gives, the designer says so,
 * and the homes round about are offered as the answer to "No, it's another house".
 *
 * Matching and geometry only; the lookups are in `server/property-lot.ts`. Pure, tested.
 */
import type { Point } from "./roof-design";

/** The house number and road of a street address as typed, and the unit when there is one. Null with no number. */
export function streetParts(address: string): { unit: number | null; number: number; road: string } | null {
  const street = address
    .toUpperCase()
    .replace(/\b(UNIT|APARTMENT|APT|FLAT|SHOP|SUITE|LOT)\b\.?/g, " ")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // "3/12 Smith St", "Unit 3, 12 Smith St" and "12 Smith St" all end with the number and the road in one part.
  const withRoad = street.find((part) => /\d+[A-Z]?\s+[A-Z]/.test(part));
  if (!withRoad) return null;
  const m = withRoad.match(/^(?:(\d+)[A-Z]?\s*\/\s*)?(\d+)[A-Z]?(?:\s*-\s*\d+[A-Z]?)?\s+([A-Z][A-Z' ]*)/);
  if (!m) return null;
  const before = street[street.indexOf(withRoad) - 1];
  const unit = m[1] ? Number(m[1]) : before && /^\d+[A-Z]?$/.test(before) ? parseInt(before, 10) : null;
  return { unit, number: Number(m[2]), road: m[3].trim().split(/\s+/)[0] };
}

/** An address on the land register, near the spot the map is showing. */
export interface RegisteredAddress {
  /** As the register writes it: "2 HANWELL COURT GLEN WAVERLEY 3150". */
  text: string;
  /** Its number and road ("2 HANWELL COURT"), its suburb and postcode, when the register gives them. */
  street?: string;
  suburb?: string;
  postcode?: string;
  number: number | null;
  road: string | null;
  unit: number | null;
  /** The lot it belongs to, so a lot with several addresses is offered once. */
  lot?: string;
  lat: number;
  lng: number;
}

/** Metres between two places, near enough over a street's length. */
export function metresApart(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const perDegree = 111_319.49;
  return Math.hypot((a.lat - b.lat) * perDegree, (a.lng - b.lng) * perDegree * Math.cos((a.lat * Math.PI) / 180));
}

/**
 * The registered address that is the one typed: the same house number on a road whose name starts with the same word,
 * and the same unit when one was given. The nearest to the spot when there are several.
 */
export function matchAddress(
  typed: string,
  nearby: readonly RegisteredAddress[],
  spot: { lat: number; lng: number },
): RegisteredAddress | null {
  const parts = streetParts(typed);
  if (!parts) return null;
  const same = nearby.filter((a) => a.number === parts.number && a.road !== null && a.road.split(/\s+/)[0] === parts.road);
  const pool = parts.unit !== null && same.some((a) => a.unit === parts.unit) ? same.filter((a) => a.unit === parts.unit) : same;
  return [...pool].sort((a, b) => metresApart(a, spot) - metresApart(b, spot))[0] ?? null;
}

/**
 * A place on the map in the designer's own measure: metres east and south of the middle of the picture (Mercator, as
 * the picture's own scale is worked out).
 */
export function onPicture(place: { lat: number; lng: number }, middle: { lat: number; lng: number }): Point {
  const perDegree = 111_319.49;
  return {
    x: Math.round((place.lng - middle.lng) * perDegree * Math.cos((middle.lat * Math.PI) / 180) * 100) / 100,
    y: Math.round((middle.lat - place.lat) * perDegree * 100) / 100,
  };
}

/** "2 HANWELL COURT" as people write it: "2 Hanwell Court". */
export function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s\-/'])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase());
}

/** A home near the one asked about, offered when the outlined one isn't it. */
export interface NearbyHome {
  /** "14 Hanwell Court". */
  line: string;
  suburb: string;
  postcode: string;
  lat: number;
  lng: number;
  /** How far from where Google put the address, metres, whole. */
  metres: number;
}

/** How many homes round about are offered, and how far they may be. */
export const NEARBY_HOMES = { most: 6, withinMetres: 90 } as const;

/**
 * The homes round about, nearest first: one a lot, never the one already outlined, never one without a street number
 * or suburb, within `NEARBY_HOMES.withinMetres` of where Google put the address.
 */
export function nearbyHomes(
  nearby: readonly RegisteredAddress[],
  spot: { lat: number; lng: number },
  outlined: RegisteredAddress | null,
): NearbyHome[] {
  const seen = new Set<string>();
  if (outlined?.lot) seen.add(outlined.lot);
  return [...nearby]
    .filter((a) => a.street && a.suburb && a.number !== null && a.text !== outlined?.text)
    .map((a) => ({ a, metres: Math.round(metresApart(a, spot)) }))
    .filter(({ metres }) => metres <= NEARBY_HOMES.withinMetres)
    .sort((x, y) => x.metres - y.metres)
    .filter(({ a }) => {
      const key = a.lot ?? a.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, NEARBY_HOMES.most)
    .map(({ a, metres }) => ({
      line: titleCase(a.street ?? ""),
      suburb: titleCase(a.suburb ?? ""),
      postcode: a.postcode ?? "",
      lat: a.lat,
      lng: a.lng,
      metres,
    }));
}

/** The lot for an address, as the designer draws it. */
export interface PropertyLot {
  /** Its boundary: one outline for each separate piece of land (nearly always one), in metres on the picture. */
  outlines: Point[][];
  /** The address as the land register writes it, when the typed address was found there. */
  registered: string | null;
  /** Whether the middle of the picture (where Google put the address) is on this lot. False: the two disagree. */
  pinOnLot: boolean;
  /** The homes round about, for "No, it's another house". */
  nearby: NearbyHome[];
}

/**
 * The warning over the designer when the land register has no such address (18 Nov 2026, Martin: 15 Hanwell Court
 * opened with nothing said), or Google's pin is on another lot. Null when the two agree.
 */
export function registerWarning(lot: Pick<PropertyLot, "pinOnLot" | "registered">, address: string): string | null {
  const line = address.split(",")[0].trim() || address;
  if (!lot.registered)
    return `${line} isn't on Victoria's land register, so that house number may not exist. The outline is the lot under Google's pin: check the address.`;
  if (!lot.pinOnLot) return `Google has put ${line} on a different lot from the land register. Check it's the right house.`;
  return null;
}

/** What Sol says when the outline's answer is in doubt, or null when the register and Google agree. */
export function lotDoubt(lot: Pick<PropertyLot, "pinOnLot" | "registered">): string | null {
  if (!lot.pinOnLot) return "Google's pin isn't on this lot, so check it's the right house.";
  if (!lot.registered) return "I couldn't find this address on the land register: this is the lot under Google's pin.";
  return null;
}
