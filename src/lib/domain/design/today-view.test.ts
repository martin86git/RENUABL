import { describe, expect, it } from "vitest";
import { cleanSeen, todayHeading, todayOpensOn } from "./today-view";
import type { ISODate } from "../types";

const today = "2026-11-20" as ISODate;

describe("which way Today opens", () => {
  it("opens on Chat the first time in a day", () => {
    expect(todayOpensOn(null, today)).toBe("chat");
    expect(todayOpensOn({ day: "2026-11-19" as ISODate, view: "feed" }, today)).toBe("chat");
  });
  it("keeps the view last had the same day", () => {
    expect(todayOpensOn({ day: today, view: "feed" }, today)).toBe("feed");
    expect(todayOpensOn({ day: today, view: "chat" }, today)).toBe("chat");
  });
  it("reads only a day and a view", () => {
    expect(cleanSeen({ day: "2026-11-20", view: "feed" })).toEqual({ day: "2026-11-20", view: "feed" });
    expect(cleanSeen({ day: "20 Nov", view: "feed" })).toBeNull();
    expect(cleanSeen({ day: "2026-11-20", view: "board" })).toBeNull();
    expect(cleanSeen("feed")).toBeNull();
    expect(cleanSeen(null)).toBeNull();
  });
});

describe("todayHeading", () => {
  it("names the day and month with an ordinal", () => {
    expect(todayHeading("2026-11-22" as ISODate)).toBe("Sunday, 22nd November");
    expect(todayHeading("2026-12-01" as ISODate)).toBe("Tuesday, 1st December");
    expect(todayHeading("2026-11-13" as ISODate)).toBe("Friday, 13th November");
    expect(todayHeading("2026-11-23" as ISODate)).toBe("Monday, 23rd November");
    expect(todayHeading("2026-11-11" as ISODate)).toBe("Wednesday, 11th November");
  });
});

describe("the calendar view", () => {
  it("is kept and opened again the same day", () => {
    const seen = cleanSeen({ day: "2026-11-23", view: "calendar" });
    expect(seen).toEqual({ day: "2026-11-23", view: "calendar" });
    expect(todayOpensOn(seen, "2026-11-23")).toBe("calendar");
  });
});
