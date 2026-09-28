import { describe, expect, it } from "vitest";
import { directionOf, homeRoof, sunColour, sunOverlay, sunSummary, sunSummaryText } from "./sun-map";

describe("sun map", () => {
  it("keeps only the home's own roof, not the neighbour's", () => {
    // 10 × 4: the home's roof on the left, a gap, the neighbour's on the right.
    const w = 10;
    const mask = new Uint8Array(40);
    for (let y = 0; y < 4; y++) for (const x of [0, 1, 2, 3, 7, 8, 9]) mask[y * w + x] = 1;
    const roof = homeRoof(mask, w, 4, { x: 4.4, y: 1 }); // the address point just off the roof edge
    expect([...roof].filter(Boolean)).toHaveLength(16);
    expect(roof[1 * w + 8]).toBe(0);
  });

  it("colours from blue (little sun) to yellow (most)", () => {
    expect(sunColour(0)).toEqual([40, 48, 140]);
    expect(sunColour(1)).toEqual([255, 225, 70]);
    expect(sunColour(2)).toEqual([255, 225, 70]);
  });

  it("measures the shaded share of the roof and leaves the rest clear", () => {
    const flux = Float32Array.from([1400, 1400, 1400, 500, 0, 1400]);
    const roof = Uint8Array.from([1, 1, 1, 1, 0, 1]);
    const o = sunOverlay(flux, roof, 6, 1);
    expect(o.shadedShare).toBeCloseTo(0.2);
    expect(o.rgba[4 * 4 + 3]).toBe(0); // off the roof: transparent
    expect(o.rgba[0 * 4 + 3]).toBeGreaterThan(0);
    expect(o.box).toEqual([0, 0, 6, 1]);
  });

  it("sums sunny roof by direction and says it plainly", () => {
    const faces = [
      { azimuth: 5, pitch: 20, areaM2: 58, sunshineHours: 1500 },
      { azimuth: 95, pitch: 20, areaM2: 30, sunshineHours: 1200 },
      { azimuth: 270, pitch: 20, areaM2: 22, sunshineHours: 1150 },
      { azimuth: 185, pitch: 20, areaM2: 60, sunshineHours: 800 },
    ];
    const s = sunSummary({ faces }, 0.27);
    expect(s.sunnyByDirection).toEqual({ north: 58, east: 30, west: 22 });
    expect(sunSummaryText(s)).toEqual([
      "Most sun on the north-facing roof (about 60 m²), then east and west.",
      "About 25% of your roof is shaded or faces away from the sun.",
    ]);
    expect(directionOf(-30)).toBe("north");
  });
});
