import { describe, expect, it } from "vitest";
import { ASK_DAYS, askTimes, askedWindow } from "./voice-agent";

// Wednesday 25 Nov 2026, 10:00 in Melbourne (AEDT, UTC+11).
const wed10 = new Date("2026-11-24T23:00:00Z");
// Sunday 29 Nov 2026, 10:00: no calls on Sundays.
const sun10 = new Date("2026-11-28T23:00:00Z");

describe("times a customer may pick for their call", () => {
  it("offers the next days with calling hours, from a quarter hour on", () => {
    const days = askTimes(wed10);
    expect(days).toHaveLength(ASK_DAYS);
    expect(days[0].label).toBe("Today");
    expect(days[0].times[0].label).toMatch(/10:30/);
    expect(days[1].label).toBe("Tomorrow");
    expect(days[1].times[0].label).toMatch(/9(:00)?\s?am/i);
  });

  it("never offers a Sunday", () => {
    const days = askTimes(sun10);
    expect(days.map((d) => d.date)).not.toContain("2026-11-29");
    expect(days[0].date).toBe("2026-11-30");
  });

  it("ends half an hour before calling hours do", () => {
    const sat = askTimes(wed10).find((d) => d.date === "2026-11-28")!;
    expect(sat.times.at(-1)!.label).toMatch(/4(:00)?\s?pm/i);
  });

  it("takes only a time it offers, held to that day's hours", () => {
    const pick = askTimes(wed10)[1].times[2].at;
    const w = askedWindow(pick, wed10)!;
    expect(w.from.toISOString()).toBe(pick);
    expect(w.until.getTime()).toBeGreaterThan(w.from.getTime());
    expect(askedWindow("2026-11-29T00:00:00.000Z", wed10)).toBeNull();
    expect(askedWindow("not a date", wed10)).toBeNull();
    expect(askedWindow(42, wed10)).toBeNull();
  });
});
