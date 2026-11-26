/**
 * The last few things opened from the design home's search, kept on the device (26 Nov 2026, Martin: "Adding the last
 * 3 recently searched would be good"). Pure: the page reads and writes them through localStorage.
 */
import type { Address } from "../types";

export const RECENT_SEARCHES_MAX = 3;
export const RECENT_SEARCHES_KEY = "renuabl.design.recent-searches";

export type RecentSearch =
  { kind: "deal"; id: string; label: string; sub: string } | { kind: "place"; address: Address; label: string; sub: string };

const keyOf = (r: RecentSearch) =>
  r.kind === "deal" ? `deal:${r.id}` : `place:${r.address.line}|${r.address.suburb}|${r.address.postcode}`.toLowerCase();

/** The list with this one first, no repeats, at most `RECENT_SEARCHES_MAX`. */
export function withRecent(list: RecentSearch[], item: RecentSearch): RecentSearch[] {
  const key = keyOf(item);
  return [item, ...list.filter((r) => keyOf(r) !== key)].slice(0, RECENT_SEARCHES_MAX);
}

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** What was kept on the device, read back safely: anything malformed is dropped. */
export function cleanRecentSearches(raw: unknown): RecentSearch[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentSearch[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const label = text(o.label);
    const sub = text(o.sub);
    if (!label) continue;
    if (o.kind === "deal" && text(o.id, 80)) out.push({ kind: "deal", id: text(o.id, 80), label, sub });
    else if (o.kind === "place" && o.address && typeof o.address === "object") {
      const a = o.address as Record<string, unknown>;
      const line = text(a.line);
      if (!line) continue;
      const address: Address = { line, suburb: text(a.suburb), state: text(a.state, 10), postcode: text(a.postcode, 10) };
      if (typeof a.lat === "number" && typeof a.lng === "number" && Number.isFinite(a.lat) && Number.isFinite(a.lng)) {
        address.lat = a.lat;
        address.lng = a.lng;
      }
      if (text(a.placeId)) address.placeId = text(a.placeId);
      out.push({ kind: "place", address, label, sub });
    }
  }
  return out.slice(0, RECENT_SEARCHES_MAX);
}
