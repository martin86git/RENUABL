import { describe, expect, it } from "vitest";
import { feedFilter, nextMove, type FeedDeal } from "./deal-feed";
import { firesAtFor, laterAt, outboxState } from "./sol-agents";

const now = new Date("2026-11-06T03:00:00Z"); // Friday 2 pm in Melbourne
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const deal = (over: Partial<FeedDeal> = {}): FeedDeal => ({
  jobId: "job_1",
  customer: "Jo Citizen",
  suburb: "Glen Waverley",
  title: "Solar",
  stage: "proposal",
  value: 14890,
  kw: 6.6,
  batteryKwh: null,
  projectId: "proj_1",
  sample: false,
  createdAt: ago(200),
  installDate: null,
  heat: "warm",
  heatWhy: [],
  clock: null,
  proposal: { opened: true },
  events: [{ kind: "opened", text: "Opened the proposal", at: ago(2) }],
  sol: null,
  canCall: true,
  canEmail: true,
  phone: "0491 570 006",
  place: null,
  ...over,
});

describe("a deal's next move", () => {
  it("puts a customer waiting on a reply first, over anything Sol has lined up", () => {
    const d = deal({
      events: [{ kind: "message", text: "Does it fit?", at: ago(1), by: "Jo" }],
      sol: { subject: "Checking in", firesAt: ago(-1), held: false, state: "counting" },
    });
    expect(nextMove(d, now)).toMatchObject({ kind: "reply", label: "Reply to Jo" });
  });

  it("asks for a review of what Sol wrote and waits on you, none while he sends it himself", () => {
    // Counting down is Sol's: it sits in his lane, nothing for a person to do (14 Nov 2026).
    expect(nextMove(deal({ sol: { subject: "Checking in", firesAt: ago(-2), held: false, state: "counting" } }), now)).toBeNull();
    expect(nextMove(deal({ sol: { subject: "Hi", firesAt: ago(-2), held: false, state: "waiting" } }), now)?.why).toMatch(/waits for you/);
    expect(nextMove(deal({ sol: { subject: "Hi", firesAt: ago(-2), held: true, state: "held" } }), now)?.why).toMatch(/held/);
  });

  it("lights the designer for a lead with no roof, or a design Sol asked for", () => {
    expect(nextMove(deal({ stage: "lead", projectId: null, proposal: null, events: [] }), now)?.kind).toBe("design");
    const asked = deal({ stage: "designed", team: { lines: [], openAsks: [{ id: "l1", type: "design" }] } });
    expect(nextMove(asked, now)).toMatchObject({ kind: "design", label: "Open the design" });
  });

  it("asks for the proposal once designed and priced", () => {
    expect(nextMove(deal({ stage: "designed", proposal: null }), now)).toMatchObject({ kind: "proposal", label: "Send the proposal" });
    expect(nextMove(deal({ stage: "lead", proposal: null, events: [] }), now)?.kind).toBe("proposal");
  });

  it("calls a hot deal not called lately, but only with a phone", () => {
    expect(nextMove(deal({ heat: "hot" }), now)).toMatchObject({ kind: "call", label: "Call Jo" });
    expect(nextMove(deal({ heat: "hot", events: [{ kind: "call", text: "Spoke", at: ago(5) }] }), now)).toBeNull();
    expect(nextMove(deal({ heat: "hot", phone: null }), now)).toBeNull();
  });

  it("books the install for a sale with no day, and leaves a deal in hand alone", () => {
    expect(nextMove(deal({ stage: "won", installDate: null }), now)?.kind).toBe("book");
    expect(nextMove(deal({ stage: "won", installDate: "2026-12-01" }), now)).toBeNull();
    expect(nextMove(deal(), now)).toBeNull();
  });
});

describe("putting off what Sol sends", () => {
  it("goes an hour later, or at 9 am the next working day", () => {
    expect(laterAt("hour", now)).toBe("2026-11-06T04:00:00.000Z");
    // Friday: the next working day is Monday 9 Nov, 9 am Melbourne (UTC+11).
    expect(laterAt("tomorrow", now)).toBe("2026-11-08T22:00:00.000Z");
  });

  it("goes at the time it was put off to, inside the hours", () => {
    expect(firesAtFor({ createdAt: ago(1), notBefore: "2026-11-06T04:00:00.000Z" }, "business", now)).toBe("2026-11-06T04:00:00.000Z");
    // Put off to 8 pm: business hours close at 5 pm, so it waits for Monday's 9 am.
    expect(firesAtFor({ createdAt: ago(1), notBefore: "2026-11-06T09:00:00.000Z" }, "business", now)).toBe("2026-11-08T22:00:00.000Z");
  });

  it("counts down once a person picks the time, even with the stage's agent off", () => {
    const off = { hours: "business" as const, on: [] };
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: off })).toBe("waiting");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: off, scheduled: true })).toBe("counting");
    expect(outboxState({ stage: "proposal", held: true, hasEmail: true, settings: off, scheduled: true })).toBe("held");
  });
});

describe("filtering the feed", () => {
  const deals = [
    deal({ jobId: "a", stage: "lead", owner: "Sam@example.com" }),
    deal({ jobId: "b", stage: "won", owner: "jo@example.com" }),
    deal({ jobId: "c", stage: "scheduled", owner: null }),
  ];
  const ids = (d: FeedDeal[]) => d.map((x) => x.jobId);
  it("keeps the deals at a stage of the pipeline picked", () => {
    expect(ids(feedFilter(deals, { pipeline: "all", stages: null, mine: false, me: "sam@example.com" }))).toEqual(["a", "b", "c"]);
    expect(ids(feedFilter(deals, { pipeline: "sales", stages: ["lead", "designed", "proposal", "won"], mine: false, me: "" }))).toEqual([
      "a",
      "b",
    ]);
    // A pipeline that is no longer there shows every deal.
    expect(ids(feedFilter(deals, { pipeline: "gone", stages: null, mine: false, me: "" }))).toEqual(["a", "b", "c"]);
  });
  it("keeps only the person's own deals with Mine on", () => {
    expect(ids(feedFilter(deals, { pipeline: "all", stages: null, mine: true, me: "sam@example.com" }))).toEqual(["a"]);
  });
});
