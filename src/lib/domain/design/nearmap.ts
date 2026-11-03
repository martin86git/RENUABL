/**
 * Nearmap in the designer (3 Nov 2026, Martin): the words for a capture and what it offers. Pure, tested in
 * `nearmap.test.ts`.
 */

/** A capture's date in words: "2 Sep 2026". */
export const capturedWords = (iso: string | null) =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "date not given";

export interface NearmapOffers {
  /** The roof's heights (DSM, DTM or other elevation data). */
  heights: boolean;
  /** A true ortho: every point drawn straight down, buildings included. */
  trueOrtho: boolean;
  mesh: boolean;
  /** Pictures from the side. */
  obliques: boolean;
}

/**
 * What a capture offers that designing by itself would use, read from the names Nearmap's Coverage API gives its
 * resources with this key: a guide to what the subscription reaches at the roof, not a promise of what each delivers.
 */
export function offersOf(resources: readonly string[]): NearmapOffers {
  const has = (re: RegExp) => resources.some((r) => re.test(r));
  return {
    heights: has(/dsm|dem\b|dtm|elevation/i),
    trueOrtho: has(/true\s*ortho/i),
    mesh: has(/mesh|\b3d\b/i),
    obliques: has(/:(north|south|east|west)\b|oblique|panorama/i),
  };
}

/** How far back the designer offers Nearmap's captures of a roof (Martin, 3 Nov 2026: the last two years). */
export const NEARMAP_YEARS = 2;

/** The captures from the last `years` up to `today` (YYYY-MM-DD, the market's day), newest first. */
export function recentCaptures<T extends { captured: string }>(captures: readonly T[], today: string, years = NEARMAP_YEARS): T[] {
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y - years, m - 1, d)).toISOString().slice(0, 10);
  return captures.filter((c) => c.captured >= from && c.captured <= today).sort((a, b) => b.captured.localeCompare(a.captured));
}
