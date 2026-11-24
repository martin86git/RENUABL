import { describe, expect, it } from "vitest";
import { cleanExtras, editedLines, lineKey, type CostLine, type LineEdit } from "./quote";
import { typedCostFlags } from "./price-check";

const panels: CostLine = { group: "Panels", label: "15 × Panel", sku: "P-475", amount: 1500, qty: 15 };
const key = lineKey(panels);

describe("a cost each typed over a counted line", () => {
  it("is the line's cost for one: the total is that times how many", () => {
    expect(editedLines([panels], { [key]: { each: 125 } })[0]!.amount).toBe(1875);
  });

  it("follows a count typed over, and the design's own count", () => {
    expect(editedLines([panels], { [key]: { each: 125, qty: 4 } })[0]).toMatchObject({ qty: 4, amount: 500 });
    expect(editedLines([{ ...panels, qty: 20, amount: 2000 }], { [key]: { each: 125 } })[0]!.amount).toBe(2500);
  });

  it("settles a line with no cost on file", () => {
    const line = editedLines([{ ...panels, amount: 0, missing: true }], { [key]: { each: 90 } })[0]!;
    expect(line.amount).toBe(1350);
    expect(line.missing).toBeUndefined();
  });

  it("leaves a line with no count alone, and a whole line's cost typed before still wins", () => {
    const meter: CostLine = { group: "Electrical", label: "Meter", amount: 200 };
    expect(editedLines([meter], { [lineKey(meter)]: { each: 50 } })[0]!.amount).toBe(200);
    expect(editedLines([panels], { [key]: { each: 125, amount: 900 } })[0]!.amount).toBe(900);
  });

  it("is kept when a quote is cleaned, and checked against the price list", () => {
    const bill = { interval: "quarterly", amount: "", supplyPerDay: "1", rate: "0.3", feedIn: "0.05" } as const;
    const edits: Record<string, LineEdit> = { [key]: { each: 125.456 } };
    const kept = cleanExtras(
      {
        quotes: [
          { form: {}, edits },
          { form: {}, edits: { [key]: { each: -1 } } },
        ],
      },
      2,
      { bill, postcode: "3150" },
    );
    expect(kept.quotes[0]!.edits[key]).toEqual({ each: 125.46 });
    expect(kept.quotes[1]!.edits[key]).toBeUndefined();
    expect(typedCostFlags([panels], { [key]: { each: 125 } }, [])[key]).toContain("Typed $125 each; your price list has $100.");
    expect(typedCostFlags([panels], { [key]: { each: 101 } }, [])[key]).toBeUndefined();
  });
});
