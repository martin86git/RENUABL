import { describe, expect, it } from "vitest";
import type { ISODate } from "../types";
import { cleanKept, installEvents, marketInstant, scheduleList, stepDay, viewDays } from "./calendar-view";
import { marketMinutes } from "./my-calendar";

describe("today's calendar", () => {
  it("puts a market clock time at the right instant, in and out of daylight saving", () => {
    expect(marketMinutes(marketInstant("2026-11-23" as ISODate, "08:00"))).toBe(480);
    expect(marketMinutes(marketInstant("2026-06-15" as ISODate, "16:00"))).toBe(960);
  });

  it("makes each booked install an 8 to 4 event opening its deal, never a lost one", () => {
    const events = installEvents([
      { id: "a", customerName: "Jo", address: "1 Sample St", installDate: "2026-11-24", stage: "scheduled", kw: 6.6 },
      { id: "b", customerName: "Al", address: null, installDate: "2026-11-24", stage: "lost" },
      { id: "c", customerName: "Bo", address: null, installDate: null, stage: "won" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: "Install: Jo · 6.60 kW", href: "/design/deals/a", source: "installs" });
    expect(marketMinutes(events[0].start)).toBe(480);
  });

  it("shows whole weeks for a month, Monday first", () => {
    const days = viewDays("month", "2026-11-23" as ISODate);
    expect(days[0]).toBe("2026-10-26");
    expect(days.length % 7).toBe(0);
    expect(days).toContain("2026-11-30");
  });

  it("steps a day, three days or a month", () => {
    expect(stepDay("day", "2026-11-23" as ISODate, 1)).toBe("2026-11-24");
    expect(stepDay("3day", "2026-11-23" as ISODate, -1)).toBe("2026-11-20");
    expect(stepDay("month", "2026-11-23" as ISODate, 1)).toBe("2026-12-01");
  });

  it("lists only days with something on, and always today", () => {
    const events = installEvents([{ id: "a", customerName: "Jo", address: null, installDate: "2026-11-26", stage: "won" }]);
    const list = scheduleList(events, "2026-11-23" as ISODate, "2026-11-23" as ISODate);
    expect(list.map((d) => d.day)).toEqual(["2026-11-23", "2026-11-26"]);
  });

  it("keeps a known view and only known calendars", () => {
    expect(cleanKept({ view: "month", hidden: ["installs", "nope"] })).toEqual({ view: "month", hidden: ["installs"] });
    expect(cleanKept(null)).toEqual({ view: "day", hidden: [] });
  });
});
