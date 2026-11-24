import { describe, expect, it } from "vitest";
import { cleanOwnerOnlyName } from "./account";

describe("cleanOwnerOnlyName", () => {
  it("keeps one plain line", () => {
    expect(cleanOwnerOnlyName("  Jo   Smith ")).toBe("Jo Smith");
    expect(cleanOwnerOnlyName("Jo\n<b>Smith</b>")).toBe("Jo b Smith /b");
  });
  it("refuses nothing typed", () => {
    expect(cleanOwnerOnlyName("   ")).toBeNull();
    expect(cleanOwnerOnlyName(42)).toBeNull();
  });
  it("is at most 80 characters", () => {
    expect(cleanOwnerOnlyName("a".repeat(200))?.length).toBe(80);
  });
});
