import { describe, expect, it } from "vitest";
import {
  DAY_STEPS,
  USE_SHAPE,
  clockAheadOfSun,
  clockWords,
  dayWords,
  homeDay,
  momentWords,
  shareOfUseAt,
  type HomeDayInput,
} from "./home-day";

const north = { kw: 0.475, tilt: 22, facing: 0 };
const base: HomeDayInput = {
  latitude: -37.8,
  month: 0,
  panels: Array.from({ length: 14 }, () => north),
  dayKwh: 36,
  homeDayKwh: 20,
  batteryKwh: 0,
};
const near = (a: number, b: number, by = 0.15) => Math.abs(a - b) <= by;

describe("the home's use through a day", () => {
  it("adds up to the day's use", () => {
    let total = 0;
    for (let i = 0; i < DAY_STEPS; i++) total += shareOfUseAt((i + 0.5) / 2) / 2;
    expect(total).toBeCloseTo(1, 2);
  });

  it("peaks in the evening and is lowest in the small hours", () => {
    expect(shareOfUseAt(19)).toBeGreaterThan(shareOfUseAt(13));
    expect(shareOfUseAt(13)).toBeGreaterThan(shareOfUseAt(3));
  });

  it("puts about six tenths outside 7am to 5pm, as the savings rules do", () => {
    const all = USE_SHAPE.reduce((a, b) => a + b, 0);
    const dark = USE_SHAPE.reduce((sum, v, hour) => sum + (hour < 7 || hour >= 17 ? v : 0), 0) / all;
    expect(dark).toBeGreaterThan(0.55);
    expect(dark).toBeLessThan(0.65);
  });
});

describe("the clock and the sun", () => {
  it("runs an hour further ahead in daylight saving", () => {
    expect(clockAheadOfSun(0) - clockAheadOfSun(5)).toBe(1);
    expect(clockAheadOfSun(9)).toBe(clockAheadOfSun(2));
  });

  it("says a clock hour in words", () => {
    expect(clockWords(6.5)).toBe("6:30 am");
    expect(clockWords(12)).toBe("12 noon");
    expect(clockWords(19)).toBe("7 pm");
    expect(clockWords(0.25)).toBe("12:15 am");
    expect(clockWords(23.99)).toBe("midnight");
  });
});

