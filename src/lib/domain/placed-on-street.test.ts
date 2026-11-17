import { describe, expect, it } from "vitest";
import { onStreetWords, placedOnStreet } from "./address";

describe("an address Google only placed on its street", () => {
  it("is on the street when the place is the street itself", () => {
    expect(placedOnStreet({ types: ["route"] })).toBe(true);
  });
  it("is on the street when the point was worked out along the street's numbers", () => {
    expect(placedOnStreet({ types: ["street_address"], locationType: "RANGE_INTERPOLATED" })).toBe(true);
    expect(placedOnStreet({ locationType: "GEOMETRIC_CENTER" })).toBe(true);
  });
  it("is a home when found on the building, or when nothing more is known", () => {
    expect(placedOnStreet({ types: ["street_address"], locationType: "ROOFTOP" })).toBe(false);
    expect(placedOnStreet({ types: ["premise"] })).toBe(false);
    expect(placedOnStreet({})).toBe(false);
  });
  it("says which address and what to check", () => {
    expect(onStreetWords({ line: "15 Hanwell Court", suburb: "Glen Waverley" })).toMatch(/15 Hanwell Court, Glen Waverley.*house number/);
  });
});
