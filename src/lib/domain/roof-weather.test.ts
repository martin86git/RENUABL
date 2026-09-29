import { describe, expect, it } from "vitest";
import {
  facing,
  isThisHome,
  metresBetween,
  metresFromBuilding,
  parseBuildingInsights,
  roofFit,
  roofPanelLimit,
  roofSummary,
  usableRoofSunHours,
} from "./solar-roof";
import { blendedYieldPerKw } from "./sunshine";
import { customerOutlookLine, installOutlook, parseDailyForecast, solarDayOutlook, type DayForecast } from "./weather";

// Shaped like Google's documented buildingInsights:findClosest response (trimmed).
const insights = {
  name: "buildings/ChIJ-test",
  center: { latitude: -37.88, longitude: 145.16 },
  imageryDate: { year: 2025, month: 3, day: 14 },
  imageryQuality: "HIGH",
  solarPotential: {
    maxArrayPanelsCount: 40,
    maxArrayAreaMeters2: 72.5,
    maxSunshineHoursPerYear: 1650.4,
    panelCapacityWatts: 400,
    roofSegmentStats: [
      { pitchDegrees: 21.6, azimuthDegrees: 176.2, stats: { areaMeters2: 30.1, sunshineQuantiles: [900, 1000, 1100, 1200, 1300] } },
      { pitchDegrees: 22.1, azimuthDegrees: 355.9, stats: { areaMeters2: 48.3, sunshineQuantiles: [1200, 1400, 1550, 1600, 1650] } },
      { pitchDegrees: 5, azimuthDegrees: 90, stats: { areaMeters2: 2.1 } },
    ],
  },
};

describe("Google Solar roof", () => {
  it("reads the faces, largest first, and how many of our panels fit", () => {
    const r = parseBuildingInsights(insights)!;
    expect(r.faces).toEqual([
      { azimuth: 356, pitch: 22, areaM2: 48, sunshineHours: 1550 },
      { azimuth: 176, pitch: 22, areaM2: 30, sunshineHours: 1100 },
    ]);
    // 72.5 m² × 90% ÷ (1.762 × 1.134 m) = 32.6
    expect(r.panelsThatFit).toBe(32);
    expect(r).toMatchObject({ usableAreaM2: 73, sunshineHoursPerYear: 1650, imageryDate: "2025-03", imageryQuality: "HIGH" });
    expect(roofSummary(r)).toBe("Mostly north-facing · 22° pitch");
  });

  it("says whether the system fits", () => {
    const r = parseBuildingInsights(insights)!;
    expect(roofFit(r, 20)).toBe("comfortable");
    expect(roofFit(r, 30)).toBe("snug");
    expect(roofFit(r, 40)).toBe("check");
  });

  it("names directions and ignores unusable responses", () => {
    expect(facing(0)).toBe("North-facing");
    expect(facing(290)).toBe("West-facing");
    expect(facing(-45)).toBe("North-west-facing");
    expect(parseBuildingInsights({ solarPotential: {} })).toBeNull();
    expect(parseBuildingInsights(null)).toBeNull();
  });
});

// Shaped like Google's documented forecast/days:lookup response (trimmed).
const forecast = {
  forecastDays: [
    {
      displayDate: { year: 2026, month: 10, day: 12 },
      daytimeForecast: {
        weatherCondition: { description: { text: "Sunny", languageCode: "en" }, type: "CLEAR" },
        precipitation: { probability: { percent: 5, type: "RAIN" }, qpf: { quantity: 0, unit: "MILLIMETERS" } },
        thunderstormProbability: 0,
        wind: { speed: { value: 14, unit: "KILOMETERS_PER_HOUR" }, gust: { value: 24, unit: "KILOMETERS_PER_HOUR" } },
      },
      maxTemperature: { degrees: 23.4, unit: "CELSIUS" },
      minTemperature: { degrees: 11.1, unit: "CELSIUS" },
    },
    {
      displayDate: { year: 2026, month: 10, day: 13 },
      daytimeForecast: {
        weatherCondition: { description: { text: "Rain and wind" } },
        precipitation: { probability: { percent: 80 }, qpf: { quantity: 9.5 } },
        thunderstormProbability: 10,
        wind: { speed: { value: 35 }, gust: { value: 62 } },
      },
      maxTemperature: { degrees: 16 },
      minTemperature: { degrees: 9 },
    },
  ],
};

describe("Google Weather install day", () => {
  it("reads daily forecasts", () => {
    const days = parseDailyForecast(forecast);
    expect(days[0]).toEqual({
      date: "2026-10-12",
      summary: "Sunny",
      rainChance: 5,
      rainMm: 0,
      thunderChance: 0,
      maxC: 23.4,
      minC: 11.1,
      windKmh: 14,
      gustKmh: 24,
      cloudCover: null,
    });
    expect(parseDailyForecast({})).toEqual([]);
  });

  it("calls the day for roof work", () => {
    const [sunny, wet] = parseDailyForecast(forecast);
    expect(installOutlook(sunny)).toEqual({ outlook: "good", reasons: [] });
    expect(installOutlook(wet)).toEqual({ outlook: "risky", reasons: ["rain likely", "gusts to 62 km/h"] });
    const breezy: DayForecast = { ...sunny, rainChance: 40, gustKmh: 40, maxC: 39 };
    expect(installOutlook(breezy)).toEqual({ outlook: "watch", reasons: ["chance of showers", "gusty (40 km/h)", "hot (39°)"] });
  });

  it("tells customers calmly", () => {
    const [sunny, wet] = parseDailyForecast(forecast);
    expect(customerOutlookLine(sunny)).toBe("Sunny, 23°. Looks good for your installation.");
    expect(customerOutlookLine(wet)).toMatch(/installation partner will call to move the day/);
    expect(customerOutlookLine(wet)).not.toMatch(/installer\b/);
  });
});

