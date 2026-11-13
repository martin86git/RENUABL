import { describe, expect, it } from "vitest";
import { dayChip, installDayChoices, installDayEmail } from "./install-days";

describe("install day choices", () => {
  // Friday 13 Nov 2026: five working days on is Friday 20 Nov.
  const today = "2026-11-13";

  it("starts five working days out, one a week, never a weekend", () => {
    const days = installDayChoices({ booked: [], perWeek: 5, today });
    expect(days).toEqual(["2026-11-20", "2026-11-23", "2026-11-30", "2026-12-07"]);
    for (const d of days) expect([0, 6]).not.toContain(new Date(`${d}T12:00:00Z`).getUTCDay());
  });

  it("passes over a day already booked and a full week", () => {
    const days = installDayChoices({ booked: ["2026-11-20", "2026-11-23", "2026-11-24"], perWeek: 2, today });
    expect(days[0]).toBe("2026-11-30");
    expect(days).not.toContain("2026-11-20");
    expect(days.some((d) => d >= "2026-11-23" && d <= "2026-11-27")).toBe(false);
  });

  it("never offers Christmas Day or Boxing Day", () => {
    const days = installDayChoices({ booked: [], perWeek: 5, today: "2026-12-17", count: 10 });
    expect(days).not.toContain("2026-12-25");
    expect(days).not.toContain("2026-12-28");
  });
});

describe("install day email", () => {
  it("names the day and the customer, and promises nothing more", () => {
    const e = installDayEmail({ firstName: "Casey", day: "2026-11-24", sender: "Sam", business: "Sunrise Solar" });
    expect(e.subject).toBe("Your installation day: Tuesday 24 November");
    expect(e.body).toMatch(/^Hi Casey,/);
    expect(e.body).toContain("Sam\nSunrise Solar");
    expect(e.body).not.toMatch(/\$|guarantee|price/i);
    expect(dayChip("2026-11-24")).toMatch(/Tue/);
  });
});
