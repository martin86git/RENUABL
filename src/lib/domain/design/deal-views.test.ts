import { describe, expect, it } from "vitest";
import type { Job } from "./crm";
import { OVERVIEW_VIEWS, PIPELINES, VIEW_PIPELINE, completedInstalls, greetingName, upcomingInstalls, viewLines } from "./deal";

const at = (date: string) => `${date}T02:00:00.000Z`; // midday-ish in Melbourne: the same day there
type J = Pick<Job, "stage" | "value" | "kw" | "createdAt" | "wonAt" | "installedAt" | "installDate" | "updatedAt">;
const job = (o: Partial<J>): J => ({
  stage: "lead",
  value: null,
  kw: null,
  createdAt: at("2026-01-01"),
  wonAt: null,
  installedAt: null,
  installDate: null,
  updatedAt: at("2026-10-01"),
  ...o,
});

// Sunday 18 October 2026: its week runs Monday 12 to Sunday 18.
const TODAY = "2026-10-18";
const jobs: J[] = [
  job({ stage: "won", value: 10000, kw: 6.6 }), // sold, nothing ordered, no date
  job({ stage: "ordered", value: 12000, kw: 8, installDate: "2026-10-21" }),
  job({ stage: "scheduled", value: 9000, kw: 5, installDate: "2026-10-21" }),
  job({ stage: "scheduled", value: 7000, kw: 5, installDate: "2026-10-15" }), // this week, passed, not marked installed
  job({ stage: "scheduled", value: 8000, kw: 6, installDate: "2026-11-03" }),
  job({ stage: "installed", value: 20000, kw: 13.2, installedAt: at("2026-10-05") }),
  job({ stage: "grid", value: 15000, kw: 10, installedAt: at("2026-09-10") }),
  job({ stage: "claimed", value: 11000, kw: 6.6, installedAt: at("2026-08-01") }),
  job({ stage: "coes", value: 9000, kw: 6, installedAt: at("2026-06-20") }), // last financial year
  job({ stage: "proposal", value: 14000 }),
  job({ stage: "lost", value: 5000, installDate: "2026-10-21" }),
];

describe("the overview's views", () => {
  it("are sales, upcoming installs and completed installs, each with a pipeline that exists", () => {
    expect(OVERVIEW_VIEWS.map((v) => v.label)).toEqual(["Sales", "Upcoming installs", "Completed installs"]);
    for (const v of OVERVIEW_VIEWS) expect(PIPELINES.some((p) => p.id === VIEW_PIPELINE[v.id])).toBe(true);
  });
});

describe("upcoming installs", () => {
  const u = upcomingInstalls(jobs, TODAY);
  it("count what is sold and not yet installed, never a lost job", () => {
    expect(u.total).toBe(5);
    expect(u.value).toBe(10000 + 12000 + 9000 + 7000 + 8000);
    expect(u.kw).toBe(30.6);
  });
  it("split them by date: booked ahead, this week, this month, to book, overdue", () => {
    expect(u.booked).toBe(3);
    expect(u.thisWeek).toBe(1);
    expect(u.thisMonth).toBe(3);
    expect(u.toBook).toBe(1);
    expect(u.overdue).toBe(1);
    expect(u.next).toEqual({ date: "2026-10-21", count: 2 });
  });
  it("say what still needs ordering", () => {
    expect(u.toOrder).toBe(1);
    expect(u.ordered).toBe(1);
  });
  it("have nothing next when nothing is booked", () => {
    expect(upcomingInstalls([], TODAY)).toMatchObject({ total: 0, next: null });
  });
});

describe("completed installs", () => {
  const c = completedInstalls(jobs, TODAY);
  it("add up the financial year by the day each was installed", () => {
    expect(c.yearCount).toBe(3);
    expect(c.yearValue).toBe(20000 + 15000 + 11000);
    expect(c.yearKw).toBe(29.8);
    expect(c.yearLabel).toBe("FY 2026-27");
  });
  it("compare the month to date with the same days last month", () => {
    expect(c.monthCount).toBe(1);
    expect(c.vsLastMonth).toBe(0); // 10 Sep within 1 to 18 Sep: one then, one now
  });
  it("say where the paperwork stands", () => {
    expect(c).toMatchObject({ inspection: 0, coes: 1, grid: 1, claimed: 1, paperwork: 3 });
  });
});

describe("the greeting", () => {
  it("uses a name only when the email starts with one", () => {
    expect(greetingName("martin@renuabl.com.au")).toBe("Martin");
    expect(greetingName("SAM@example.com")).toBe("Sam");
    for (const email of ["sales@example.com", "j.smith@example.com", "info@x.au", "a1@x.au", "", null, undefined])
      expect(greetingName(email)).toBeNull();
  });
  it("sums up each view in a line", () => {
    const lines = viewLines(jobs, TODAY);
    expect(lines.sales).toBe("0 deals sold in October, 1 proposal with customers.");
    expect(lines.upcoming).toBe("1 install this week, the next on Wed, 21 Oct. 1 still to book.");
    expect(lines.completed).toBe("3 installs done this financial year, 3 with paperwork open.");
    expect(viewLines([], TODAY).upcoming).toBe("Nothing sold is waiting to be installed.");
  });
});
