/**
 * Supplier price imports: a price list (spreadsheet rows) is matched to the
 * products RENUABL quotes, by SKU, and turned into a list of changes for staff
 * to confirm. Only products already in the catalogue are updated; prices are
 * supplier cost ex GST, like the AWM list. Pure and tested.
 */
import * as catalogue from "./catalogue";

export interface CatalogueEntry {
  sku: string;
  name: string;
  cost: number;
}

export interface PriceChange {
  sku: string;
  name: string;
  oldCost: number;
  newCost: number;
  /** newCost / oldCost − 1 */
  change: number;
}

export interface PriceMatch {
  /** Products found with a different price. */
  changes: PriceChange[];
  /** Products found at the same price. */
  unchanged: number;
  /** Catalogue products the file doesn't list (they keep their current price). */
  notInFile: CatalogueEntry[];
}

/** A change this big is shown in amber for a second look (a typo, or per-pack vs per-item). */
export const BIG_PRICE_CHANGE = 0.3;

function isItem(v: unknown): v is CatalogueEntry {
  const o = v as Partial<CatalogueEntry> | null;
  return Boolean(o && typeof o.sku === "string" && typeof o.name === "string" && typeof o.cost === "number");
}

/** Every product RENUABL prices, from the catalogue module (panels, inverters, battery parts, racking, BOS, …). */
export function catalogueEntries(): CatalogueEntry[] {
  const out = new Map<string, CatalogueEntry>();
  const visit = (v: unknown, depth: number) => {
    if (depth > 3 || !v || typeof v !== "object") return;
    if (isItem(v)) {
      out.set(v.sku.toUpperCase(), { sku: v.sku, name: v.name, cost: v.cost });
      return;
    }
    for (const child of Array.isArray(v) ? v : Object.values(v)) visit(child, depth + 1);
  };
  for (const value of Object.values(catalogue)) visit(value, 0);
  return [...out.values()];
}

/**
 * A price from a cell: "$123.50", "123.5", "1,295.00", or AWM's
 * "26.0c/w ($123.50)" (the dollar amount in brackets wins). Null if none.
 */
export function parsePrice(cell: string): number | null {
  const text = cell.trim();
  if (!text) return null;
  const bracket = text.match(/\(\s*\$?\s*([\d,]+(?:\.\d+)?)\s*\)/);
  const plain = text.match(/^\$?\s*([\d,]+(?:\.\d+)?)$/);
  const m = bracket ?? plain;
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 10_000) / 10_000 : null;
}

const normSku = (s: string) => s.trim().toUpperCase();

/**
 * Matches rows to the catalogue: a row counts when one of its cells is a
 * catalogue SKU (or starts with it, e.g. "JKM475N-48QL6-DB | Jinko 475W…"),
 * and its price is the last cell after the SKU that reads as a price.
 */
export function matchPrices(rows: string[][], entries: CatalogueEntry[] = catalogueEntries()): PriceMatch {
  const bySku = new Map(entries.map((e) => [normSku(e.sku), e]));
  const skus = [...bySku.keys()].sort((a, b) => b.length - a.length);
  const found = new Map<string, number>();
  for (const row of rows) {
    const cells = row.map((c) => String(c ?? ""));
    for (let i = 0; i < cells.length; i++) {
      const cell = normSku(cells[i]);
      const sku = bySku.has(cell)
        ? cell
        : skus.find((s) => cell.startsWith(`${s} `) || cell.startsWith(`${s}|`) || cell.startsWith(`${s}\t`));
      if (!sku || found.has(sku)) continue;
      // Price: the last price-like cell after the SKU, or inside the same cell ("SKU | name | 26.0c/w ($123.50)").
      const after = cells
        .slice(i + 1)
        .map(parsePrice)
        .filter((p): p is number => p !== null);
      const inline = cell === sku ? null : parsePrice(cells[i].split("|").at(-1) ?? "");
      const price = after.at(-1) ?? inline;
      if (price !== null) found.set(sku, price);
      break;
    }
  }
  const changes: PriceChange[] = [];
  let unchanged = 0;
  for (const [sku, newCost] of found) {
    const e = bySku.get(sku)!;
    if (Math.abs(newCost - e.cost) < 0.00005) unchanged++;
    else changes.push({ sku: e.sku, name: e.name, oldCost: e.cost, newCost, change: newCost / e.cost - 1 });
  }
  changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const notInFile = entries.filter((e) => !found.has(normSku(e.sku)));
  return { changes, unchanged, notInFile };
}

/** Rows from CSV text (quoted fields, commas or tabs). */
export function parseCsv(text: string): string[][] {
  const delim = (text.split("\n")[0] ?? "").includes("\t") && !(text.split("\n")[0] ?? "").includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Catalogue cost with any imported price applied. */
export function costOf(sku: string, fallback: number, imported?: Record<string, number> | null) {
  return imported?.[sku] ?? fallback;
}
