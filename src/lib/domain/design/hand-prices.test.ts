import { describe, expect, it } from "vitest";
import { HAND_LIST, cleanHandPrice, handFirst, pricesWanted, withHandPrices } from "./hand-prices";
import { listed, type SupplierList } from "./pricing";

const list = (name: string, items: { sku: string; cost: number }[]): SupplierList => ({
  name,
  uploadedAt: "2026-11-01",
  items: items.map((i) => ({ ...i, name: i.sku })),
  panels: [],
  inverters: [],
  batteries: [],
});

describe("prices set by hand in the quote builder's cart", () => {
  it("asks for each line with no cost on file and a product code, once, named as the quote names it", () => {
    expect(
      pricesWanted([
        { label: "Rails (8 lengths for 14 panels)", sku: "ANTRAIL4800/B", missing: true },
        { label: "Rail splices (8)", sku: "ANTSPLICE", missing: true },
        { label: "14 × Jinko 475 W", sku: "JKM475", missing: true },
        { label: "Smart meter", sku: "SGW", missing: undefined },
        { label: "Cable allowance", missing: true },
        { label: "Rails again", sku: "ANTRAIL4800/B", missing: true },
      ]),
    ).toEqual([
      { sku: "ANTRAIL4800/B", name: "Rails" },
      { sku: "ANTSPLICE", name: "Rail splices" },
      { sku: "JKM475", name: "Jinko 475 W" },
    ]);
  });
  it("reads a typed price in dollars, and refuses nothing or nonsense", () => {
    expect(cleanHandPrice("$1,234.567")).toBe(1234.57);
    expect(cleanHandPrice("0")).toBeNull();
    expect(cleanHandPrice("abc")).toBeNull();
  });
  it("keeps them on a list of the business's own, first, so a price set by hand wins over an uploaded one", () => {
    const lists = [list("AWM.xlsx", [{ sku: "A", cost: 10 }])];
    const once = withHandPrices(lists, [{ sku: "A", name: "A", cost: 12 }], "2026-11-18");
    expect(once[0].name).toBe(HAND_LIST);
    expect(listed({ lists: once }, "A")?.cost).toBe(12);
    const twice = withHandPrices(
      once,
      [
        { sku: "B", name: "B", cost: 5 },
        { sku: "A", name: "A", cost: 14 },
      ],
      "2026-11-18",
    );
    expect(twice).toHaveLength(2);
    expect(twice[0].items.map((i) => `${i.sku}:${i.cost}`)).toEqual(["B:5", "A:14"]);
    expect(handFirst([lists[0], twice[0]])[0].name).toBe(HAND_LIST);
  });
});
