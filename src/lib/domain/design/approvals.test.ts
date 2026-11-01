import { describe, expect, it } from "vitest";
import { atGate, capacityWeeks, cleanCapacity, gateCounts, gateOf, preApprovalOf, solarVicOf } from "./approvals";
import type { JobStage } from "./crm";

const job = (stage: JobStage, details: Record<string, string> = {}, installDate: string | null = null, wonAt = "2026-10-20T00:00:00Z") => ({
  stage,
  details,
  installDate,
  wonAt,
  createdAt: "2026-10-01T00:00:00Z",
});

describe("approvals come before booking", () => {
  it("files a sold job with no date at its first gate not passed", () => {
    expect(gateOf(job("won"))).toBe("preapproval");
    expect(gateOf(job("won", { preApproval: "Submitted" }))).toBe("preapproval");
    expect(gateOf(job("ordered", { preApproval: "Approved", solarVicStatus: "Applied" }))).toBe("solarvic");
    expect(gateOf(job("won", { preApproval: "Approved, export limited" }))).toBe("book");
    expect(gateOf(job("won", { preApproval: "Approved", solarVicStatus: "Approved" }))).toBe("book");
    expect(gateOf(job("won", { preApproval: "Approved" }, "2026-11-20"))).toBeNull();
    expect(gateOf(job("proposal"))).toBeNull();
    expect(gateOf(job("installed"))).toBeNull();
  });

  it("says each approval in words with whether it is through", () => {
    expect(preApprovalOf(job("won"))).toEqual({ words: "Not submitted", tone: "missing" });
    expect(preApprovalOf(job("won", { preApproval: "Declined" })).tone).toBe("missing");
    expect(solarVicOf(job("won", { solarVicStatus: "Applied" }))).toEqual({ words: "Applied, waiting", tone: "waiting" });
    expect(solarVicOf(job("won")).tone).toBe("through");
  });

  it("counts each gate and lists the longest waiting first", () => {
    const jobs = [
      job("won", {}, null, "2026-10-25T00:00:00Z"),
      job("won", {}, null, "2026-10-10T00:00:00Z"),
      job("won", { preApproval: "Approved" }),
    ];
    expect(gateCounts(jobs)).toEqual({ preapproval: 2, solarvic: 0, book: 1 });
    expect(atGate(jobs, "preapproval").map((j) => j.wonAt)).toEqual(["2026-10-10T00:00:00Z", "2026-10-25T00:00:00Z"]);
  });
});

describe("the install calendar's capacity", () => {
  it("counts each of the next weeks' installations against what can be done", () => {
    const now = new Date("2026-11-04T02:00:00Z"); // Wednesday 4 Nov in Melbourne
    const weeks = capacityWeeks(["2026-11-02", "2026-11-06", "2026-11-10", null, "2026-12-30"], 2, now);
    expect(weeks).toHaveLength(6);
    expect(weeks.slice(0, 3).map((w) => [w.monday, w.label, w.booked, w.full])).toEqual([
      ["2026-11-02", "This week", 2, true],
      ["2026-11-09", "Next week", 1, false],
      ["2026-11-16", "w/c 16 Nov", 0, false],
    ]);
    expect([cleanCapacity("8"), cleanCapacity(0), cleanCapacity("x")]).toEqual([8, 5, 5]);
  });
});
