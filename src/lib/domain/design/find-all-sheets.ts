import { codeKey, isAustralianSheet } from "./datasheets";
import type { DocKind } from "./proposal-datasheets";

/**
 * Every product on a business's price lists whose datasheet isn't on hand, to look for online in one run (26 Nov 2026,
 * Martin: "look up all the products uploaded in the price list section of Renuabl and download their appropriate data
 * sheets", the Australian version for panels and inverters). The finder already prefers Australia's sheet
 * (`sheetRegionScore`, the search's own instructions); this only says what to look for.
 */

export interface ListedProduct {
  kind: DocKind;
  sku: string;
  name: string;
}

/**
 * Why a product is to be looked for: no sheet at all, figures on file but not the sheet itself to open, or a sheet found
 * online from a link that isn't Australia's ("not-au", 27 Nov 2026), to swap for the Australian version.
 */
export type SheetGap = "none" | "no-file" | "not-au";

export interface ToFind extends ListedProduct {
  gap: SheetGap;
}

/** How many products a request looks for: each is a few searches, a download and a read, under the route's 300 s. */
export const FIND_BATCH = 2;

/** The most products one run will look for (a guard: a list of thousands isn't searched one by one). */
export const FIND_RUN_MAX = 400;

/**
 * The products to look for, panels and inverters first (they need figures to be strung), then batteries and EV
 * chargers; one a product code (`codeKey`), whatever the list wrote. `sheets` are panel and inverter sheets on hand
 * (the business's own and those shared with it), `files` battery and charger sheets.
 */
export function sheetsToFind(
  products: readonly ListedProduct[],
  sheets: readonly { kind: DocKind; sku: string; hasFile?: boolean; foundUrl?: string | null }[],
  files: readonly { kind: DocKind; sku: string; foundUrl?: string | null }[],
): ToFind[] {
  const withFile = new Set<string>();
  const figuresOnly = new Set<string>();
  for (const s of sheets) (s.hasFile ? withFile : figuresOnly).add(`${s.kind}:${codeKey(s.sku)}`);
  for (const f of files) withFile.add(`${f.kind}:${codeKey(f.sku)}`);
  const order: DocKind[] = ["panel", "inverter", "battery", "charger"];
  const seen = new Set<string>();
  const out: ToFind[] = [];
  for (const kind of order)
    for (const p of products) {
      if (p.kind !== kind) continue;
      const code = codeKey(p.sku);
      const key = `${kind}:${code}`;
      if (!code || seen.has(key) || withFile.has(key)) continue;
      seen.add(key);
      out.push({ ...p, gap: figuresOnly.has(key) ? "no-file" : "none" });
    }
  // Sheets found online from a link that isn't Australia's, on the price lists: the Australian version looked for.
  const notAu = new Set<string>();
  for (const s of [...sheets, ...files])
    if (s.foundUrl && /^https?:/i.test(s.foundUrl) && !isAustralianSheet(s.foundUrl)) notAu.add(`${s.kind}:${codeKey(s.sku)}`);
  for (const kind of order)
    for (const p of products) {
      const key = `${kind}:${codeKey(p.sku)}`;
      if (p.kind !== kind || seen.has(key) || !notAu.has(key)) continue;
      seen.add(key);
      out.push({ ...p, gap: "not-au" });
    }
  return out.slice(0, FIND_RUN_MAX);
}

/** What one product's look came to, as the run's list says it. */
export type FindResult = "found" | "kept-already" | "not-found" | "not-read" | "off" | "replaced" | "no-au";

export const FIND_RESULT_WORDS: Record<FindResult, string> = {
  found: "Found and kept",
  "kept-already": "Already on file",
  "not-found": "No datasheet found online",
  "not-read": "Found a sheet but couldn't read it for this model",
  off: "Finding datasheets isn't set up on this site",
  replaced: "Swapped for the Australian sheet",
  "no-au": "No Australian sheet found online, the one on file kept",
};
