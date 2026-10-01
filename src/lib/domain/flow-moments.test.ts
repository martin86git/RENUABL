import { describe, expect, it } from "vitest";
import { earliestInstallLine, flowMomentsText, pickedInstallLine, priceHeader, rebateReward } from "./flow-moments";

describe("flow moments", () => {
  it("rewards rebates only when there are some", () => {
    expect(rebateReward(0)).toBeNull();
    expect(rebateReward(4350)?.amount).toBe("$4,350");
  });

  it("names the earliest and the chosen install day", () => {
    expect(earliestInstallLine(undefined)).toBeNull();
    expect(earliestInstallLine("2026-10-21")).toBe("Your system could be installed as soon as Wednesday 21 October.");
    expect(pickedInstallLine("2026-10-21")).toMatch(/^Wednesday 21 October it is/);
  });

  it("shows the price after the rebates", () => {
    expect(priceHeader(4350)).toBe("Your price, after $4,350 in rebates");
    expect(priceHeader(0)).toBe("Your price");
  });

  it("makes no promises it can't keep", () => {
    expect(flowMomentsText()).not.toMatch(/guarantee|exact|precise|installer\b|will be installed/i);
  });
});
