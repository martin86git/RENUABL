import { describe, expect, it } from "vitest";
import { pickupSlip, referenceLine, suburbOf, type PickupSlipInput } from "./pickup-slip";

const input: PickupSlipInput = {
  business: "Sunny Co",
  reference: "PO-ABC123",
  installDate: "2026-10-19",
  address: "1/8 Sample St, Kilsyth VIC 3137",
  installer: "Amped Electrical",
  orderedAt: "2026-10-12T03:04:05.000Z",
  groups: [
    {
      supplier: "AWM Clayton",
      so: " OSW923342 ",
      items: [
        { qty: 13, item: "Jinko 475 W panel", sku: "JKM475" },
        { qty: 8, item: "Rails, 4.8 m", sku: "RAIL" },
      ],
    },
    { supplier: "Empty Ltd", so: "", items: [] },
    { supplier: null, so: "", items: [{ qty: 4, item: "Roof kits, tile", sku: "TILE20" }] },
  ],
};

describe("the pickup slip", () => {
  const slip = pickupSlip(input);

  it("is one page a wholesaler, with our PO, their SO and every item to collect", () => {
    expect(slip.reference).toBe("PO-ABC123");
    expect(slip.pages).toEqual([
      {
        wholesaler: "AWM Clayton",
        so: "OSW923342",
        items: input.groups[0].items,
        units: 21,
      },
    ]);
    expect(slip.orderedOn).toBe("2026-10-12");
  });

  it("lists what no wholesaler has been set for apart, on no wholesaler's page", () => {
    expect(slip.unsourced).toEqual([{ qty: 4, item: "Roof kits, tile", sku: "TILE20" }]);
  });

  it("names only the suburb, never the street or the customer", () => {
    expect(slip.suburb).toBe("Kilsyth VIC 3137");
    expect(JSON.stringify(slip)).not.toMatch(/Sample St/);
    expect(suburbOf("8 Example Court, Glen Waverley VIC 3150, Australia")).toBe("Glen Waverley VIC 3150");
    expect(suburbOf("8 Example Court, Glen Waverley, VIC, 3150")).toBe("Glen Waverley VIC 3150");
    expect(suburbOf("8 Example Court")).toBe("");
    expect(suburbOf("Glen Waverley, VIC, 3150")).toBe("");
  });

  it("gives the calendar both references", () => {
    expect(referenceLine("PO-ABC123", "OSW923342")).toBe("PO-ABC123 · SO OSW923342");
    expect(referenceLine("PO-ABC123", "")).toBe("PO-ABC123 · SO number not entered yet");
    expect(referenceLine("4471", "")).toBe("PO 4471 · SO number not entered yet");
  });
});
