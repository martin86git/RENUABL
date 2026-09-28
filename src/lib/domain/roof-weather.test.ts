import { describe, expect, it } from "vitest";
import { facing, parseBuildingInsights, roofFit, roofSummary } from "./solar-roof";
import { customerOutlookLine, installOutlook, parseDailyForecast, type DayForecast } from "./weather";

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
    expect(roofSummary(r)).toBe("Room for about 32 panels · mostly north-facing · 22° pitch");
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