describe("sharper savings from Google's roof sunshine", () => {
  it("blends roof sun-hours (60%) with NASA (40%), within a sensible range", () => {
    const nasa = { annual: 4.2 }; // kWh/m²/day → 4.2 × 1.08 × 0.8 = 3.63 kWh/kW/day
    expect(blendedYieldPerKw(nasa, null)).toBe(3.63);
    // 1,600 sun hours ÷ 365 × 0.8 = 3.51 → 3.51 × 0.6 + 3.63 × 0.4 = 3.56
    expect(blendedYieldPerKw(nasa, 1600)).toBe(3.56);
    // A heavily shaded reading is held at 60% of NASA's: 2.18 × 0.6 + 3.63 × 0.4 = 2.76
    expect(blendedYieldPerKw(nasa, 400)).toBe(2.76);
    expect(blendedYieldPerKw(null, 1600)).toBe(3.51);
    expect(blendedYieldPerKw(null, null)).toBeNull();
  });

  it("uses the sunny parts of the roof", () => {
    const r = parseBuildingInsights(insights)!;
    // Both faces get at least 70% of the best (1,100 ≥ 1,085): area-weighted (1,550 × 48 + 1,100 × 30) ÷ 78 = 1,377.
    expect(usableRoofSunHours(r)).toBe(1377);
    // A face in shade (under 70% of the best) is left out.
    expect(usableRoofSunHours({ ...r, faces: [r.faces[0], { ...r.faces[1], sunshineHours: 900 }] })).toBe(1550);
  });
});

describe("tomorrow's solar day", () => {
  const base: DayForecast = {
    date: "2026-10-01",
    summary: "Sunny",
    rainChance: 5,
    rainMm: 0,
    thunderChance: 0,
    maxC: 24,
    minC: 12,
    windKmh: 10,
    gustKmh: 20,
    cloudCover: 10,
  };
  it("gives a plain heads-up and a tip", () => {
    expect(solarDayOutlook(base, { battery: false, ev: false })).toMatchObject({
      day: "strong",
      headline: "Tomorrow looks sunny: expect a strong solar day.",
    });
    expect(solarDayOutlook(base, { battery: false, ev: true }).tip).toMatch(/charge the car/);
    expect(solarDayOutlook({ ...base, summary: "Partly cloudy", cloudCover: 60 }, { battery: true, ev: false }).day).toBe("fair");
    const wet = solarDayOutlook({ ...base, summary: "Rain", cloudCover: 95, rainChance: 90 }, { battery: true, ev: false });
    expect(wet).toMatchObject({ day: "quiet" });
    expect(wet.tip).toMatch(/battery/);
  });
});

describe("the home's own roof", () => {
  const home = { lat: -37.8791, lng: 145.1647 };
  it("keeps Google's matched building centre", () => {
    const r = parseBuildingInsights({
      center: { latitude: -37.8792, longitude: 145.1648 },
      solarPotential: { maxArrayAreaMeters2: 40, roofSegmentStats: [] },
    });
    expect(r?.center).toEqual({ lat: -37.8792, lng: 145.1648 });
  });

  it("trusts a building near the address and turns away one next door or further", () => {
    expect(isThisHome({ center: { lat: home.lat + 0.0001, lng: home.lng } }, home.lat, home.lng)).toBe(true); // ~11 m
    expect(isThisHome({ center: { lat: home.lat + 0.0004, lng: home.lng } }, home.lat, home.lng)).toBe(false); // ~45 m
    expect(isThisHome({}, home.lat, home.lng)).toBe(true);
    expect(metresBetween(home, { lat: home.lat, lng: home.lng + 0.001 })).toBeCloseTo(87.9, 0);
  });

  it("with an outline box, the address must be on the building or within a front yard of it", () => {
    const box = { sw: { lat: home.lat - 0.0001, lng: home.lng - 0.0001 }, ne: { lat: home.lat + 0.0001, lng: home.lng + 0.0001 } };
    expect(metresFromBuilding(box, home)).toBe(0);
    expect(isThisHome({ box }, home.lat - 0.00017, home.lng)).toBe(true); // ~8 m in front
    expect(isThisHome({ box }, home.lat - 0.00025, home.lng)).toBe(false); // ~17 m: the next building over
    const r = parseBuildingInsights({
      boundingBox: { sw: { latitude: -37.88, longitude: 145.16 }, ne: { latitude: -37.879, longitude: 145.161 } },
      solarPotential: { maxArrayAreaMeters2: 40 },
    });
    expect(r?.box).toEqual({ sw: { lat: -37.88, lng: 145.16 }, ne: { lat: -37.879, lng: 145.161 } });
  });

  it("never recommends more panels than the roof data says fit, nor fewer than the minimum system", () => {
    expect(roofPanelLimit(31, 20, 11)).toBe(20);
    expect(roofPanelLimit(31, 8, 11)).toBe(11);
    expect(roofPanelLimit(31, null, 11)).toBe(31);
    expect(roofPanelLimit(31, 60, 11)).toBe(31);
  });
});
