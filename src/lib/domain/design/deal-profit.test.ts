import { describe, expect, it } from "vitest";
import { dealProfit, marginWords } from "./deal-profit";

describe("dealProfit", () => {
  it("takes commission out of cost for the gross margin", () => {
    const p = dealProfit({
      priceExGst: 10000,
      cost: 7600,
      margin: 2400,
      lines: [
        { group: "Panels", label: "Panels", amount: 4000 },
        { group: "Installation", label: "Install", amount: 3000 },
        { group: "Commission", label: "Commission", amount: 600 },
      ],
    });
    expect(p.commission).toBe(600);
    expect(p.grossMargin).toBe(3000);
    expect(p.grossShare).toBeCloseTo(0.3);
    expect(p.afterCommission).toBe(2400);
    expect(marginWords(p)).toBe("$3,000 · 30%");
  });

  it("has no share without a price", () => {
    const p = dealProfit({ priceExGst: 0, cost: 0, margin: 0, lines: [] });
    expect(p.grossShare).toBeNull();
    expect(p.commission).toBe(0);
  });
});
