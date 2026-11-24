import { describe, expect, it } from "vitest";
import { CALENDAR_SIZES, calendarSize, monthRowHeight, readCalendarSize } from "./calendar-size";

const room = { width: 1400, height: 1000 };

describe("calendarSize", () => {
  it("is the usual size until one is asked for", () => {
    expect(calendarSize(null, CALENDAR_SIZES.page, room)).toEqual({ width: 768, height: 576 });
  });
  it("keeps what is asked inside its limits and the room there is", () => {
    expect(calendarSize({ width: 100, height: 50 }, CALENDAR_SIZES.page, room)).toEqual({ width: 520, height: 320 });
    expect(calendarSize({ width: 5000, height: 5000 }, CALENDAR_SIZES.page, room)).toEqual({ width: 1400, height: 1000 });
    expect(calendarSize({ width: 1000.4, height: 800.6 }, CALENDAR_SIZES.page, room)).toEqual({ width: 1000, height: 801 });
  });
  it("never goes under its least size, even on a small screen", () => {
    expect(calendarSize({ width: 900, height: 900 }, CALENDAR_SIZES.pop, { width: 200, height: 100 })).toEqual({
      width: 300,
      height: 240,
    });
  });
});

describe("readCalendarSize", () => {
  it("reads two numbers back, else nothing", () => {
    expect(readCalendarSize('{"width":900,"height":700}')).toEqual({ width: 900, height: 700 });
    expect(readCalendarSize('{"width":"900"}')).toBeNull();
    expect(readCalendarSize("nope")).toBeNull();
    expect(readCalendarSize(null)).toBeNull();
  });
});

describe("monthRowHeight", () => {
  it("shares the height among the weeks, never under 5.5rem", () => {
    expect(monthRowHeight(637, 6)).toBe(100);
    expect(monthRowHeight(300, 6)).toBe(88);
  });
});
