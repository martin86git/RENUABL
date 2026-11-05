import { describe, expect, it } from "vitest";
import { busyDays, cleanEvents, daysOf, eventTime, eventsOn, rangeFor, returnPath } from "./my-calendar";

const [meeting, holiday, late, gone, odd] = [
  {
    id: "a",
    summary: " Site visit ",
    location: "12 Sample Street",
    htmlLink: "https://www.google.com/calendar/event?eid=a",
    hangoutLink: "https://meet.google.com/abc-defg-hij",
    start: { dateTime: "2026-11-05T09:30:00+11:00" },
    end: { dateTime: "2026-11-05T10:00:00+11:00" },
  },
  { id: "b", summary: "Leave", start: { date: "2026-11-05" }, end: { date: "2026-11-07" } },
  { id: "c", start: { dateTime: "2026-11-05T22:00:00+11:00" }, end: { dateTime: "2026-11-06T01:00:00+11:00" } },
  { id: "d", status: "cancelled", summary: "Gone", start: { date: "2026-11-05" }, end: { date: "2026-11-06" } },
  {
    id: "e",
    summary: "Bad",
    htmlLink: "javascript:alert(1)",
    hangoutLink: "https://evil.example/meet",
    start: { dateTime: "nope" },
    end: {},
  },
];

describe("my calendar", () => {
  const events = cleanEvents([meeting, holiday, late, gone, odd]);

  it("keeps real events, drops cancelled and broken ones, and only Google's own links", () => {
    expect(events.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(events[0]).toMatchObject({ title: "Site visit", location: "12 Sample Street", call: "https://meet.google.com/abc-defg-hij" });
    expect(events[2].title).toBe("(No title)");
    const sneaky = cleanEvents([
      { ...meeting, id: "x", htmlLink: "https://evil.example/google.com", hangoutLink: "http://meet.google.com/a" },
    ]);
    expect(sneaky[0]).toMatchObject({ link: null, call: null });
  });

  it("puts each event on the market's days it covers", () => {
    expect(daysOf(events[1])).toEqual({ first: "2026-11-05", last: "2026-11-06" });
    expect(daysOf(events[2])).toEqual({ first: "2026-11-05", last: "2026-11-06" });
    expect(eventsOn(events, "2026-11-05").map((e) => e.id)).toEqual(["b", "a", "c"]);
    expect(eventsOn(events, "2026-11-06").map((e) => e.id)).toEqual(["b", "c"]);
    expect(eventsOn(events, "2026-11-07")).toEqual([]);
    expect([...busyDays(events, ["2026-11-04", "2026-11-05", "2026-11-07"])]).toEqual(["2026-11-05"]);
  });

  it("says the time in the market's words", () => {
    expect(eventTime(events[0], "2026-11-05")).toBe("9:30 am – 10 am");
    expect(eventTime(events[1], "2026-11-06")).toBe("All day");
    expect(eventTime(events[2], "2026-11-05")).toBe("From 10 pm");
    expect(eventTime(events[2], "2026-11-06")).toBe("Until 1 am");
  });

  it("asks Google a day wider either side", () => {
    expect(rangeFor("2026-10-26", "2026-12-06")).toEqual({ timeMin: "2026-10-25T00:00:00Z", timeMax: "2026-12-08T00:00:00Z" });
  });

  it("only ever sends someone back to a designer page", () => {
    expect(returnPath("/design/deals/abc")).toBe("/design/deals/abc");
    expect(returnPath("https://evil.example")).toBe("/design");
    expect(returnPath("//evil.example")).toBe("/design");
    expect(returnPath("/design?x=1")).toBe("/design");
    expect(returnPath(null)).toBe("/design");
  });
});
