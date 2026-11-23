import { describe, expect, it } from "vitest";
import { MARGIN_KEY, sharedHome, withHomeOf, type QuoteFields } from "./quote";

const form = { phase: "single", roof: "tile", storeys: "single", postcode: "3150" } as QuoteFields["form"];
const q = (edits: QuoteFields["edits"]): QuoteFields => ({ form, edits });

describe("prices typed on one design hold on the others", () => {
  it("shares the cost each, a rate, a whole cost and a line left at $0", () => {
    const from = q({
      "Panels|Jinko #W": { each: 128 },
      "Installation|Solar installation at #c a watt": { rate: 0.32 },
      "Electrical|Meter": { amount: 250, whole: true },
      "Racking|Rail #m": { amount: 0 },
    });
    const to = withHomeOf(from, q({ "Panels|Jinko #W": { qty: 9 } }));
    expect(to.edits["Panels|Jinko #W"]).toEqual({ qty: 9, each: 128 });
    expect(to.edits["Installation|Solar installation at #c a watt"]).toEqual({ rate: 0.32 });
    expect(to.edits["Electrical|Meter"]).toEqual({ amount: 250, whole: true });
    expect(to.edits["Racking|Rail #m"]).toEqual({ amount: 0 });
  });

  it("replaces the other design's own price for the same line", () => {
    const to = withHomeOf(q({ "Panels|Jinko #W": { each: 128 } }), q({ "Panels|Jinko #W": { each: 99, qty: 9 } }));
    expect(to.edits["Panels|Jinko #W"]).toEqual({ qty: 9, each: 128 });
  });

  it("leaves a line taken out, a design's own choice, the margin, added lines and old whole-line costs", () => {
    const from = q({
      "Panels|Jinko #W": { each: 128 },
      "Battery|Sig #": { amount: 4200 },
      [MARGIN_KEY]: { amount: 3000 },
      "added|abc": { label: "Travel", group: "Installation", qty: 1, amount: 90 },
    });
    const to = withHomeOf(from, q({ "Panels|Jinko #W": { removed: true } }));
    expect(to.edits["Panels|Jinko #W"]).toEqual({ removed: true });
    expect(to.edits["Battery|Sig #"]).toBeUndefined();
    expect(to.edits[MARGIN_KEY]).toBeUndefined();
    expect(to.edits["added|abc"]).toBeUndefined();
  });

  it("is applied to every design from the one worked on", () => {
    const list = sharedHome([q({ "Panels|Jinko #W": { each: 128 } }), q({}), q({})], 0);
    expect(list.map((x) => x.edits["Panels|Jinko #W"]?.each)).toEqual([128, 128, 128]);
  });
});
