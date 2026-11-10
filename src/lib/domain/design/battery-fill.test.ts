import { describe, expect, it } from "vitest";
import { batteryFill, batteryFillWords } from "./battery-fill";

describe("batteryFill", () => {
  it("fills the battery as panels are added, until it is full", () => {
    const few = batteryFill({ solarDayKwh: 8, homeDayKwh: null, batteryKwh: 9.6 })!;
    const more = batteryFill({ solarDayKwh: 16, homeDayKwh: null, batteryKwh: 9.6 })!;
    const plenty = batteryFill({ solarDayKwh: 40, homeDayKwh: null, batteryKwh: 9.6 })!;
    expect(few.share).toBeLessThan(more.share);
    expect(few.limit).toBe("panels");
    expect(plenty.share).toBe(1);
    expect(plenty.limit).toBeNull();
  });
  it("never fills past the home's evenings", () => {
    const fill = batteryFill({ solarDayKwh: 60, homeDayKwh: 5, batteryKwh: 19.2 })!;
    expect(fill.share).toBeLessThan(1);
    expect(fill.limit).toBe("evenings");
  });
  it("leaves a module held for blackouts out, and needs a battery", () => {
    expect(batteryFill({ solarDayKwh: 20, homeDayKwh: null, batteryKwh: 8, backupKwh: 8 })).toBeNull();
    expect(batteryFillWords({ share: 0.5, kwh: 4, limit: "panels" })).toContain("more panels");
  });
});
