import { describe, expect, it } from "vitest";
import { billFieldsFromFile, billWith, nearestInterval, usageFromAmount } from "./design-bill";
import type { BillFields } from "./quote";

const box: BillFields = { interval: "quarterly", amount: "", supplyPerDay: "1.00", rate: "0.30", feedIn: "0.05" };

describe("the bill box in kWh as well as dollars", () => {
  it("works the dollars out from kWh at the rate plus the supply charge", () => {
    const b = billWith(box, { usage: "1000" });
    expect(b.usage).toBe("1000");
    expect(b.amount).toBe(String(Math.round(1000 * 0.3 + 1 * (365 / 4))));
  });
  it("clears the kWh when dollars are typed", () => {
    const b = billWith(billWith(box, { usage: "1000" }), { amount: "400" });
    expect(b.usage).toBeUndefined();
    expect(b.amount).toBe("400");
  });
  it("works the dollars out again when the rate changes while kWh was typed", () => {
    const b = billWith(billWith(box, { usage: "1000" }), { rate: "0.40" });
    expect(b.amount).toBe(String(Math.round(400 + 365 / 4)));
  });
  it("emptying the kWh empties the amount it made", () => {
    expect(billWith(billWith(box, { usage: "1000" }), { usage: "" }).amount).toBe("");
  });
  it("hints the kWh a dollar bill comes to", () => {
    expect(usageFromAmount({ ...box, amount: String(300 + 365 / 4) })).toBe(1000);
    expect(usageFromAmount(box)).toBeNull();
  });
});

describe("Sol's find in the customer's file", () => {
  it("puts kWh over a stated period in, scaled to the nearest bill", () => {
    const r = billFieldsFromFile(
      { found: true, usageKwh: 1200, periodDays: 365 / 4, quote: "we used 1200 kWh last quarter", source: "Note" },
      box,
    );
    expect(r.ok && r.fields.usage).toBe("1200");
    expect(r.ok && r.fields.interval).toBe("quarterly");
    expect(r.ok && r.notes[0]).toContain("1200 kWh");
  });
  it("takes a daily figure over the box's interval", () => {
    const r = billFieldsFromFile({ found: true, dailyKwh: 20 }, box);
    expect(r.ok && r.fields.usage).toBe(String(Math.round(20 * (365 / 4))));
  });
  it("falls back to a bill in dollars, saying kWh is better", () => {
    const r = billFieldsFromFile({ found: true, billAmount: 600, billPeriodDays: 365 / 6 }, box);
    expect(r.ok && r.fields.interval).toBe("bimonthly");
    expect(r.ok && r.fields.amount).toBe("600");
    expect(r.ok && r.notes.join(" ")).toContain("kWh is better");
  });
  it("leaves the box alone when nothing is found", () => {
    expect(billFieldsFromFile({ found: false }, box).ok).toBe(false);
    expect(billFieldsFromFile({ found: true }, box).ok).toBe(false);
  });
  it("finds the nearest bill interval", () => {
    expect(nearestInterval(30)).toBe("monthly");
    expect(nearestInterval(365)).toBe("annual");
  });
});
