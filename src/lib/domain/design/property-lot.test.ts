import { describe, expect, it } from "vitest";
import {
  lotDoubt,
  registerWarning,
  matchAddress,
  nearbyHomes,
  onPicture,
  streetParts,
  titleCase,
  type RegisteredAddress,
} from "./property-lot";

const spot = { lat: -37.8896, lng: 145.165 };
const reg = (n: number, dLat: number, lot: string, road = "HANWELL"): RegisteredAddress => ({
  text: `${n} ${road} COURT GLEN WAVERLEY 3150`,
  street: `${n} ${road} COURT`,
  suburb: "GLEN WAVERLEY",
  postcode: "3150",
  number: n,
  road,
  unit: null,
  lot,
  lat: spot.lat + dLat,
  lng: spot.lng,
});

describe("which house is the right one", () => {
  it("reads the number, road and unit as typed", () => {
    expect(streetParts("12 Hanwell Court, Glen Waverley VIC 3150")).toEqual({ unit: null, number: 12, road: "HANWELL" });
    expect(streetParts("3/12 Smith St, Rowville")).toEqual({ unit: 3, number: 12, road: "SMITH" });
    expect(streetParts("Hanwell Court")).toBeNull();
  });
  it("finds the typed address on the register, nearest first", () => {
    const list = [reg(10, 0.0002, "a"), reg(12, 0.0001, "b"), reg(12, 0.01, "c")];
    expect(matchAddress("12 Hanwell Ct, Glen Waverley", list, spot)?.lot).toBe("b");
    expect(matchAddress("15 Hanwell Ct, Glen Waverley", list, spot)).toBeNull();
  });
  it("offers the homes round about, one a lot, not the one outlined, nearest first", () => {
    const outlined = reg(12, 0, "b");
    const list = [outlined, reg(14, 0.0003, "c"), reg(10, 0.0001, "a"), { ...reg(10, 0.0001, "a"), text: "10A" }, reg(99, 0.01, "z")];
    const homes = nearbyHomes(list, spot, outlined);
    expect(homes.map((h) => h.line)).toEqual(["10 Hanwell Court", "14 Hanwell Court"]);
    expect(homes[0]).toMatchObject({ suburb: "Glen Waverley", postcode: "3150" });
  });
  it("puts places on the picture in metres east and south", () => {
    const p = onPicture({ lat: spot.lat - 0.0001, lng: spot.lng + 0.0001 }, spot);
    expect(p.y).toBeCloseTo(11.13, 1);
    expect(p.x).toBeGreaterThan(8);
  });
  it("writes the register's capitals as people do", () => {
    expect(titleCase("2 HANWELL COURT")).toBe("2 Hanwell Court");
    expect(titleCase("GLEN WAVERLEY")).toBe("Glen Waverley");
  });
  it("warns when the register has no such house number, naming it", () => {
    expect(registerWarning({ pinOnLot: true, registered: null }, "15 Hanwell Court, Glen Waverley, VIC, 3150")).toMatch(
      /^15 Hanwell Court isn't on Victoria's land register/,
    );
    expect(registerWarning({ pinOnLot: true, registered: "12 HANWELL COURT" }, "12 Hanwell Court")).toBeNull();
  });
  it("says when the register and Google disagree", () => {
    expect(lotDoubt({ pinOnLot: true, registered: "X" })).toBeNull();
    expect(lotDoubt({ pinOnLot: false, registered: "X" })).toMatch(/pin/);
    expect(lotDoubt({ pinOnLot: true, registered: null })).toMatch(/register/);
  });
});
