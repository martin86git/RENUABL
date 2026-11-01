import { describe, expect, it } from "vitest";
import { SOL_PACKS, cleanSolPack, creditSource, includedThisMonth, monthOf, solBalance } from "./sol-credits";

describe("Sol credits", () => {
  it("brings 200 a paid user a month, 100 on the trial, none without a plan", () => {
    expect(includedThisMonth({ status: "active", seats: 3 })).toBe(600);
    expect(includedThisMonth({ status: "past_due", seats: 1 })).toBe(200);
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
    expect(cleanSolPack(500)).toEqual(SOL_PACKS[0]);
    expect(cleanSolPack("2500")?.cents).toBe(10000);
    expect(cleanSolPack(501)).toBeNull();
    expect(cleanSolPack(undefined)).toBeNull();
  });

  it("counts a credit in the market's month", () => {
    expect(monthOf("2026-11-30")).toBe("2026-11");
  });
});
