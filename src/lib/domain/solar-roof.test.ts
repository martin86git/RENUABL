import { describe, expect, it } from "vitest";
import { isUnitAddress } from "./solar-roof";

describe("isUnitAddress", () => {
  it("spots units, apartments and townhouses", () => {
    expect(isUnitAddress("1/112 Leopold Street")).toBe(true);
    expect(isUnitAddress("3A / 20 Smith St")).toBe(true);
    expect(isUnitAddress("Unit 4, 9 High St")).toBe(true);
    expect(isUnitAddress("Apt 12 5 Collins St")).toBe(true);
  });
  it("leaves houses alone", () => {
    expect(isUnitAddress("112 Leopold Street")).toBe(false);
    expect(isUnitAddress("12 Unity Avenue")).toBe(false);
    expect(isUnitAddress(undefined)).toBe(false);
  });
});
