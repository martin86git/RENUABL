import { describe, expect, it } from "vitest";
import {
  applyUpdate,
  caseInWords,
  matchesSearch,
  openCaseFor,
  plannerOrder,
  recordLine,
  serviceFocusWords,
  toResolve,
  waitingDays,
  type ServiceCase,
} from "./service";

const base: ServiceCase = {
  id: "svc_1",
  jobId: "job_a",
  customerId: "cus_a",
  issue: "Inverter showing an earth fault since Monday",
  state: "open",
  raisedAt: "2026-10-10T00:00:00Z",
  raisedBy: "sam@sunny.example",
  resolvedAt: null,
  updates: [],
};
const at = "2026-10-12T00:00:00Z";

describe("a service case", () => {
  it("moves open → in hand → resolved, keeping who did it and a note", () => {
    const inHand = applyUpdate(base, { state: "in-hand", text: "Tech booked Thursday" }, "jo@sunny.example", at, []);
    expect(inHand.ok && inHand.case.state).toBe("in-hand");
    if (!inHand.ok) return;
    expect(inHand.case.updates).toEqual([{ at, by: "jo@sunny.example", state: "in-hand", text: "Tech booked Thursday" }]);
    const done = applyUpdate(inHand.case, { state: "resolved" }, "jo@sunny.example", at, []);
    expect(done.ok && done.case.resolvedAt).toBe(at);
  });

  it("refuses a step it can't take, an empty change, and a second open case on a deal", () => {
    expect(applyUpdate(base, { state: "open" }, "x", at, []).ok).toBe(false);
    expect(applyUpdate(base, { text: "  " }, "x", at, []).ok).toBe(false);
    const resolved = { ...base, state: "resolved" as const, resolvedAt: at };
    const another = { ...base, id: "svc_2" };
    expect(applyUpdate(resolved, { state: "open" }, "x", at, [resolved, another])).toEqual({
      ok: false,
      message: "This deal already has a service case open.",
    });
    expect(applyUpdate(resolved, { state: "open" }, "x", at, [resolved]).ok).toBe(true);
  });

  it("is written on the deal's record", () => {
    expect(recordLine(base.issue, { at, by: "x", state: "resolved", text: "Replaced the isolator" })).toBe(
      "Service case resolved\nIssue: Inverter showing an earth fault since Monday\nNote: Replaced the isolator",
    );
  });

  it("knows the open case on a deal and how long it has waited", () => {
    expect(openCaseFor([base], "job_a")?.id).toBe("svc_1");
    expect(openCaseFor([{ ...base, state: "resolved" }], "job_a")).toBeNull();
    expect(waitingDays(base, new Date("2026-10-13T12:00:00Z"))).toBe(3);
    expect(toResolve([base, { ...base, state: "resolved" }])).toBe(1);
  });
});

describe("the service planner", () => {
  it("puts open first, then in hand, each longest waiting first, then the latest resolved", () => {
    const cases = [
      { ...base, id: "r1", state: "resolved" as const, resolvedAt: "2026-10-01T00:00:00Z" },
      { ...base, id: "h1", state: "in-hand" as const, raisedAt: "2026-10-05T00:00:00Z" },
      { ...base, id: "o2", raisedAt: "2026-10-09T00:00:00Z" },
      { ...base, id: "o1", raisedAt: "2026-10-02T00:00:00Z" },
      { ...base, id: "r2", state: "resolved" as const, resolvedAt: "2026-10-08T00:00:00Z" },
    ];
    expect(plannerOrder(cases, "all").map((c) => c.id)).toEqual(["o1", "o2", "h1", "r2", "r1"]);
    expect(plannerOrder(cases, "to-resolve").map((c) => c.id)).toEqual(["o1", "o2", "h1"]);
    expect(plannerOrder(cases, "resolved").map((c) => c.id)).toEqual(["r2", "r1"]);
  });

  it("finds a case by every word typed, in any order", () => {
    expect(matchesSearch(["Jordan Placeholder", "0400 000 000", base.issue], "earth jordan")).toBe(true);
    expect(matchesSearch(["Jordan Placeholder", base.issue], "earth smith")).toBe(false);
  });
});

describe("what Sol is told about a case", () => {
  const worked: ServiceCase = {
    ...base,
    state: "in-hand",
    updates: [{ at: "2026-10-11T03:00:00Z", by: "jo@sunny.example", state: "in-hand", text: "Tech booked Thursday" }],
  };
  it("gives the issue and every step of its history, by handle only", () => {
    const words = caseInWords(worked);
    expect(words).toContain("Service case (In hand), raised 2026-10-10 by sam");
    expect(words).toContain("The issue: Inverter showing an earth fault since Monday");
    expect(words).toContain("- 2026-10-11 jo marked it in hand: Tech booked Thursday");
    expect(words).not.toContain("@");
    expect(caseInWords(base)).toContain("Nothing done on it yet.");
  });
  it("names the customer, the deal and its id, and the deal's earlier cases, not other deals'", () => {
    const earlier: ServiceCase = { ...base, id: "svc_0", state: "resolved", issue: "Panel clip loose", resolvedAt: "2026-09-02T00:00:00Z" };
    const elsewhere: ServiceCase = { ...base, id: "svc_9", jobId: "job_b", issue: "A fault on another deal" };
    const focus = {
      ...worked,
      customer: "Casey Sample",
      phone: "0491 570 006",
      email: "",
      address: "1 Sample Street",
      title: "Solar",
      stage: "installed",
      installDate: "2026-09-01",
      installer: "Jo",
    };
    const words = serviceFocusWords(focus, [earlier, worked, elsewhere]);
    expect(words).toContain('Service case for Casey Sample · deal "Solar" (deal id job_a)');
    expect(words).toContain("Earlier cases on this deal (1):");
    expect(words).toContain("Panel clip loose");
    expect(words).not.toContain("another deal");
    expect(words).toContain("deal_details with deal id job_a");
  });
});
