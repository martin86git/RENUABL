import { describe, expect, it } from "vitest";
import { homeFor, sameHome, streetLine } from "./same-home";

const deal = { address: "28 Shearer Drive Rowville VIC 3178", lat: -37.9261, lng: 145.2401 };
// About 18 m away: where another map put the same address.
const drawn = { address: "28 Shearer Dr, Rowville VIC 3178, Australia", lat: -37.92625, lng: 145.24025 };

describe("same home", () => {
  it("reads one street line however it is written", () => {
    expect(streetLine("28 Shearer Drive, Rowville VIC 3178")).toBe("28 shearer dr");
    expect(streetLine("28 shearer dr rowville")).toBe("28 shearer dr");
    expect(streetLine("Rowville VIC")).toBeNull();
  });

  it("joins a deal to a design drawn close by at the same address", () => {
    expect(sameHome(deal, drawn)).toBe(true);
    expect(homeFor(deal, [drawn])).toBe(drawn);
  });

  it("keeps the house next door apart", () => {
    const next = { ...drawn, address: "30 Shearer Drive, Rowville VIC 3178" };
    expect(sameHome(deal, next)).toBe(false);
  });

  it("never joins the same address far away", () => {
    expect(sameHome(deal, { ...drawn, lat: -37.93 })).toBe(false);
  });

  it("joins points within a few metres whatever the words", () => {
    expect(sameHome(deal, { address: "", lat: deal.lat + 0.00002, lng: deal.lng })).toBe(true);
  });
});
