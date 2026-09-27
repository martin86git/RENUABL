import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBatteryFactors, parseBatteryTaper, parseDeeming, parseSolarVictoria } from "./rebate-parsing";
import { parseNasaClimatology, yieldPerKw } from "./sunshine";
import { VERIFIED_RATES } from "./rebates";

// Plain text of the real pages, saved 27 September 2026.
const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}.txt`, import.meta.url), "utf8");

describe("reading the CER and Solar Victoria pages", () => {
  it("reads the deeming years", () => {
    expect(parseDeeming(fixture("cer-entitlements"))).toMatchObject({ "2025": 6, "2026": 5, "2030": 1 });
  });

  it("reads the battery STC factors by period, matching the verified copy", () => {
    const factors = parseBatteryFactors(fixture("cer-batteries"))!;
    expect(factors.find((p) => p.from === "2026-05-01")).toEqual({ from: "2026-05-01", to: "2026-12-31", factor: 6.8 });
    for (const p of VERIFIED_RATES.stc.batteryFactors) expect(factors).toContainEqual(p);
  });

  it("reads the battery taper", () => {
    expect(parseBatteryTaper(fixture("cer-batteries"))).toEqual(VERIFIED_RATES.stc.batteryTaper);
  });

  it("reads Solar Victoria's rebate, loan and 50% cap", () => {
    expect(parseSolarVictoria(fixture("solar-vic-pv"))).toEqual({ pvRebateMax: 1400, pvLoanMax: 1400, pvRebateShare: 0.5 });
  });

  it("gives up (so the verified copy is used) when a page changes shape", () => {
    expect(parseDeeming("nothing here")).toBeNull();
    expect(parseBatteryFactors("2026 May – December 99")).toBeNull();
    expect(parseSolarVictoria("Rebates are closed.")).toBeNull();
  });
});

describe("NASA sunshine", () => {
  it("parses NASA POWER and turns it into panel output", () => {
    const months = {
      JAN: 7.17,
      FEB: 6.26,
      MAR: 5.04,
      APR: 3.48,
      MAY: 2.29,
      JUN: 1.79,
      JUL: 1.94,
      AUG: 2.71,
      SEP: 3.91,
      OCT: 5.31,
      NOV: 6.32,
      DEC: 7.05,
    };
    const sun = parseNasaClimatology({ properties: { parameter: { ALLSKY_SFC_SW_DWN: { ...months, ANN: 4.43 } } } }, -37.88, 145.16)!;
    expect(sun.annual).toBe(4.43);
    expect(sun.monthly[5]).toBe(1.79);
    expect(yieldPerKw(sun)).toBeCloseTo(3.83, 2);
    expect(parseNasaClimatology({ properties: { parameter: { ALLSKY_SFC_SW_DWN: { ...months, ANN: -999 } } } }, 0, 0)).toBeNull();
  });
});
