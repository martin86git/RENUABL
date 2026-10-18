import { describe, expect, it } from "vitest";
import type { MaterialLine } from "./deal";
import {
  EMPTY_ORDER,
  bySupplier,
  cleanOrder,
  itemKey,
  offersFor,
  orderCsv,
  orderItems,
  orderTotals,
  purchaseOrderEmail,
  type OrderState,
} from "./orders";
import { DEFAULT_PREFS, cleanPrefs, rankedLists } from "./prefs";
import type { SupplierList } from "./pricing";

const materials: MaterialLine[] = [
  { group: "Panels", item: "Jinko 475 W", sku: "JKM475", qty: 18 },
  { group: "Racking", item: "Rails (10 lengths for 18 panels)", sku: "RAIL48", qty: 10 },
  { group: "Racking", item: "Rail splices (10)", sku: "SPLICE", qty: 10 },
  { group: "Racking", item: "Roof kits (tile, 4)", sku: "TILE2", qty: 4 },
  { group: "Racking", item: "Roof kits (tin, 1)", sku: "TILE2", qty: 1 },
  { group: "Electrical", item: "Cable, conduit, labels and sundries (allowance)", sku: "", qty: 1 },
];
const list = (name: string, rows: [string, number][]): SupplierList => ({
  name,
  uploadedAt: "2026-10-01",
  items: rows.map(([sku, cost]) => ({ sku, name: sku, cost })),
  panels: [],
  inverters: [],
  batteries: [],
});
const lists = [
  list("Cheap Co", [
    ["JKM475", 150],
    ["RAIL48", 50],
  ]),
  list("AWM", [
    ["JKM475", 160],
    ["RAIL48", 55],
    ["SPLICE", 8],
  ]),
];
const prefs = cleanPrefs({ supplierRank: ["AWM"], suppliers: { AWM: { label: "AWM Clayton", email: "orders@example.com" } } });
const offers = offersFor(
  lists,
  prefs,
  materials.map((m) => m.sku),
);

describe("the Ordering Station", () => {
  it("orders what was sold, puts duplicates together and leaves allowances off", () => {
    const items = orderItems(materials, EMPTY_ORDER, offers);
    expect(items.map((i) => [i.sku, i.qty])).toEqual([
      ["JKM475", 18],
      ["RAIL48", 10],
      ["SPLICE", 10],
      ["TILE2", 5],
    ]);
  });

  it("buys from the preferred supplier, unless one is chosen by hand", () => {
    const items = orderItems(materials, EMPTY_ORDER, offers);
    expect(items[0]).toMatchObject({ list: "AWM", supplier: "AWM Clayton", each: 160 });
    const chosen = orderItems(materials, { ...EMPTY_ORDER, supplier: { [itemKey(materials[0])]: "Cheap Co" } }, offers);
    expect(chosen[0]).toMatchObject({ list: "Cheap Co", each: 150 });
    expect(items[3]).toMatchObject({ list: null, each: null });
  });

  it("lays hand changes over the sale: a quantity, a product taken off, one added", () => {
    const order: OrderState = {
      ...EMPTY_ORDER,
      qty: { [itemKey(materials[1])]: 12, [itemKey(materials[2])]: 0 },
      added: [{ key: "sku:MC4", item: "MC4 pairs", sku: "MC4", qty: 10 }],
      ticked: [itemKey(materials[0])],
    };
    const items = orderItems(materials, order, offers);
    expect(items.find((i) => i.sku === "RAIL48")).toMatchObject({ qty: 12, worked: 10 });
    expect(items.find((i) => i.sku === "SPLICE")?.off).toBe(true);
    expect(items.find((i) => i.sku === "MC4")).toMatchObject({ group: "Added", worked: null, qty: 10 });
    const totals = orderTotals(items);
    expect(totals).toMatchObject({ lines: 4, ticked: 1, unpriced: 2 });
    expect(totals.cost).toBe(18 * 160 + 12 * 55);
    expect(bySupplier(items).map((g) => g.supplier)).toEqual(["AWM Clayton", null]);
  });

  it("stamps the status move with the server's time and member, never the browser's", () => {
    const sent = cleanOrder({ status: "ordered", orderedAt: "1999-01-01", orderedBy: "x@y.z" }, EMPTY_ORDER, "me@biz.com", "now");
    expect(sent).toMatchObject({ status: "ordered", orderedAt: "now", orderedBy: "me@biz.com", deliveredAt: null });
    const later = cleanOrder({ status: "delivered" }, sent, "other@biz.com", "later");
    expect(later).toMatchObject({ orderedAt: "now", orderedBy: "me@biz.com", deliveredAt: "later" });
    expect(cleanOrder({ status: "open" }, later, "me", "t")).toMatchObject({ orderedAt: null, deliveredAt: null });
  });

  it("keeps only sensible input", () => {
    const o = cleanOrder(
      { status: "lost", qty: { a: -1, b: 3.4, c: "x" }, wanted: "next week", added: [{ item: "", qty: 2 }] },
      EMPTY_ORDER,
      "m",
      "t",
    );
    expect(o).toMatchObject({ status: "open", qty: { b: 3 }, wanted: "", added: [] });
  });

  it("writes a purchase order with no prices, under the business's name", () => {
    const items = orderItems(materials, EMPTY_ORDER, offers);
    const po = purchaseOrderEmail({
      business: "Sunny Co",
      reference: "PO-1",
      address: "1 Sample St",
      wanted: "Thursday 23 October 2026",
      deliverTo: "",
      notes: "Call on arrival <b>",
      intro: "Hi,",
      items,
    });
    expect(po.subject).toBe("Sunny Co | Purchase order PO-1 | 1 Sample St");
    expect(po.text).toContain("18 × Jinko 475 W (JKM475)");
    expect(po.text).not.toMatch(/\$|160/);
    expect(po.html).toContain("&lt;b&gt;");
  });

  it("guards spreadsheet cells against formulas", () => {
    const items = orderItems([{ group: "Racking", item: "=HYPERLINK(1)", sku: "", qty: 1 }], EMPTY_ORDER, {});
    expect(orderCsv(items)).toContain(`"'=HYPERLINK(1)"`);
  });
});

describe("a business's after-sale settings", () => {
  it("falls back to the defaults, with every automation off", () => {
    expect(cleanPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(cleanPrefs({ invoiceTolerance: -5, reminderDaysBefore: 4, automations: { installReminders: "yes" } })).toEqual(DEFAULT_PREFS);
  });

  it("keeps a supplier's email only when it is one", () => {
    const p = cleanPrefs({ suppliers: { AWM: { label: "AWM", email: "not an email" }, B: { email: "b@b.com.au" } } });
    expect(p.suppliers).toEqual({ AWM: { label: "AWM", email: "" }, B: { label: "", email: "b@b.com.au" } });
  });

  it("puts the preferred lists first", () => {
    expect(rankedLists({ ...DEFAULT_PREFS, supplierRank: ["B", "gone"] }, ["A", "B", "C"])).toEqual(["B", "A", "C"]);
  });
});
