import { describe, expect, it } from "vitest";
import type { Job } from "./crm";
import { filterOf, jobsAt, nextStepOf, phaseCounts, phaseNote, phaseOf } from "./jobs-view";

const today = "2026-11-10";
const job = (over: Partial<Job> = {}): Job => ({
  id: "j1",
  customerId: "c1",
  title: "Solar",
  address: "1 Sample Street",
  lat: null,
  lng: null,
  stage: "lead",
  projectId: null,
  value: null,
  installDate: null,
  kw: null,
  wonAt: null,
  installedAt: null,
  details: {},
  owner: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...over,
});
const approved = { preApproval: "Approved", solarVicStatus: "Not applying" };

describe("where a job is in its life", () => {
  it("files a job still being sold under Selling, and a lost one nowhere", () => {
    expect(phaseOf(job({ stage: "proposal" }), today)).toBe("selling");
    expect(phaseOf(job({ stage: "lost" }), today)).toBeNull();
  });

  it("keeps a sold job in Getting ready until its install day is within the week", () => {
    expect(phaseOf(job({ stage: "won" }), today)).toBe("ready");
    expect(phaseOf(job({ stage: "scheduled", installDate: "2026-11-30" }), today)).toBe("ready");
    expect(phaseOf(job({ stage: "scheduled", installDate: "2026-11-14" }), today)).toBe("installing");
    // Its day has come and it isn't marked installed: still Installing, with that as the next step.
    const late = job({ stage: "scheduled", installDate: "2026-11-07" });
    expect(phaseOf(late, today)).toBe("installing");
    expect(nextStepOf(late, "installing", today)).toEqual({ words: "Mark it installed", tone: "you" });
  });

  it("finishes an installed job until invoice, CoES, STCs and the grid connection are done", () => {
    expect(phaseOf(job({ stage: "installed" }), today)).toBe("finishing");
    const allDone = { customerInvoice: "paid", coes: "received", stcClaim: "claimed", gridConnection: "underway" };
    expect(phaseOf(job({ stage: "installed", details: allDone }), today)).toBe("done");
  });
});

describe("the filters within a stage", () => {
  it("files a sold job at its first approval not through, then To book, then Booked", () => {
    expect(filterOf(job({ stage: "won" }), "ready", today)).toBe("preapproval");
    expect(filterOf(job({ stage: "won", details: { preApproval: "Approved", solarVicStatus: "Applied" } }), "ready", today)).toBe(
      "solarvic",
    );
    expect(filterOf(job({ stage: "won", details: approved }), "ready", today)).toBe("book");
    expect(filterOf(job({ stage: "scheduled", installDate: "2026-12-01", details: approved }), "ready", today)).toBe("booked");
  });

  it("files a finishing job at its next step after the install", () => {
    expect(filterOf(job({ stage: "installed", details: { customerInvoice: "paid" } }), "finishing", today)).toBe("coes");
  });
});

describe("the list and the tiles", () => {
  it("lists Getting ready with the longest waiting since sold first, and filters by the quick filter", () => {
    const jobs = [
      job({ id: "new", stage: "won", wonAt: "2026-11-08T00:00:00Z" }),
      job({ id: "old", stage: "won", wonAt: "2026-10-20T00:00:00Z" }),
      job({ id: "book", stage: "won", wonAt: "2026-10-25T00:00:00Z", details: approved }),
    ];
    expect(jobsAt(jobs, "ready", null, today).map((j) => j.id)).toEqual(["old", "book", "new"]);
    expect(jobsAt(jobs, "ready", "book", today).map((j) => j.id)).toEqual(["book"]);
  });

  it("counts each stage and gives each tile its figure", () => {
    const jobs = [
      job({ stage: "lead", value: 12000 }),
      job({ stage: "proposal", value: 20000 }),
      job({ stage: "won" }),
      job({ stage: "installed", installedAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(phaseCounts(jobs, today)).toEqual({ selling: 2, ready: 1, installing: 0, finishing: 1, done: 0 });
    expect(phaseNote(jobs, "selling", today)).toBe("$32k in play");
    expect(phaseNote(jobs, "ready", today)).toBe("1 waiting on you");
  });
});
