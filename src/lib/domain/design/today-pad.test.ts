import { describe, expect, it } from "vitest";
import type { Activity, Customer, Job } from "./crm";
import {
  agendaFor,
  agoWords,
  beforeYouCall,
  daySoFar,
  isWorkingDay,
  jobOf,
  nextWorkingDay,
  pipelineBoard,
  solDayScript,
} from "./today-pad";

const job = (id: string, extra: Partial<Job> = {}): Job & { customerName: string } => ({
  id,
  customerId: "c1",
  customerName: "Casey Demo",
  title: "Solar",
  address: "31 Mock Lane, Geelong VIC 3220",
  lat: null,
  lng: null,
  stage: "won",
  projectId: null,
  value: 8600,
  installDate: null,
  kw: 6.6,
  wonAt: "2026-10-11T00:00:00.000Z",
  installedAt: null,
  details: {},
  owner: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  ...extra,
});

const customer: Customer = {
  id: "c1",
  name: "Casey Demo",
  firstName: "Casey",
  lastName: "Demo",
  phone: "0491 570 156",
  email: "",
  address: "31 Mock Lane",
  lat: null,
  lng: null,
  source: "",
  notes: "",
  sample: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const act = (kind: Activity["kind"], at: string, by = "sam@x.example", jobId: string | null = "j1"): Activity => ({
  id: `${kind}-${at}`,
  customerId: "c1",
  jobId,
  kind,
  text: `${kind} words`,
  by,
  at,
});

describe("Today's pad", () => {
  it("reads the deal an item is about", () => {
    expect(jobOf({ key: "follow-up:job_1" })).toBe("job_1");
    expect(jobOf({ key: "odd" })).toBeNull();
  });

  it("says how long ago plainly", () => {
    expect(agoWords("2026-11-02T03:00:00Z", "2026-11-02")).toBe("today");
    expect(agoWords("2026-11-01", "2026-11-02")).toBe("yesterday");
    expect(agoWords("2026-10-27", "2026-11-02")).toBe("6 days ago");
    expect(agoWords("2026-10-01", "2026-11-02")).toBe("5 weeks ago");
  });

  it("knows what to say before calling: the deal, the last touch and what is open", () => {
    const b = beforeYouCall({
      job: job("j1"),
      customer,
      activity: [
        act("note", "2026-10-10T00:00:00Z"),
        act("call", "2026-10-20T00:00:00Z"),
        act("email", "2026-10-30T00:00:00Z", "x", "other"),
      ],
      today: "2026-11-02",
    });
    expect(b.deal).toBe("Won · $8,600 · 6.6 kW");
    expect(b.last).toBe("Call 13 days ago: call words");
    expect(b.open).toEqual(["No email address on file", "No one owns this deal yet", "No install date booked"]);
    expect(beforeYouCall({ job: job("j1", { stage: "lead" }), customer, activity: [], today: "2026-11-02" }).open).toContain(
      "Nothing logged on this deal yet",
    );
  });

  it("counts what this member has done today", () => {
    const today = [act("call", "t"), act("call", "t"), act("note", "t"), act("call", "t", "ash@x.example")];
    expect(daySoFar(today, "Sam@x.example")).toEqual([
      { kind: "call", label: "calls logged", n: 2 },
      { kind: "note", label: "note", n: 1 },
    ]);
  });

  it("steps to the next working day past weekends and holidays", () => {
    expect(isWorkingDay("2026-11-02")).toBe(true);
    expect(isWorkingDay("2026-11-07")).toBe(false);
    expect(nextWorkingDay("2026-11-06")).toBe("2026-11-09");
    // Melbourne Cup day, Tuesday 3 November 2026.
    expect(nextWorkingDay("2026-11-02")).toBe("2026-11-04");
  });

  it("lays out a day's installs and reminders in time order", () => {
    const items = agendaFor("2026-11-04", {
      jobs: [job("j1", { installDate: "2026-11-04", details: { installer: "Crew A" } }), job("j2", { installDate: "2026-11-05" })],
      reminders: [
        { id: "r1", what: "Call the bank", dueAt: "2026-11-04T04:00:00Z" },
        { id: "r2", what: "Early", dueAt: "2026-11-03T20:00:00Z" },
        { id: "r3", what: "Waiting" },
      ],
      timeOf: (iso) => ({ day: iso.slice(0, 10) === "2026-11-03" ? "2026-11-04" : iso.slice(0, 10), time: iso.slice(11, 16) }),
    });
    expect(items.map((i) => [i.time, i.title])).toEqual([
      ["04:00", "Call the bank"],
      ["08:00", "Install for Casey Demo"],
      ["20:00", "Early"],
    ]);
    expect(items[1].line).toContain("Crew A");
  });

  it("puts the deals being sold on a board, latest changed first", () => {
    const board = pipelineBoard([job("a", { stage: "lead" }), job("b", { stage: "lead", updatedAt: "2026-10-30T00:00:00Z" }), job("c")]);
    expect(board.map((s) => [s.stage, s.count])).toEqual([
      ["lead", 2],
      ["designed", 0],
      ["proposal", 0],
      ["won", 1],
    ]);
    expect(board[0].jobs.map((j) => j.id)).toEqual(["b", "a"]);
    expect(board[3].value).toBe(8600);
  });
});

describe("solDayScript", () => {
  const base = { count: 3, callName: "Olivia", done: [], ready: false, hour: 14, name: "Demo" };
  it("greets, then puts Up first, Before you call and the rest in place in that order", () => {
    const beats = solDayScript(base);
    expect(beats[0]).toEqual({ say: "Here's your afternoon, Demo. Three things need you, and I've put them in order." });
    expect(beats.filter((b) => "show" in b).map((b) => ("show" in b ? b.show : ""))).toEqual(["first", "call", "rest"]);
    expect(beats).toContainEqual({ say: "Before you ring Olivia, here's where things stand." });
    expect(beats).toContainEqual({ say: "Then two more to action, most pressing first." });
    expect(beats[beats.length - 1]).toEqual({ say: "Ask me anything below." });
  });
  it("says so when nothing needs them, and shows nothing", () => {
    const beats = solDayScript({ ...base, count: 0, callName: null, hour: 9, name: null });
    expect(beats[0]).toEqual({ say: "Here's your morning. Nothing needs you right now: everything is answered, followed up and booked." });
    expect(beats.some((b) => "show" in b)).toBe(false);
  });
  it("leaves out Before you call without a customer, and the rest when there is one thing", () => {
    const beats = solDayScript({ ...base, count: 1, callName: null });
    expect(beats.filter((b) => "show" in b)).toEqual([{ show: "first" }]);
  });
  it("puts what he drafted in place, and the day so far in words", () => {
    const beats = solDayScript({
      ...base,
      ready: true,
      done: [
        { label: "calls logged", n: 2 },
        { label: "email", n: 1 },
      ],
      hour: 19,
    });
    expect(beats).toContainEqual({ show: "ready" });
    expect(beats).toContainEqual({ say: "So far today: 2 calls logged and 1 email." });
    expect(beats[0]).toMatchObject({ say: expect.stringContaining("evening") });
  });
  it("uses figures past ten", () => {
    expect(solDayScript({ ...base, count: 12 })[0]).toEqual({
      say: "Here's your afternoon, Demo. 12 things need you, and I've put them in order.",
    });
  });
});
