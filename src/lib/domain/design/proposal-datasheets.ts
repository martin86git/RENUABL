/**
 * The product datasheets that go with a proposal (26 Nov 2026, Martin: "Ensure that data sheets are findable / attached
 * to proposals for included quoted panels / inverters / batteries / ev chargers").
 *
 * The products are read from the business's side of the published version (its quote lines keep each product's code),
 * never from the customer's copy, which holds no product code. The customer is sent only an opaque id for each sheet,
 * its kind and the product's name as the proposal names it; the file is found again on the server from that id.
 * Pure, tested.
 */
import { codeKey } from "./datasheets";
import { internalForChoice, type OptionKey, type ProposalInternal } from "./proposal";
import type { CostGroup } from "./quote";

/** What a datasheet is for. Panels and inverters also carry the figures the string check reads; the rest are files only. */
export type DocKind = "panel" | "inverter" | "battery" | "charger";
export const DOC_KINDS: readonly DocKind[] = ["panel", "inverter", "battery", "charger"];
/** Kinds kept as a file alone: their figures aren't read. */
export const FILE_ONLY_KINDS: readonly DocKind[] = ["battery", "charger"];
export const isDocKind = (v: unknown): v is DocKind => typeof v === "string" && (DOC_KINDS as readonly string[]).includes(v);
export const isFileOnly = (kind: DocKind) => FILE_ONLY_KINDS.includes(kind);

/** How each kind is named to a customer and in Settings. */
export const DOC_KIND_WORDS: Record<DocKind, string> = {
  panel: "Solar panel",
  inverter: "Inverter",
  battery: "Battery",
  charger: "EV charger",
};

/** The quote's groups whose products have a datasheet. */
const KIND_OF_GROUP: Partial<Record<CostGroup, DocKind>> = {
  Panels: "panel",
  Inverters: "inverter",
  Battery: "battery",
  "EV charger": "charger",
};

/** A product on the quote, as the business's side knows it. */
export interface QuotedProduct {
  kind: DocKind;
  sku: string;
  /** As the quote names it, without its count ("14 × "). */
  name: string;
  /** The options it is in, when the customer chooses between options; null when it goes with every view of the proposal. */
  options: OptionKey[] | null;
}

/** A quote line's product name without the count in front of it. */
export const productName = (label: string) => label.replace(/^\s*\d+\s*×\s*/, "").trim();

type Lines = ProposalInternal["lines"];

function productsOf(lines: Lines): Omit<QuotedProduct, "options">[] {
  const out: Omit<QuotedProduct, "options">[] = [];
  for (const l of lines) {
    const kind = KIND_OF_GROUP[l.group];
    const sku = l.sku?.trim() ?? "";
    if (!kind || !sku) continue;
    out.push({ kind, sku, name: productName(l.label) || sku });
  }
  return out;
}

/**
 * The products a published version quotes, one a product (by kind and `codeKey`). Once accepted, only the system chosen.
 * With options, each product says which options it is in, so the page shows the sheets for the system on show. The
 * configurator's mixes (often hundreds) aren't split out: their products go with every view.
 */
export function quotedProducts(internal: ProposalInternal, accepted?: OptionKey | null): QuotedProduct[] {
  const found = new Map<string, QuotedProduct>();
  const add = (lines: Lines, option: OptionKey | null) => {
    for (const p of productsOf(lines)) {
      const key = `${p.kind}:${codeKey(p.sku)}`;
      const had = found.get(key);
      if (!had) found.set(key, { ...p, options: option === null ? null : [option] });
      else if (had.options && option !== null && !had.options.includes(option)) had.options.push(option);
      else if (option === null) had.options = null;
    }
  };
  if (accepted) {
    add(internalForChoice(internal, accepted).lines, null);
  } else if (internal.options?.length) {
    for (const o of internal.options) add(o.lines, o.goal);
  } else {
    add(internal.lines, null);
  }
  if (!accepted) for (const c of internal.configurator ?? []) add(c.lines, null);
  const order = (k: DocKind) => DOC_KINDS.indexOf(k);
  return [...found.values()].sort((a, b) => order(a.kind) - order(b.kind) || a.name.localeCompare(b.name));
}

/**
 * The id a customer's page asks for a sheet by: a short hash of the kind and the product code, so no code is sent and
 * the server finds the product again by working the same id out from the version's own products.
 */
export function datasheetId(kind: DocKind, sku: string): string {
  const text = `${kind}:${codeKey(sku)}`;
  // Two FNV-1a passes with different seeds: 16 hex characters, stable everywhere.
  const pass = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return pass(0x811c9dc5) + pass(0x01234567);
}

export const isDatasheetId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{16}$/.test(v);

/** A sheet as the customer's page is sent it: nothing but an id, what it is and the product's name. */
export interface ProposalDatasheet {
  id: string;
  kind: DocKind;
  name: string;
  /** The options it goes with; absent when it goes with every view. */
  options?: OptionKey[];
}

/** The products with a file on hand, as the customer is sent them. */
export function customerDatasheets(products: readonly QuotedProduct[], hasFile: (p: QuotedProduct) => boolean): ProposalDatasheet[] {
  return products
    .filter(hasFile)
    .map((p) => ({ id: datasheetId(p.kind, p.sku), kind: p.kind, name: p.name, ...(p.options ? { options: [...p.options] } : {}) }));
}

/** The sheets for the system on show. */
export const sheetsForChoice = (sheets: readonly ProposalDatasheet[], chosen: OptionKey | null) =>
  sheets.filter((s) => !s.options || (chosen !== null && s.options.includes(chosen)));

/** The product behind an id a customer's page asked for, or null for one this version doesn't quote. */
export const productForId = (products: readonly QuotedProduct[], id: string) =>
  products.find((p) => datasheetId(p.kind, p.sku) === id) ?? null;

/** A quoted product as the business's proposal screen shows it: whether its sheet will go with the proposal. */
export interface ProductSheetStanding {
  kind: DocKind;
  sku: string;
  name: string;
  hasFile: boolean;
  /** Found online and not yet checked by a person in the business. */
  unchecked: boolean;
}

export const DATASHEET_WORDS = {
  heading: "Product datasheets",
  intro: "The maker's datasheet for each product in this proposal.",
  open: "Open",
  missingSome: "The customer's page lists the datasheet of each product on file. These have none yet:",
  allThere: "Each product's datasheet goes with this proposal, on the customer's page.",
  find: "Find the missing ones online",
} as const;
