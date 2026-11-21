import { describe, expect, it } from "vitest";
import { editOf, editedLines, legacyLineKey, lineKey, withOwnKey, type CostLine, type LineEdit } from "./quote";

const big: CostLine = {
  group: "Inverters",
  label: "Sungrow 15kW Three Phase 3MPPT Hybrid Inverter",
  sku: "SGWSH15T",
  amount: 3999,
  qty: 1,
};
const small: CostLine = {
  group: "Inverters",
  label: "Sungrow 10kW Three Phase 2MPPT Hybrid Inverter",
  sku: "SGWSH10.0RT",
  amount: 2999,
  qty: 1,
};
const rails: CostLine = { group: "Racking", label: "Rails (23 lengths for 42 panels)", amount: 571, qty: 23 };

describe("a quote line's key", () => {
  it("tells two inverters of one family apart, where their older key was one", () => {
    expect(legacyLineKey(big)).toBe(legacyLineKey(small));
    expect(lineKey(big)).not.toBe(lineKey(small));
  });

  it("still follows a count in front of an inverter's name, and other lines as their figures change", () => {
    expect(lineKey({ group: "Inverters", label: "2 × Micro inverter IQ8" })).toBe(
      lineKey({ group: "Inverters", label: "14 × Micro inverter IQ8" }),
    );
    expect(lineKey(rails)).toBe(lineKey({ ...rails, label: "Rails (25 lengths for 46 panels)" }));
    expect(lineKey(rails)).toBe(legacyLineKey(rails));
  });

  it("takes one inverter out and leaves the other", () => {
    const left = editedLines([big, small], { [lineKey(small)]: { removed: true } });
    expect(left.map((l) => l.label)).toEqual([big.label]);
  });

  it("still reads a change kept under the older key", () => {
    const edits: Record<string, LineEdit> = { [legacyLineKey(big)]: { amount: 3500 } };
    expect(editOf(edits, big)).toEqual({ amount: 3500 });
    expect(editedLines([big], edits)[0]!.amount).toBe(3500);
  });

  it("moves an older change to each line's own key the first time one is changed", () => {
    const edits: Record<string, LineEdit> = { [legacyLineKey(big)]: { amount: 3500 } };
    const moved = withOwnKey(edits, small, [big, small, rails]);
    expect(moved[legacyLineKey(big)]).toBeUndefined();
    expect(moved[lineKey(big)]).toEqual({ amount: 3500 });
    expect(moved[lineKey(small)]).toEqual({ amount: 3500 });
    // Now taking the small one out leaves the big one's typed cost.
    const left = editedLines([big, small], { ...moved, [lineKey(small)]: { removed: true } });
    expect(left).toHaveLength(1);
    expect(left[0]!.amount).toBe(3500);
    // Nothing to move: the edits as given.
    expect(withOwnKey(moved, big, [big, small])).toBe(moved);
    expect(withOwnKey({}, rails, [rails])).toEqual({});
  });
});
