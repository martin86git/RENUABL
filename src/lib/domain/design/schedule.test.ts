import { describe, expect, it } from "vitest";
import { calendarDays, installReminderEmail, readiness, reminderDue } from "./schedule";

describe("the Install Scheduler", () => {
  it("shows whole weeks, Monday first, for a month", () => {
    const m = calendarDays("month", "2026-10-18");
    expect(m.days[0]).toBe("2026-09-28");
    expect(m.days.at(-1)).toBe("2026-11-01");
    expect(m.days.length % 7).toBe(0);
    expect(m.prev).toBe("2026-09-01");
    expect(m.next).toBe("2026-11-01");
    expect(m.title).toBe("October 2026");
  });

  it("shows a week from its Monday", () => {
    const w = calendarDays("week", "2026-10-18");
    expect(w.days).toHaveLength(7);
    expect(w.days[0]).toBe("2026-10-12");
    expect(w.next).toBe("2026-10-19");
    expect(w.prev).toBe("2026-10-05");
  });

  it("says whether a job is ready", () => {
    expect(readiness({ order: "ordered", depositReceived: true }).state).toBe("ready");
    expect(readiness({ order: "delivered", depositReceived: null }).state).toBe("ready");
    expect(readiness({ order: "open", depositReceived: true }).state).toBe("partly");
    expect(readiness({ order: null, depositReceived: false }).state).toBe("not");
  });

  it("reminds on the right day only", () => {
    expect(reminderDue("2026-10-23", "2026-10-21", 2)).toBe(true);
    expect(reminderDue("2026-10-23", "2026-10-22", 2)).toBe(false);
    expect(reminderDue("2026-11-02", "2026-10-31", 2)).toBe(true);
  });

  it("names the business, the day and how to get ready, never a price", () => {
    const e = installReminderEmail({ business: "Sunny Co", firstName: "Sarah", date: "2026-10-23", contact: "0400 000 000" });
    expect(e.subject).toBe("Sunny Co: your installation is on Friday 23 October");
    expect(e.text).toContain("switchboard");
    expect(e.text).not.toMatch(/\$/);
  });
});
