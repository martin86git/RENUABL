/**
 * The news at the product level (10 Nov 2026, Martin: recalls, approved-list changes, makers leaving, new models,
 * makers' notices and supplier price moves, "all of the above is useful"). Sol's stories name the exact models they are
 * about (`models`) and, for a new model, those it replaces (`replaces`), beside the makers (`brands`). For each business
 * a story is set against its own price lists and against the systems on its sold and installed deals, so it can say
 * "this battery is in 2 of your customers' systems" instead of only that a battery was recalled. A story naming models
 * matches by model alone (a recall of one model isn't every product of its maker); a story naming only makers (a maker
 * leaving Australia) matches by maker. Price moves come from the business's own lists: a new list against the prices it
 * had before. Pure, tested.
 */
import type { NewsItem, NewsTopic } from "./industry-news";
import { namesMaker } from "./industry-news";

/** A product's code and name, as on a price list or a deal. */
export interface WatchedProduct {
  sku: string;
  name: string;
}

/** A sold or installed deal and the products in its system (models as the design, the as-built or the deal says). */
export interface JobKit {
  jobId: string;
  customer: string;
  installed: boolean;
  products: string[];
}

const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Whether a product (its name and code together) is this model: the model's letters and digits, run together, are in
 * the product's. A model has to be specific to count: at least five characters with a digit ("SE5000H"), or eight
 * without ("POWERWALL" alone is too loose; "Powerwall 3" is fine).
 */
export function namesModel(product: string, model: string): boolean {
  const m = key(model);
  if (m.length < 5 || (!/\d/.test(m) && m.length < 8)) return false;
  return key(product).includes(m);
}

/** How a product meets a story: by one of its models, by one of its makers (only when it names no model), or not. */
export function meets(product: string, story: Pick<NewsItem, "brands" | "models">): "model" | "maker" | null {
  const models = story.models ?? [];
  if (models.length) return models.some((m) => namesModel(product, m)) ? "model" : null;
  return story.brands.some((b) => namesMaker(product, b)) ? "maker" : null;
}

/** What a story means for one business's price lists: the products it names, and the ones a new model replaces. */
export interface ListMatch {
  by: "model" | "maker";
  makers: string[];
  count: number;
  examples: string[];
  /** Products on the lists that the story's new model replaces. */
  replaced: string[];
}

export function onTheLists(story: Pick<NewsItem, "brands" | "models" | "replaces">, products: readonly WatchedProduct[]): ListMatch | null {
  const hit = new Map<string, string>();
  let by: "model" | "maker" | null = null;
  const replaced = new Map<string, string>();
  for (const p of products) {
    const text = `${p.name} ${p.sku}`;
    const how = meets(text, story);
    if (how && !hit.has(p.sku)) {
      hit.set(p.sku, p.name || p.sku);
      by = how;
    }
    if ((story.replaces ?? []).some((m) => namesModel(text, m)) && !replaced.has(p.sku)) replaced.set(p.sku, p.name || p.sku);
  }
  if (!hit.size && !replaced.size) return null;
  return {
    by: by ?? "model",
    makers: story.brands.filter((b) => [...hit.values()].some((n) => namesMaker(n, b))),
    count: hit.size,
    examples: [...hit.values()].slice(0, 3),
    replaced: [...replaced.values()].slice(0, 3),
  };
}

/** What a story means for the business's customers: the sold and installed deals whose systems it names. */
export interface SystemsMatch {
  by: "model" | "maker";
  installed: number;
  sold: number;
  /** Up to `SYSTEMS_SHOWN` of them, installed first, to open. */
  deals: { jobId: string; customer: string; installed: boolean }[];
}

export const SYSTEMS_SHOWN = 5;

