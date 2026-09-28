import { describe, expect, it } from "vitest";
import { roofViewUrl } from "./roof-view";

describe("roof view", () => {
  const home = { line: "2 Hanwell Court", suburb: "Glen Waverley", state: "VIC", postcode: "3150" };

  it("centres a 2x satellite image on the home's coordinates", () => {
    const u = new URL(roofViewUrl({ ...home, lat: -37.8812345678, lng: 145.1623 }, "wide", "k")!);
    expect(u.origin + u.pathname).toBe("https://maps.googleapis.com/maps/api/staticmap");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      center: "-37.881235,145.162300",
      maptype: "satellite",
      zoom: "20",
      size: "640x360",
      scale: "2",
      key: "k",
    });
  });

  it("uses the address without coordinates, and needs a key", () => {
    expect(new URL(roofViewUrl(home, "thumb", "k")!).searchParams.get("center")).toBe("2 Hanwell Court, Glen Waverley, VIC, 3150");
    expect(roofViewUrl(home, "thumb", "")).toBeNull();
  });
});
