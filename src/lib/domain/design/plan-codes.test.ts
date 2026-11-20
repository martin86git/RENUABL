import { describe, expect, it } from "vitest";
import { cleanCodeLength, cleanPlanCode, codeWords, freeForGood, lengthWords } from "./plan-codes";

describe("plan codes", () => {
  it("takes a code as typed, in capitals, and refuses what can't be one", () => {
    expect(cleanPlanCode("  primero-free ")).toBe("PRIMERO-FREE");
    expect(cleanPlanCode("ab")).toBeNull();
    expect(cleanPlanCode("has space")).toBeNull();
    expect(cleanPlanCode("x".repeat(31))).toBeNull();
    expect(cleanPlanCode(42)).toBeNull();
  });

  it("offers a month, a few months or for good, and nothing else", () => {
    expect(cleanCodeLength(1)).toEqual({ months: 1 });
    expect(cleanCodeLength("2")).toEqual({ months: 2 });
    expect(cleanCodeLength("forever")).toBe("forever");
    expect(cleanCodeLength(5)).toBeNull();
    expect(lengthWords({ months: 2 })).toBe("First 2 months free");
  });

  it("says what a code gives", () => {
    expect(codeWords({ percentOff: 100, duration: "once", months: null })).toBe("First month free");
    expect(codeWords({ percentOff: 100, duration: "repeating", months: 2 })).toBe("First 2 months free");
    expect(codeWords({ percentOff: 100, duration: "forever", months: null })).toBe("Free for good");
    expect(codeWords({ percentOff: 50, duration: "repeating", months: 3 })).toBe("50% off for 3 months");
    expect(freeForGood({ percentOff: 100, duration: "forever", months: null })).toBe(true);
    expect(freeForGood({ percentOff: 100, duration: "repeating", months: 2 })).toBe(false);
  });
});
