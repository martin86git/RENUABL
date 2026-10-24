import { describe, expect, it } from "vitest";
import { dayCleared, dayList, orderDueSoon, sunNow, sunTimes, type DayCounts } from "./today";

const melbourne = (d: Date) => d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });

describe("the day's sun", () => {
  it("rises and sets in Melbourne about when the almanac says", () => {
    // 24 Oct 2026: sunrise about 6:15 am, sunset about 7:50 pm (daylight saving).
    const t = sunTimes("2026-10-24", -37.8136, 144.9631)!;
    const minutes = (d: Date) => {
      const [h, m] = melbourne(d)
        .replace(/\s?[ap]m/i, "")
        .split(":")
        .map(Number);
      return h * 60 + m;
    };
    expect(Math.abs(minutes(t.rise) - (6 * 60 + 15))).toBeLessThanOrEqual(10);
    expect(Math.abs(minutes(t.set) + 12 * 60 - (19 * 60 + 50))).toBeLessThanOrEqual(10);
    // Midwinter is a shorter day.
    const june = sunTimes("2026-06-21", -37.8136, 144.9631)!;
    expect(june.set.getTime() - june.rise.getTime()).toBeLessThan(t.set.getTime() - t.rise.getTime());
  });

  it("knows where the sun is: not up yet, across the sky, or set", () => {
    const times = { rise: new Date("2026-10-24T19:15:00Z"), set: new Date("2026-10-25T08:50:00Z") };
    expect(sunNow(new Date("2026-10-24T18:00:00Z"), times)).toEqual({ share: 0, phase: "before" });
    expect(sunNow(new Date("2026-10-25T02:02:30Z"), times).share).toBeCloseTo(0.5, 2);
    expect(sunNow(new Date("2026-10-25T10:00:00Z"), times)).toEqual({ share: 1, phase: "set" });
  });
});

describe("the day's list", () => {
  const paths = Object.fromEntries(
    ["installsToday", "followUpsDue", "messages", "mentions", "ordersToPlace", "needDate", "serviceOpen"].map((k) => [k, `/${k}`]),
  ) as Record<keyof DayCounts, string>;

  it("says how many of each, or that there's none, and how much of the day is cleared", () => {
    const items = dayList(
      { installsToday: 1, followUpsDue: 2, messages: 0, mentions: 1, ordersToPlace: 0, needDate: 0, serviceOpen: 3 },
      paths,
    );
    expect(items.map((i) => i.label)).toEqual([
      "1 install today",
      "2 follow-ups due",
      "No messages waiting",
      "1 mention to read",
      "No orders to place",
      "Every sold deal has a date",
      "3 service cases open",
    ]);
    // Today's installs are the day's work, not a backlog: 3 of the other 6 are clear.
    expect(dayCleared(items)).toEqual({ cleared: 3, of: 6, share: 0.5 });
  });

  it("asks for an order once its install is within two weeks", () => {
    expect(orderDueSoon("open", "2026-11-05", "2026-10-24")).toBe(true);
    expect(orderDueSoon("open", "2026-11-20", "2026-10-24")).toBe(false);
    expect(orderDueSoon("ordered", "2026-10-26", "2026-10-24")).toBe(false);
    expect(orderDueSoon("open", null, "2026-10-24")).toBe(false);
  });
});