export function inTheirSystems(story: Pick<NewsItem, "brands" | "models">, jobs: readonly JobKit[]): SystemsMatch | null {
  const found: { jobId: string; customer: string; installed: boolean; by: "model" | "maker" }[] = [];
  for (const j of jobs) {
    const how = j.products.map((p) => meets(p, story)).find(Boolean);
    if (how) found.push({ jobId: j.jobId, customer: j.customer, installed: j.installed, by: how });
  }
  if (!found.length) return null;
  found.sort((a, b) => Number(b.installed) - Number(a.installed));
  return {
    by: found[0].by,
    installed: found.filter((f) => f.installed).length,
    sold: found.filter((f) => !f.installed).length,
    deals: found.slice(0, SYSTEMS_SHOWN).map(({ jobId, customer, installed }) => ({ jobId, customer, installed })),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "In 2 installed systems and 1 sold job", by the model named or by its maker. */
export function systemsWords(m: SystemsMatch): string {
  const parts = [m.installed && plural(m.installed, "installed system"), m.sold && plural(m.sold, "sold job")].filter(Boolean);
  return `${m.by === "model" ? "This model is in" : "This maker is in"} ${parts.join(" and ")} of yours`;
}

/** "2 products on your price lists", "This model is on your price lists", "Replaces … on your price lists". */
export function listWords(m: ListMatch): string {
  if (!m.count) return `Replaces ${m.replaced.join(", ")} on your price lists`;
  if (m.by === "model") return m.count === 1 ? "This model is on your price lists" : `${m.count} of these models are on your price lists`;
  return `${plural(m.count, `${m.makers.join(" and ") || "matching"} product`)} on your price lists`;
}

/** Stories that ask a business to act when they touch its customers' systems or its lists. */
export const ACT_ON_TOPICS: readonly NewsTopic[] = ["recalls", "listings", "companies", "notices"];

/** Whether a story touches this business enough to be marked "Needs a look". */
export function needsALook(item: Pick<NewsItem, "topic">, systems: SystemsMatch | null, lists: ListMatch | null): boolean {
  if (!ACT_ON_TOPICS.includes(item.topic)) return false;
  if (systems) return true;
  // A story about a model on the lists (a recall, a delisting) matters before it is sold; a maker on the lists only for a company story.
  return Boolean(lists && lists.count && (lists.by === "model" || item.topic === "companies"));
}

// ---------------------------------------------------------------------------
// Supplier price moves
// ---------------------------------------------------------------------------

/** A move this large (share of the old cost) or more is reported; smaller ones are noise. */
export const PRICE_MOVE_SHARE = 0.03;
/** And at least this many dollars. */
export const PRICE_MOVE_MIN = 1;
/** The largest moves shown on the card. */
export const PRICE_MOVES_SHOWN = 6;

export interface PriceMove {
  sku: string;
  name: string;
  was: number;
  now: number;
}

/** What changed when a price list was saved, against the prices the business had before. */
export interface PriceMoves {
  list: string;
  up: number;
  down: number;
  /** Products on it with no earlier price. */
  added: number;
  /** The biggest moves by share, largest first. */
  biggest: PriceMove[];
}

/**
 * A new price list against the business's earlier prices (`before`: the lists as they were, newest first, so a code on
 * several takes the newest). Null when there was nothing earlier to compare with (a first list), or nothing moved.
 */
export function priceMoves(
  list: { name: string; items: readonly { sku: string; name: string; cost: number }[] },
  before: readonly { items: readonly { sku: string; cost: number }[] }[],
): PriceMoves | null {
  const was = new Map<string, number>();
  for (const l of before) for (const i of l.items) if (i.cost > 0 && !was.has(key(i.sku))) was.set(key(i.sku), i.cost);
  if (!was.size) return null;
  const moves: PriceMove[] = [];
  let added = 0;
  const seen = new Set<string>();
  for (const i of list.items) {
    const k = key(i.sku);
    if (!k || seen.has(k) || !(i.cost > 0)) continue;
    seen.add(k);
    const old = was.get(k);
    if (old === undefined) {
      added++;
      continue;
    }
    const diff = i.cost - old;
    if (Math.abs(diff) >= PRICE_MOVE_MIN && Math.abs(diff) / old >= PRICE_MOVE_SHARE)
      moves.push({ sku: i.sku, name: i.name || i.sku, was: old, now: i.cost });
  }
  if (!moves.length) return null;
  const share = (m: PriceMove) => Math.abs(m.now - m.was) / m.was;
  return {
    list: list.name,
    up: moves.filter((m) => m.now > m.was).length,
    down: moves.filter((m) => m.now < m.was).length,
    added,
    biggest: [...moves].sort((a, b) => share(b) - share(a)).slice(0, PRICE_MOVES_SHOWN),
  };
}

/** A price move as the News tab shows it: when it was kept. */
export interface PriceMovesNote {
  id: string;
  at: string;
  moves: PriceMoves;
}

/** "Prices moved on AWM November.xlsx: 12 up, 3 down." */
export function priceMovesWords(m: PriceMoves): string {
  const parts = [m.up && `${m.up} up`, m.down && `${m.down} down`].filter(Boolean).join(", ");
  return `Prices moved on ${m.list}: ${parts}.`;
}

/** "+12%" or "−4%", whole per cent (one place under 10%). */
export function moveShare(m: PriceMove): string {
  const pct = ((m.now - m.was) / m.was) * 100;
  const shown = Math.abs(pct) < 10 ? Math.round(Math.abs(pct) * 10) / 10 : Math.round(Math.abs(pct));
  return `${pct >= 0 ? "+" : "−"}${shown}%`;
}
