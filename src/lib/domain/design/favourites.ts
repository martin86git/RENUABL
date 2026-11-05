/**
 * Favourite products in the designer (5 Nov 2026, Martin, as Primero's): a star beside a panel, inverter, battery or EV
 * charger in the designer's lists puts it at the top of that list, the newest starred first, the rest in their usual
 * order. Each person keeps their own (what one designer reaches for isn't what another does). It changes the order of a
 * list only, never a quote or a design. Pure, tested.
 */

export const FAVOURITE_KINDS = ["panels", "inverters", "batteries", "chargers"] as const;
export type FavouriteKind = (typeof FAVOURITE_KINDS)[number];
export type Favourites = Record<FavouriteKind, string[]>;

/** Starred products a list, so a long run of favourites can't crowd out the rest. */
export const MAX_FAVOURITES = 30;

export const noFavourites = (): Favourites => ({ panels: [], inverters: [], batteries: [], chargers: [] });

export const isFavouriteKind = (v: unknown): v is FavouriteKind => FAVOURITE_KINDS.includes(v as FavouriteKind);

/** A product code as kept: trimmed, short, plain characters only. "" when it isn't one. */
export function favouriteCode(v: unknown): string {
  if (typeof v !== "string") return "";
  const code = v.trim().slice(0, 60);
  return /^[\w.+/ -]+$/.test(code) ? code : "";
}

/** Favourites from outside (the server, this device's storage, a request): every list checked, no repeats, none too long. */
export function cleanFavourites(raw: unknown): Favourites {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = noFavourites();
  for (const kind of FAVOURITE_KINDS) {
    const list = Array.isArray(r[kind]) ? (r[kind] as unknown[]).map(favouriteCode).filter(Boolean) : [];
    out[kind] = [...new Set(list)].slice(0, MAX_FAVOURITES);
  }
  return out;
}

/** Stars a product (newest at the front) or takes its star off. */
export function withFavourite(favs: Favourites, kind: FavouriteKind, code: string, on: boolean): Favourites {
  const c = favouriteCode(code);
  if (!c) return favs;
  const rest = favs[kind].filter((s) => s !== c);
  return { ...favs, [kind]: (on ? [c, ...rest] : rest).slice(0, MAX_FAVOURITES) };
}

/** A list with its favourites first, in the order they were starred, and everything else as it was. */
export function favouritesFirst<T extends { sku: string }>(list: readonly T[], starred: readonly string[]): T[] {
  if (!starred.length) return [...list];
  const rank = new Map(starred.map((s, i) => [s, i]));
  const top = list.filter((p) => rank.has(p.sku)).sort((a, b) => rank.get(a.sku)! - rank.get(b.sku)!);
  return [...top, ...list.filter((p) => !rank.has(p.sku))];
}
