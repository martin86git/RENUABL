import { describe, expect, it } from "vitest";
import { cleanMetrics, cleanRange, DEFAULT_METRICS, perfPeriod, performance, periodWords } from "./performance";

const job = (o: Partial<Parameters<typeof performance>[0][number]>) => ({
  stage: "lead" as const,
  value: null,
  kw: null,
  wonAt: null,
  installedAt: null,
  createdAt: "2026-11-02T01:00:00Z",
  title: "Solar",
  details: {},
  ...o,
});

describe("perfPeriod", () => {
  it("this month runs to today, against the same days of last month", () => {
    expect(perfPeriod("month", "2026-11-21")).toEqual({
      from: "2026-11-01",
      to: "2026-11-21",
      prevFrom: "2026-10-01",
      prevTo: "2026-10-21",
    });
  });
  it("never runs past a short month", () => {
    expect(perfPeriod("month", "2026-03-31").prevTo).toBe("2026-02-28");
  });
  it("last month is whole, against the month before", () => {
    expect(perfPeriod("last-month", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
      prevFrom: "2025-11-01",
      prevTo: "2025-11-30",
    });
  });
  it("quarters and the financial year", () => {
    expect(perfPeriod("quarter", "2026-11-21")).toMatchObject({ from: "2026-10-01", prevFrom: "2026-07-01" });
    expect(perfPeriod("last-quarter", "2026-11-21")).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
      prevFrom: "2026-04-01",
      prevTo: "2026-06-30",
    });
    expect(perfPeriod("fy", "2026-11-21")).toMatchObject({ from: "2026-07-01", prevFrom: "2025-07-01" });
    expect(perfPeriod("fy", "2027-03-01").from).toBe("2026-07-01");
  });
  it("days back, and a custom range put in order and kept to today", () => {
    expect(perfPeriod("30d", "2026-11-21")).toEqual({ from: "2026-10-23", to: "2026-11-21", prevFrom: "2026-09-23", prevTo: "2026-10-22" });
    expect(perfPeriod("custom", "2026-11-21", { from: "2026-12-10", to: "2026-11-01" })).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-21",
    });
    expect(perfPeriod("custom", "2026-11-21", null).from).toBe("2026-11-01");
  });
});

describe("performance", () => {
  const period = perfPeriod("month", "2026-11-21");
  const jobs = [
    job({ stage: "won", value: 20000, kw: 6.6, wonAt: "2026-11-05T02:00:00Z", details: { battery: "13.5 kWh" } }),
    job({ stage: "installed", value: 10000, kw: 5, wonAt: "2026-11-10T02:00:00Z", installedAt: "2026-11-20T02:00:00Z" }),
    job({ stage: "won", value: 15000, wonAt: "2026-10-05T02:00:00Z", createdAt: "2026-10-01T01:00:00Z" }),
    job({ stage: "won", value: 99999, wonAt: "2026-11-06T02:00:00Z", sample: true }),
    job({}),
  ];
  it("counts sales, kW, batteries, leads, conversion and installs, leaving samples out", () => {
    const f = Object.fromEntries(
      performance(jobs, period, ["sales", "sold", "average", "kw", "batteries", "leads", "conversion", "installs"]).map((x) => [
        x.metric,
        x,
      ]),
    );
    expect(f.sales.value).toBe(30000);
    expect(f.sales.prev).toBe(15000);
    expect(f.sales.change).toBe(1);
    expect(f.sold.value).toBe(2);
    expect(f.average.value).toBe(15000);
    expect(f.kw.value).toBe(11.6);
    expect(f.batteries.value).toBe(1);
    expect(f.leads.value).toBe(3);
    expect(f.conversion.value).toBeCloseTo(2 / 3);
    expect(f.installs.value).toBe(1);
    expect(f.installs.change).toBeNull();
  });
  it("keeps the order asked", () => {
    expect(performance(jobs, period, ["leads", "sales"]).map((x) => x.metric)).toEqual(["leads", "sales"]);
  });
});

describe("cleaning what the device kept", () => {
  it("keeps known metrics once, else the defaults", () => {
    expect(cleanMetrics(["kw", "nope", "kw", "sales"])).toEqual(["kw", "sales"]);
    expect(cleanMetrics([])).toEqual(DEFAULT_METRICS);
    expect(cleanMetrics("x")).toEqual(DEFAULT_METRICS);
  });
  it("keeps a known range, else this month", () => {
    expect(cleanRange("fy")).toBe("fy");
    expect(cleanRange("yesterday")).toBe("month");
  });
});

describe("periodWords", () => {
  it("adds the year only where it tells the periods apart", () => {
    expect(periodWords({ from: "2026-11-01", to: "2026-11-21" }, "2026")).toBe("1 Nov to 21 Nov");
    expect(periodWords({ from: "2025-07-01", to: "2025-11-21" }, "2026")).toBe("1 July 2025 to 21 Nov 2025");
    expect(periodWords({ from: "2025-12-01", to: "2026-01-21" }, "2026")).toBe("1 Dec 2025 to 21 Jan 2026");
  });
});

describe("perfSeries", () => {
  const jobs = [
    job({ stage: "won", value: 20000, wonAt: "2026-11-05T02:00:00Z" }),
    job({ stage: "won", value: 5000, wonAt: "2026-11-20T02:00:00Z" }),
  ];
  it("days within a month, weeks within a quarter, months beyond", async () => {
    const { perfSeries } = await import("./performance");
    const days = perfSeries(jobs, { from: "2026-11-01", to: "2026-11-21" });
    expect(days).toHaveLength(21);
    expect(days[4].values.sales).toBe(20000);
    expect(perfSeries(jobs, { from: "2026-10-01", to: "2026-11-21" })).toHaveLength(8);
    const months = perfSeries(jobs, { from: "2026-07-01", to: "2026-11-21" });
    expect(months.map((b) => b.from)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(months[4]).toMatchObject({ to: "2026-11-21", values: { sales: 25000, sold: 2 } });
  });
});
