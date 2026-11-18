import { describe, expect, it } from "vitest";
import { addedLines, lineKey, cleanExtras, editedLines, MARGIN_KEY, marginOf, quoteTotals, type Costing, type LineEdit } from "./quote";

const costing: Costing = {
  panels: 10,
  pvKw: 4.75,
  batteryKwh: 0,
  lines: [{ group: "Panels", label: "10 × Panel", amount: 1000, qty: 10 }],
  hardware: 1000,
  install: 0,
  commission: 0,
  cost: 1000,
  margin: 500,
  priceExGst: 1500,
  priceIncGst: 1650,
  missing: 0,
};

describe("the margin typed over, and lines of the business's own", () => {
  it("leaves the quote as worked out with no hand changes", () => {
    const t = quoteTotals(costing, {});
    expect(t.margin).toBe(500);
    expect(t.priceIncGst).toBe(1650);
  });

  it("prices with a margin typed over", () => {
    const edits: Record<string, LineEdit> = { [MARGIN_KEY]: { amount: 800 } };
    expect(marginOf(costing, edits)).toBe(800);
    const t = quoteTotals(costing, edits);
    expect(t.cost).toBe(1000);
    expect(t.priceExGst).toBe(1800);
    expect(t.priceIncGst).toBe(1980);
  });

  it("adds a line of its own at the cost each times how many", () => {
    const edits: Record<string, LineEdit> = { "added|abc": { label: "Trenching", group: "Installation", qty: 3, amount: 50 } };
    expect(addedLines(edits)).toEqual([{ key: "added|abc", group: "Installation", label: "Trenching", qty: 3, amount: 150 }]);
    expect(editedLines(costing.lines, edits)).toHaveLength(2);
    const t = quoteTotals(costing, edits);
    expect(t.cost).toBe(1150);
    expect(t.priceExGst).toBe(1650);
  });

  it("keeps both through the cleaner, and drops what isn't one", () => {
    const raw = {
      quotes: [
        {
          form: {},
          edits: {
            [MARGIN_KEY]: { amount: 900.4 },
            "added|x1": { label: "  Extra   isolator ", group: "Electrical", qty: 2, amount: 80 },
            "added|x2": { label: "", amount: 10 },
            "added|bad key!": { label: "Sneaky", amount: 10 },
            "added|x3": { label: "No group", group: "Nonsense", qty: -4, amount: -5 },
          },
        },
      ],
    };
    const bill = { interval: "quarterly", amount: "", supplyPerDay: "1", rate: "0.3", feedIn: "0.05" } as const;
    const out = cleanExtras(raw, 1, { bill, postcode: "3150" }).quotes[0].edits;
    expect(out[MARGIN_KEY]).toEqual({ amount: 900.4 });
    expect(out["added|x1"]).toEqual({ label: "Extra isolator", group: "Electrical", qty: 2, amount: 80 });
    expect(out["added|x2"]).toBeUndefined();
    expect(out["added|bad key!"]).toBeUndefined();
    expect(out["added|x3"]).toEqual({ label: "No group", group: "Installation", qty: 1, amount: 0 });
  });
  it("prices the solar installation again at a rate typed over its cents a watt, and keeps the rate", () => {
    const line = { group: "Installation" as const, label: "Solar installation: 6.65 kW at 30c a watt", amount: 1995, watts: 6650 };
    const out = editedLines([line], { [lineKey(line)]: { rate: 0.35 } })[0];
    expect(out.amount).toBe(2327.5);
    expect(out.label).toBe("Solar installation: 6.65 kW at 35c a watt");
    const raw = { quotes: [{ form: {}, edits: { [lineKey(line)]: { rate: 0.35 }, "Installation|x": { rate: 99 } } }] };
    const bill = { interval: "quarterly", amount: "", supplyPerDay: "1", rate: "0.3", feedIn: "0.05" } as const;
    const kept = cleanExtras(raw, 1, { bill, postcode: "3150" }).quotes[0].edits;
    expect(kept[lineKey(line)]).toEqual({ rate: 0.35 });
    expect(kept["Installation|x"]).toBeUndefined();
  });
});