describe("a design's day", () => {
  it("makes what the designer says the design makes that day, with nothing in the sun's way", () => {
    const day = homeDay(base);
    expect(near(day.solarKwh, 36)).toBe(true);
    expect(day.shadeLoss).toBe(0);
  });

  it("makes nothing at night and the most about the middle of the day", () => {
    const day = homeDay(base);
    expect(day.steps[4].solar).toBe(0);
    expect(day.steps[4].sun.elevation).toBeLessThan(0);
    const peak = day.steps.reduce((a, s) => (s.solar > a.solar ? s : a));
    // Solar noon is about 1:20 pm on a summer clock.
    expect(peak.hour).toBeGreaterThan(12);
    expect(peak.hour).toBeLessThan(14.6);
  });

  it("accounts for every kWh: the sun's goes to the home, the battery or the grid, and the home's comes from one of the three", () => {
    const day = homeDay({ ...base, batteryKwh: 9 });
    for (const s of day.steps) {
      expect(s.direct + s.charge + s.exported).toBeCloseTo(s.solar, 6);
      expect(s.direct + s.discharge + s.imported).toBeCloseTo(s.use, 6);
      expect(s.level).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeLessThanOrEqual(9 + 1e-9);
    }
    expect(near(day.useKwh, 20)).toBe(true);
  });

  it("carries more of the evening with a battery than without", () => {
    const without = homeDay(base);
    const withOne = homeDay({ ...base, batteryKwh: 9 });
    expect(without.fromBatteryKwh).toBe(0);
    expect(withOne.importedKwh).toBeLessThan(without.importedKwh - 5);
    expect(withOne.exportedKwh).toBeLessThan(without.exportedKwh);
    expect(withOne.fullAt).not.toBeNull();
  });

  it("starts the day with what the day before left in the battery", () => {
    // A battery bigger than the night: something is still in it at midnight.
    const day = homeDay({ ...base, batteryKwh: 30 });
    expect(day.steps[0].level).toBeGreaterThan(1);
    expect(day.emptyAt).toBeNull();
  });

  it("says when a small battery runs out after dark", () => {
    const day = homeDay({ ...base, batteryKwh: 4 });
    expect(day.emptyAt).not.toBeNull();
    // Out some time in the evening or night, not in the middle of the day.
    expect(day.emptyAt! > 17 || day.emptyAt! < 8).toBe(true);
  });

  it("has a shorter, weaker day in winter", () => {
    const summer = homeDay(base);
    const winter = homeDay({ ...base, month: 5, dayKwh: 12 });
    expect(near(winter.solarKwh, 12)).toBe(true);
    expect(winter.lastLight! - winter.firstLight!).toBeLessThan(summer.lastLight! - summer.firstLight!);
  });

  it("lights an east panel before a west one", () => {
    const day = homeDay({
      ...base,
      panels: [
        { kw: 0.475, tilt: 22, facing: 90 },
        { kw: 0.475, tilt: 22, facing: 270 },
      ],
    });
    const morning = day.steps.find((s) => s.hour > 9)!;
    const evening = day.steps.find((s) => s.hour > 17.5)!;
    expect(morning.glow[0]).toBeGreaterThan(morning.glow[1]);
    expect(evening.glow[1]).toBeGreaterThan(evening.glow[0]);
  });

  it("loses what shade takes, and says how much", () => {
    // Everything east of north is blocked: the mornings are lost.
    const day = homeDay({ ...base, shaded: (_, sun) => sun.azimuth > 0 && sun.azimuth < 180 });
    expect(day.solarKwh).toBeLessThan(30);
    expect(day.shadeLoss).toBeGreaterThan(0.2);
    const morning = day.steps.find((s) => s.hour > 9)!;
    expect(morning.glow[0]).toBeLessThan(0.2);
  });

  it("still has a day with no panels, and with no bill", () => {
    const bare = homeDay({ ...base, panels: [], dayKwh: 0 });
    expect(bare.solarKwh).toBe(0);
    expect(near(bare.importedKwh, 20)).toBe(true);
    expect(bare.firstLight).toBeNull();
    const noBill = homeDay({ ...base, homeDayKwh: null });
    expect(noBill.useKwh).toBe(0);
    expect(near(noBill.exportedKwh, 36)).toBe(true);
  });
});

describe("the day in words", () => {
  it("says what a moment is doing", () => {
    const day = homeDay({ ...base, batteryKwh: 9 });
    const noon = momentWords(
      day.steps.find((s) => s.hour > 12.5)!,
      true,
      true,
    );
    expect(noon.sun).toMatch(/^Panels \d/);
    expect(noon.home).toMatch(/^Home /);
    const night = momentWords(day.steps[6], true, true);
    expect(night.sun).toBe("Sun down");
    expect(momentWords(day.steps[6], false, false)).toMatchObject({ battery: "", home: "", grid: "" });
  });

  it("never promises a home free of the grid, a saving or a figure in dollars", () => {
    const cases = [
      homeDay({ ...base, batteryKwh: 30 }),
      homeDay({ ...base, batteryKwh: 4 }),
      homeDay(base),
      homeDay({ ...base, panels: [], dayKwh: 0 }),
      homeDay({ ...base, homeDayKwh: null }),
    ];
    for (const day of cases) {
      const words = dayWords(day, "Summer", true).join(" ");
      expect(words).not.toMatch(/\$|guarantee|exact|100%|never need|free of the grid|off.grid|save/i);
      expect(words.length).toBeGreaterThan(10);
    }
    expect(dayWords(homeDay({ ...base, batteryKwh: 4 }), "Summer", true).join(" ")).toMatch(/until about .* then the grid/);
    expect(dayWords(homeDay({ ...base, shaded: (_, sun) => sun.azimuth < 180 }), "Summer", false).join(" ")).toMatch(/Shade takes about/);
  });
});
