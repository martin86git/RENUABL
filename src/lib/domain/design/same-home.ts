/**
 * A deal and a roof design are the same home (22 Nov 2026, Martin: a deal brought in from Pylon had its place from
 * Pylon's map, the designs were drawn where Google put the address a few metres away, and the two never met, so the
 * proposal said there was no design while the designer held two). Exact places still join as before; this lets a
 * deal with no design find one drawn close by at the same street address.
 */
import { metresBetween } from "../solar-roof";

/** How far apart the two points may be and still be one home when the street address agrees (a big block, two geocoders). */
export const SAME_HOME_M = 40;
/** Without a street address to compare, only points this close count (the designer's own rounding is about a metre). */
export const SAME_SPOT_M = 6;

const SUFFIXES: Record<string, string> = {
  street: "st",
  st: "st",
  road: "rd",
  rd: "rd",
  drive: "dr",
  dr: "dr",
  avenue: "ave",
  ave: "ave",
  av: "ave",
  court: "ct",
  ct: "ct",
  place: "pl",
  pl: "pl",
  crescent: "cres",
  cres: "cres",
  cr: "cres",
  close: "cl",
  cl: "cl",
  parade: "pde",
  pde: "pde",
  boulevard: "blvd",
  blvd: "blvd",
  lane: "ln",
  ln: "ln",
  way: "way",
  terrace: "tce",
  tce: "tce",
  grove: "gr",
  gr: "gr",
  highway: "hwy",
  hwy: "hwy",
  circuit: "cct",
  cct: "cct",
  square: "sq",
  sq: "sq",
  rise: "rise",
  walk: "walk",
  mews: "mews",
};

/**
 * The street line of an address, written one way: "28 Shearer Drive, Rowville VIC 3178" and "28 shearer dr rowville"
 * both read "28 shearer dr". Null when it has no number and street.
 */
export function streetLine(address: string): string | null {
  const words = address
    .toLowerCase()
    .split(",")[0]
    .replace(/[^a-z0-9/ -]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  // Read to the first street word after a name ("28 shearer drive rowville" stops at drive).
  const end = words.findIndex((w, i) => i >= 2 && w in SUFFIXES);
  const kept = end > 0 ? words.slice(0, end + 1).map((w, i) => (i === end ? SUFFIXES[w] : w)) : words;
  if (kept.length < 2 || !/\d/.test(kept[0])) return null;
  return kept.join(" ");
}

type Place = { address: string; lat: number; lng: number };

/** Whether a deal's place and a design's place are the same home. */
export function sameHome(a: Place, b: Place): boolean {
  const apart = metresBetween(a, b);
  if (apart <= SAME_SPOT_M) return true;
  const sa = streetLine(a.address);
  return apart <= SAME_HOME_M && sa !== null && sa === streetLine(b.address);
}

/** The design of these that is the same home as the deal, the nearest when two are. Null when none is. */
export function homeFor<T extends Place>(deal: Place, designs: readonly T[]): T | null {
  return designs.filter((d) => sameHome(deal, d)).sort((x, y) => metresBetween(deal, x) - metresBetween(deal, y))[0] ?? null;
}
