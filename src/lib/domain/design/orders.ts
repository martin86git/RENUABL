/**
 * The Ordering Station: a signed job's order for its hardware, from the
 * exact lines its proposal was sold with (panels, inverters, battery, rails,
 * splices, roof brackets, the electrical parts), grouped by the supplier to
 * buy each from. Only what someone changes by hand is kept (a quantity, a
 * product taken off or added, a supplier chosen, a line ticked as ordered);
 * the worked-out quantities always come from the sale. Pure, tested.
 */
import type { CostGroup } from "./quote";
import type { MaterialLine } from "./deal";
import type { SupplierList } from "./pricing";
import { rankedLists, supplierLabel, type BusinessPrefs } from "./prefs";

export const ORDER_STATUSES = ["open", "ordered", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = { open: "To order", ordered: "Ordered", delivered: "Delivered" };

/** A product added to an order by hand. */
export interface AddedItem {
  key: string;
  item: string;
  sku: string;
  qty: number;
}

/** What is kept of a job's order: the hand changes and the order's own details. */
export interface OrderState {
  status: OrderStatus;
  reference: string;
  deliverTo: string;
  /** When it is wanted by, YYYY-MM-DD, or "". */
  wanted: string;
  notes: string;
  /** Quantities set by hand, by item key; 0 takes the item off. */
  qty: Record<string, number>;
  added: AddedItem[];
  /** Item keys ticked as ordered. */
  ticked: string[];
  /** The supplier (price list name) chosen by hand, by item key. */
  supplier: Record<string, string>;
  orderedAt: string | null;
  orderedBy: string | null;
  deliveredAt: string | null;
}

export const EMPTY_ORDER: OrderState = {
  status: "open",
  reference: "",
  deliverTo: "",
  wanted: "",
  notes: "",
  qty: {},
  added: [],
  ticked: [],
  supplier: {},
  orderedAt: null,
  orderedBy: null,
  deliveredAt: null,
};

export const MAX_ADDED = 40;
const MAX_QTY = 10_000;

/** One supplier's price for a product, ex GST. */
export interface Offer {
  list: string;
  supplier: string;
  each: number;
}

export interface OrderItem {
  key: string;
  group: CostGroup | "Added";
  item: string;
  sku: string;
  /** How many the sale worked out, or null for a product added by hand. */
  worked: number | null;
  qty: number;
  off: boolean;
  ticked: boolean;
  /** The price list it is bought from, or null when no list carries it. */
  list: string | null;
  supplier: string | null;
  /** Each, ex GST, from that list; null when unpriced. */
  each: number | null;
  offers: Offer[];
}

/** A product's key on the order: its code, else its group and name. */
export function itemKey(line: Pick<MaterialLine, "sku" | "item" | "group">): string {
  return line.sku ? `sku:${line.sku.toUpperCase()}` : `${line.group}:${line.item}`.toLowerCase();
}

/** Every list's price for each code, the business's preferred list first. */
export function offersFor(lists: readonly SupplierList[], prefs: BusinessPrefs, skus: readonly string[]): Record<string, Offer[]> {
  const order = rankedLists(
    prefs,
    lists.map((l) => l.name),
  );
  const out: Record<string, Offer[]> = {};
  const wanted = new Set(skus.map((s) => s.toUpperCase()));
  for (const name of order) {
    const list = lists.find((l) => l.name === name);
    if (!list) continue;
    const rows = [...list.items, ...list.panels, ...list.inverters, ...list.batteries];
    for (const sku of wanted) {
      const row = rows.find((r) => r.sku.toUpperCase() === sku);
      if (row && !(out[sku] ?? []).some((o) => o.list === name))
        (out[sku] ??= []).push({ list: name, supplier: supplierLabel(prefs, name), each: row.cost });
    }
  }
  return out;
}

/** An allowance (cable, sundries) is bought as needed, not ordered. */
const isAllowance = (l: MaterialLine) => !l.sku && /allowance/i.test(l.item);

/**
 * The order's items: the sale's hardware with duplicates put together, the
 * hand changes laid over it, and the products added by hand, each with the
 * supplier it is bought from (chosen by hand, else the preferred list that
 * carries it) and that supplier's price.
 */
export function orderItems(materials: readonly MaterialLine[], order: OrderState, offers: Record<string, Offer[]>): OrderItem[] {
  const merged = new Map<string, { line: MaterialLine; qty: number }>();
  for (const line of materials) {
    if (isAllowance(line)) continue;
    const key = itemKey(line);
    const had = merged.get(key);
    if (had) had.qty += line.qty;
    else merged.set(key, { line, qty: line.qty });
  }
  const priced = (key: string, sku: string) => {
    const options = sku ? (offers[sku.toUpperCase()] ?? []) : [];
    const chosen = options.find((o) => o.list === order.supplier[key]) ?? options[0] ?? null;
    return { offers: options, list: chosen?.list ?? null, supplier: chosen?.supplier ?? null, each: chosen?.each ?? null };
  };
  const items: OrderItem[] = [...merged.entries()].map(([key, { line, qty: worked }]) => {
    const qty = order.qty[key] ?? worked;
    return {
      key,
      group: line.group,
      item: line.item,
      sku: line.sku,
      worked,
      qty,
      off: qty === 0,
      ticked: order.ticked.includes(key),
      ...priced(key, line.sku),
    };
  });
  for (const a of order.added) {
    if (merged.has(a.key)) continue;
    const qty = order.qty[a.key] ?? a.qty;
    items.push({
      key: a.key,
      group: "Added",
      item: a.item,
      sku: a.sku,
      worked: null,
      qty,
      off: qty === 0,
      ticked: order.ticked.includes(a.key),
      ...priced(a.key, a.sku),
    });
  }
  return items;
}

export interface OrderTotals {
  lines: number;
  ticked: number;
  /** Ex GST, of what is priced. */
  cost: number;
  unpriced: number;
}

export function orderTotals(items: readonly OrderItem[]): OrderTotals {
  const on = items.filter((i) => !i.off);
  return {
    lines: on.length,
    ticked: on.filter((i) => i.ticked).length,
    cost: Math.round(on.reduce((s, i) => s + (i.each ?? 0) * i.qty, 0) * 100) / 100,
    unpriced: on.filter((i) => i.each === null).length,
  };
}

/** The items on the order (not taken off), by the supplier each is bought from; those no list carries last. */
export function bySupplier(items: readonly OrderItem[]): { list: string | null; supplier: string | null; items: OrderItem[] }[] {
  const groups: { list: string | null; supplier: string | null; items: OrderItem[] }[] = [];
  for (const item of items) {
    if (item.off) continue;
    let g = groups.find((x) => x.list === item.list);
    if (!g) groups.push((g = { list: item.list, supplier: item.supplier, items: [] }));
    g.items.push(item);
  }
  return groups.sort((a, b) => Number(a.list === null) - Number(b.list === null));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";
const count = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= MAX_QTY ? n : null;
};

/**
 * What the browser sent, as an order to keep: only known fields, in range.
 * The stamps (when it was marked ordered and by whom, when delivered) are
 * the server's, set the first time the status moves on, never the browser's.
 */
export function cleanOrder(raw: unknown, before: OrderState, by: string, now: string): OrderState {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status = ORDER_STATUSES.includes(r.status as OrderStatus) ? (r.status as OrderStatus) : before.status;
  const qty: Record<string, number> = {};
  if (r.qty && typeof r.qty === "object")
    for (const [k, v] of Object.entries(r.qty as Record<string, unknown>).slice(0, 200)) {
      const n = count(v);
      if (n !== null && k.length <= 160) qty[k] = n;
    }
  const added: AddedItem[] = [];
  if (Array.isArray(r.added))
    for (const a of r.added.slice(0, MAX_ADDED)) {
      if (!a || typeof a !== "object") continue;
      const v = a as Record<string, unknown>;
      const item = line(v.item, 120);
      const sku = line(v.sku, 60);
      const n = count(v.qty);
      if (!item || n === null) continue;
      const key = itemKey({ sku, item, group: "Added" as CostGroup });
      if (!added.some((x) => x.key === key)) added.push({ key, item, sku, qty: Math.max(1, n) });
    }
  const ticked = Array.isArray(r.ticked)
    ? [...new Set(r.ticked.filter((k): k is string => typeof k === "string" && k.length <= 160))].slice(0, 300)
    : [];
  const supplier: Record<string, string> = {};
  if (r.supplier && typeof r.supplier === "object")
    for (const [k, v] of Object.entries(r.supplier as Record<string, unknown>).slice(0, 200)) {
      const name = line(v, 120);
      if (name && k.length <= 160) supplier[k] = name;
    }
  const wanted = line(r.wanted, 10);
  const moved = status !== "open" && before.status === "open";
  return {
    status,
    reference: line(r.reference, 40),
    deliverTo: line(r.deliverTo, 200),
    wanted: DATE.test(wanted) ? wanted : "",
    notes: typeof r.notes === "string" ? r.notes.replace(/\r/g, "").slice(0, 1000) : "",
    qty,
    added,
    ticked,
    supplier,
    orderedAt: status === "open" ? null : moved || !before.orderedAt ? now : before.orderedAt,
    orderedBy: status === "open" ? null : moved || !before.orderedBy ? by : before.orderedBy,
    deliveredAt: status === "delivered" ? (before.deliveredAt ?? now) : null,
  };
}

/** A kept order read back: whatever is missing is the empty order's. */
export function readOrder(raw: unknown): OrderState {
  const r = raw && typeof raw === "object" ? (raw as Partial<OrderState>) : {};
  return { ...EMPTY_ORDER, ...r };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A purchase order to one supplier: the codes, products and how many, and
 * never a price (the supplier has its own). It is the business's order,
 * under its name; a reply goes to the member who sent it.
 */
export function purchaseOrderEmail(input: {
  business: string;
  reference: string;
  address: string;
  /** Long date, or null when not set. */
  wanted: string | null;
  deliverTo: string;
  notes: string;
  intro: string;
  items: readonly Pick<OrderItem, "sku" | "item" | "qty">[];
}): { subject: string; text: string; html: string } {
  const subject = `${input.business} | Purchase order ${input.reference} | ${input.address || "address to follow"}`;
  const details = [
    `Purchase order: ${input.reference}`,
    `Job: ${input.address || "to follow"}`,
    `Wanted by: ${input.wanted ?? "to be confirmed"}`,
    ...(input.deliverTo ? [`Deliver to: ${input.deliverTo}`] : []),
  ];
  const rows = input.items.map((i) => `${i.qty} × ${i.item}${i.sku ? ` (${i.sku})` : ""}`);
  const text = [
    input.intro,
    "",
    ...details,
    "",
    ...rows,
    ...(input.notes ? ["", `Notes: ${input.notes}`] : []),
    "",
    `Thank you,\n${input.business}`,
  ].join("\n");
  const td = 'style="padding:6px 10px;border-bottom:1px solid #e5e5e5;font:14px Arial,sans-serif"';
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#111">
<p>${esc(input.intro).replace(/\n/g, "<br>")}</p>
<p>${details.map(esc).join("<br>")}</p>
<table style="border-collapse:collapse;margin:12px 0"><tr><th ${td} align="left">Code</th><th ${td} align="left">Product</th><th ${td} align="right">Qty</th></tr>
${input.items.map((i) => `<tr><td ${td}>${esc(i.sku || "—")}</td><td ${td}>${esc(i.item)}</td><td ${td} align="right">${i.qty}</td></tr>`).join("\n")}
</table>
${input.notes ? `<p>Notes: ${esc(input.notes).replace(/\n/g, "<br>")}</p>` : ""}
<p>Thank you,<br>${esc(input.business)}</p></div>`;
  return { subject, text, html };
}

export const DEFAULT_PO_INTRO = "Hi,\n\nPlease find our purchase order below.";

/** The order as a spreadsheet file, with each supplier and price, for the business's own records. */
export function orderCsv(items: readonly OrderItem[]): string {
  // A cell starting with = + - @ would run as a formula in a spreadsheet: it is quoted as text.
  const cell = (v: string | number) => {
    const s = String(v);
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return [
    ["Supplier", "Group", "Product", "Code", "Qty", "Each ex GST", "Total ex GST", "Ordered"],
    ...items
      .filter((i) => !i.off)
      .map((i) => [
        i.supplier ?? "",
        i.group,
        i.item,
        i.sku,
        i.qty,
        i.each ?? "",
        i.each === null ? "" : Math.round(i.each * i.qty * 100) / 100,
        i.ticked ? "yes" : "",
      ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
