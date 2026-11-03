import { describe, expect, it } from "vitest";
import { SOL_PACKS, cleanSolPack, creditSource, includedThisMonth, monthOf, solBalance } from "./sol-credits";

describe("Sol credits", () => {
  it("brings 150 a paid user a month, 100 on an old trial, none without a plan", () => {
    expect(includedThisMonth({ status: "active", seats: 3 })).toBe(450);
    expect(includedThisMonth({ status: "past_due", seats: 1 })).toBe(150);
    expect(includedThisMonth({ status: "trialing", seats: 5 })).toBe(100);
    expect(includedThisMonth({ status: "canceled", seats: 5 })).toBe(0);
    expect(includedThisMonth(null)).toBe(0);
  });

  it("uses the month's credits first, then bought ones, then none", () => {
    expect(creditSource(solBalance(200, 10, 0))).toBe("included");
    expect(creditSource(solBalance(200, 200, 5))).toBe("bought");
    expect(creditSource(solBalance(200, 200, 0))).toBeNull();
    expect(solBalance(200, 150, 40).left).toBe(90);
    // A month whose plan shrank below what was used still never shows less than nothing.
    expect(solBalance(200, 260, 0).left).toBe(0);
  });

  it("sells only its own packs", () => {
    expect(cleanSolPack(250)).toEqual(SOL_PACKS[0]);
    expect(cleanSolPack("3000")?.cents).toBe(42900);
    expect(cleanSolPack(500)).toBeNull();
    expect(cleanSolPack(undefined)).toBeNull();
  });

  it("sells packs for more than they cost RENUABL", () => {
    // About US$0.04 a credit at list prices, about A$0.065; GST is a tenth of the price.
    for (const p of SOL_PACKS) expect(p.cents / 1.1 / p.credits / 6.5).toBeGreaterThan(1.9);
  });

  it("counts a credit in the market's month", () => {
    expect(monthOf("2026-11-30")).toBe("2026-11");
  });
});
