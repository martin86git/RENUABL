import { describe, expect, it } from "vitest";
import { nextHeadline, nextUp, suburbIn, type NextInput } from "./next-up";
import type { JobStage } from "./crm";

const TODAY = "2026-10-25";
const NOW = new Date("2026-10-24T22:00:00Z"); // 9am in Melbourne
const paths: NextInput["paths"] = {
  deal: (id) => `/deal/${id}`,
  chat: (id) => `/deal/${id}?tab=chat`,
  design: (id) => `/roof?job=${id}`,
  orders: "/orders",
};

const job = (
  id: string,
  stage: JobStage,
  more: Partial<{ installDate: string; wonAt: string; createdAt: string; details: Record<string, string>; kw: number }> = {},
) => ({
  id,
  stage,
  address: "2 Sample Court, Glen Waverley, VIC, 3150",
  kw: more.kw ?? null,
  installDate: more.installDate ?? null,
  wonAt: more.wonAt ?? null,
  createdAt: more.createdAt ?? "2026-09-01T00:00:00Z",
  details: more.details ?? {},
  customerName: `Casey ${id}`,
});

const run = (over: Partial<NextInput>) =>
  nextUp({ jobs: [], threads: [], followUps: [], orders: [], today: TODAY, now: NOW, paths, ...over });

describe("next up", () => {
  it("puts today's install first, then a customer waiting on a reply, then a new enquiry", () => {
    const items = run({
      jobs: [
        job("a", "lead", { createdAt: "2026-10-24T21:00:00Z" }),
        job("b", "scheduled", { installDate: TODAY, kw: 6.6, details: { preApproval: "Approved", installer: "Sam" } }),
      ],
      threads: [
        { jobId: "c", customerName: "Jo Sample", last: "Can we move the install to Friday?", at: "2026-10-24T20:00:00Z", unread: 2 },
      ],
    });
    expect(items.map((i) => i.kind)).toEqual(["install", "message", "lead"]);
    expect(items[0]).toMatchObject({ title: "Installing for Casey b today", why: "Glen Waverley · 6.6 kW · Sam", href: "/deal/b" });
    expect(items[1]).toMatchObject({
      title: "Jo wrote: “Can we move the install to Friday?”",
      why: "2 unread · 2 hours ago",
      action: "Reply",
      href: "/deal/c?tab=chat",
    });
    expect(items[2]).toMatchObject({ title: "New enquiry from Casey a", why: "Glen Waverley · came in 1 hour ago", href: "/roof?job=a" });
  });

  it("asks for approvals first on a sold deal, then for an install date once approved", () => {
    const sold = "2026-10-20T01:00:00Z";
    expect(run({ jobs: [job("a", "won", { wonAt: sold })] })[0]).toMatchObject({
      kind: "approvals",
      title: "Get Casey's approvals moving",
      why: "Grid pre-approval not submitted · sold 5 days ago",
    });
    expect(run({ jobs: [job("a", "won", { wonAt: sold, details: { preApproval: "Approved" } })] })[0]).toMatchObject({
      kind: "date",
      title: "Book an install date for Casey a",
    });
  });

  it("asks to order equipment only for installs within two weeks, sooner first", () => {
    const items = run({
      orders: [
        { jobId: "a", customer: "Ann", installDate: "2026-11-05", status: "open" },
        { jobId: "b", customer: "Ben", installDate: "2026-10-27", status: "open" },
        { jobId: "c", customer: "Cy", installDate: "2026-12-01", status: "open" },
        { jobId: "d", customer: "Di", installDate: "2026-10-27", status: "ordered" },
      ],
    });
    expect(items.map((i) => i.title)).toEqual(["Order the equipment for Ben", "Order the equipment for Ann"]);
    expect(items[0].why).toBe("Installing in 2 days");
  });

  it("leaves old leads and lost deals alone", () => {
    expect(run({ jobs: [job("a", "lead", { createdAt: "2026-10-10T00:00:00Z" }), job("b", "lost", { installDate: TODAY })] })).toEqual([]);
  });

  it("says how many things need you, and when", () => {
    expect(nextHeadline(0, 9)).toBe("Nothing needs you right now.");
    expect(nextHeadline(1, 9)).toBe("One thing needs you this morning.");
    expect(nextHeadline(3, 14)).toBe("Three things need you this afternoon.");
    expect(nextHeadline(9, 19)).toBe("9 things need you this evening.");
  });

  it("reads the suburb from an address", () => {
    expect(suburbIn("2 Hanwell Court, Glen Waverley, VIC, 3150")).toBe("Glen Waverley");
    expect(suburbIn("Somewhere")).toBe("Somewhere");
  });
});
