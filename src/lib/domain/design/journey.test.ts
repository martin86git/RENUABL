import { describe, expect, it } from "vitest";
import { JOURNEY, journey, journeyStopOf } from "./journey";
import type { JobStage } from "./crm";

const job = (stage: JobStage, details: Record<string, string> = {}) => ({ stage, details });
const approved = { preApproval: "Approved" };
const done = { customerInvoice: "paid", stcClaim: "claimed", gridConnection: "completed" };

describe("where a job is on the journey", () => {
  it("follows the sale: enquiry, design, waiting to be signed", () => {
    expect(journeyStopOf(job("lead"))).toBe("enquiries");
    expect(journeyStopOf(job("designed"))).toBe("design");
    expect(journeyStopOf(job("proposal"))).toBe("sale");
    expect(journeyStopOf(job("lost"))).toBeNull();
  });

  it("holds a sold job at approvals until the grid has approved it and no rebate application is in hand", () => {
    expect(journeyStopOf(job("won"))).toBe("approvals");
    expect(journeyStopOf(job("won", { preApproval: "Submitted" }))).toBe("approvals");
    expect(journeyStopOf(job("won", { ...approved, solarVicStatus: "Applied" }))).toBe("approvals");
    expect(journeyStopOf(job("won", { ...approved, solarVicStatus: "Approved" }))).toBe("procure");
  });

  it("procures until the equipment is ordered and an installer named, then it is the installation's turn", () => {
    expect(journeyStopOf(job("won", approved))).toBe("procure");
    expect(journeyStopOf(job("ordered", approved))).toBe("procure");
    expect(journeyStopOf(job("ordered", { ...approved, installer: "Sam" }))).toBe("install");
    expect(journeyStopOf(job("scheduled", { ...approved, installer: "Sam" }))).toBe("install");
  });

  it("is post-install until the invoice is paid, the STCs claimed and the grid connected, then running", () => {
    expect(journeyStopOf(job("installed"))).toBe("after");
    expect(journeyStopOf(job("claimed", { ...done, gridConnection: "underway" }))).toBe("after");
    expect(journeyStopOf(job("grid", done))).toBe("running");
  });
});

describe("the journey", () => {
  it("counts every stop in order, with service from the open cases", () => {
    const paths = Object.fromEntries(JOURNEY.map((s) => [s, `/${s}`])) as Record<(typeof JOURNEY)[number], string>;
    const line = journey([job("lead"), job("lead"), job("proposal"), job("won"), job("lost")], 3, paths);
    expect(line.map((s) => s.stop)).toEqual([...JOURNEY]);
    expect(Object.fromEntries(line.map((s) => [s.stop, s.count]))).toEqual({
      enquiries: 2,
      design: 0,
      sale: 1,
      approvals: 1,
      procure: 0,
      install: 0,
      after: 0,
      running: 0,
      service: 3,
    });
    expect(line[0]).toMatchObject({ name: "Enquiries", href: "/enquiries" });
  });
});
