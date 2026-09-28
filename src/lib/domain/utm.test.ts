import { describe, expect, it } from "vitest";
import { toUtm, utmZoneFromEpsg } from "./utm";

describe("utm", () => {
  it("reads zones from EPSG codes", () => {
    expect(utmZoneFromEpsg(32755)).toEqual({ zone: 55, south: true });
    expect(utmZoneFromEpsg(32633)).toEqual({ zone: 33, south: false });
    expect(utmZoneFromEpsg(3857)).toBeNull();
  });

  it("projects Melbourne's CBD into zone 55 south", () => {
    // Reference values from proj4 (+proj=utm +zone=55 +south +datum=WGS84).
    const p = toUtm(-37.8136, 144.9631, { zone: 55, south: true });
    expect(p.e).toBeCloseTo(320_704.45, 1);
    expect(p.n).toBeCloseTo(5_812_911.7, 1);
  });

  it("keeps a metre a metre across a roof", () => {
    const z = { zone: 55, south: true };
    const a = toUtm(-37.8, 145.0, z);
    const b = toUtm(-37.8 + 10 / 111_000, 145.0, z);
    expect(Math.hypot(b.e - a.e, b.n - a.n)).toBeCloseTo(10, 0);
  });
});
