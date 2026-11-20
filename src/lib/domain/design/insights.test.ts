import { describe, expect, it } from "vitest";
import type { ISODate } from "../types";
import {
  approvalsInsight,
  batteryInsight,
  dealsFor,
  insightsView,
  monthView,
  openedInsight,
  speedInsight,
  type InsightDeal,
  type InsightInput,
} from "./insights";

const now = new Date("2026-11-21T00:00:00Z");
const today = "2026-11-21" as ISODate;
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
let n = 0;
const deal = (over: Partial<InsightDeal> = {}): InsightDeal => ({
  id: `j${++n}`,
  customerName: `Person${n} Example`,
  stage: "lead",
  value: 20_000,
  kw: 6.6,
  title: "Solar",
  details: {},
  createdAt: ago(30),
  wonAt: null,
  installedAt: null,
  owner: "sam@biz.example",
  installDate: null,
  firstTouch: null,
  sentAt: null,
  openedAt: null,
  signedAt: null,
  calls: [],
  ...over,
});
const input = (deals: InsightDeal[], over: Partial<InsightInput> = {}): InsightInput => ({
  deals,
  scope: "business",
  me: "sam@biz.example",
  today,
  now,
  ...over,
});

describe("whose deals", () => {
  it("reads only the viewer's own for My month", () => {
    const deals = [deal(), deal({ owner: "jo@biz.example" }), deal({ owner: null })];
    expect(dealsFor({ deals, scope: "me", me: "Sam@biz.example" })).toHaveLength(1);
    expect(dealsFor({ deals, scope: "business", me: "sam@biz.example" })).toHaveLength(3);
  });
});

describe("the month", () => {
  it("counts this month's signed deals, the goal from the target, and what is still needed", () => {
    const deals = [
      deal({ stage: "won", wonAt: ago(5), value: 30_000 }),
      deal({ stage: "won", wonAt: ago(10), value: 30_000 }),
      deal({ stage: "won", wonAt: ago(60), value: 30_000 }),
    ];
    const m = monthView(input(deals, { targets: { sales: 120_000, deals: null, kw: null } }));
    expect(m.sold).toBe(60_000);
    expect(m.signed).toBe(2);
    expect(m.goal).toBe(120_000);
    expect(m.goalIs).toBe("target");
    expect(m.needed).toBe(2);
    expect(m.pace).toBe("behind");
  });
  it("adds the open proposals at the default rate to what is likely", () => {
    const deals = [deal({ stage: "won", wonAt: ago(2), value: 10_000 }), deal({ stage: "proposal", sentAt: ago(3), value: 40_000 })];
    expect(monthView(input(deals)).likely).toBe(20_000);
  });
});

describe("speed to lead", () => {
  it("names the leads waiting, and the rate only once both sides have enough", () => {
    const fast = Array.from({ length: 4 }, () => deal({ firstTouch: ago(30, -0.5), stage: "won", wonAt: ago(20) }));
    const slow = Array.from({ length: 4 }, (_, i) => deal({ firstTouch: ago(30, -5), stage: i ? "lost" : "won" }));
    const waiting = deal({ createdAt: ago(1, 2), customerName: "Alex Example" });
    const got = speedInsight(input([...fast, ...slow, waiting]))!;
    expect(got.deals.map((d) => d.name)).toEqual(["Alex"]);
    expect(got.why).toMatch(/signed 4 times as often \(100% against 25%\)/);
    expect(got.action.label).toBe("Contact Alex");
  });
  it("says nothing when every lead has heard from the business", () => {
    expect(speedInsight(input([deal({ createdAt: ago(1), firstTouch: ago(1, -0.2) })]))).toBeNull();
  });
  it("offers to switch on Sol · Leads when it is off, for the business", () => {
    const got = speedInsight(input([deal({ createdAt: ago(0, 5) })], { leadsAgentOn: false }))!;
    expect(got.action.href).toBe("/design/routines");
  });
});

describe("opened with no call", () => {
  it("lists the proposals opened over 2 days ago with no call since, the biggest first", () => {
    const small = deal({ stage: "proposal", sentAt: ago(6), openedAt: ago(5), value: 10_000, customerName: "Mei Example" });
    const big = deal({ stage: "proposal", sentAt: ago(6), openedAt: ago(4), value: 40_000, customerName: "Doug Example" });
    const called = deal({ stage: "proposal", sentAt: ago(6), openedAt: ago(4), calls: [ago(3)] });
    const got = openedInsight(input([small, big, called]))!;
    expect(got.deals.map((d) => d.name)).toEqual(["Doug", "Mei"]);
    expect(got.action.label).toBe("Call Doug");
  });
});

describe("batteries against solar alone", () => {
  it("is said only when batteries sign clearly more often", () => {
    const b = Array.from({ length: 4 }, (_, i) =>
      deal({ details: { battery: "13.5 kWh" }, sentAt: ago(30), signedAt: i < 2 ? ago(20) : null }),
    );
    const s = Array.from({ length: 4 }, (_, i) => deal({ sentAt: ago(30), signedAt: i < 1 ? ago(20) : null }));
    const open = deal({ stage: "proposal", sentAt: ago(3), customerName: "Priya Example" });
    const got = batteryInsight(input([...b, ...s, open], { scope: "me" }))!;
    expect(got.title).toBe("You close batteries well");
    expect(got.why).toMatch(/50% of battery proposals sign, against 25% for solar alone/);
    expect(got.deals.map((d) => d.name)).toEqual(["Priya"]);
    expect(batteryInsight(input(s))).toBeNull();
  });
});

describe("approvals", () => {
  it("flags sold deals waiting on pre-approval over 10 days, for the business only", () => {
    const stuck = deal({ stage: "won", wonAt: ago(14), customerName: "Casey Example" });
    expect(approvalsInsight(input([stuck]))!.deals.map((d) => d.name)).toEqual(["Casey"]);
    expect(approvalsInsight(input([stuck], { scope: "me" }))).toBeNull();
    expect(approvalsInsight(input([deal({ stage: "won", wonAt: ago(14), details: { preApproval: "Approved" } })]))).toBeNull();
  });
});

describe("the view", () => {
  it("puts things to act on first and keeps three", () => {
    const deals = [
      deal({ stage: "won", wonAt: ago(14) }),
      deal({ createdAt: ago(0, 5) }),
      deal({ stage: "proposal", sentAt: ago(6), openedAt: ago(4) }),
    ];
    const v = insightsView(input(deals));
    expect(v.insights.map((i) => i.key)).toEqual(["speed", "opened", "approvals"]);
    expect(v.insights.every((i) => !/@/.test(i.why))).toBe(true);
  });
});
