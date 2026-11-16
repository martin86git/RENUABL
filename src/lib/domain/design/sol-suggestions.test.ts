import { describe, expect, it } from "vitest";
import type { FeedDeal } from "./deal-feed";
import { SUGGESTIONS_MAX, solSuggestions } from "./sol-suggestions";

const now = new Date("2026-11-16T03:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const deal = (over: Partial<FeedDeal> = {}): FeedDeal => ({
  jobId: "job_1",
  customer: "Jo Citizen",
  suburb: "Glen Waverley",
  title: "Solar",
  stage: "lead",
  value: null,
  kw: null,
  batteryKwh: null,
  projectId: null,
  sample: false,
  createdAt: ago(20),
  installDate: null,
  heat: null,
  heatWhy: [],
  clock: null,
  proposal: null,
  events: [],
  sol: null,
  canCall: true,
  canEmail: true,
  phone: "0412345678",
  place: null,
  ...over,
});

describe("solSuggestions", () => {
  it("offers a first hello to a new lead nobody has written to", () => {
    const s = solSuggestions(deal(), now);
    expect(s).toEqual([expect.objectContaining({ kind: "write", label: "Write a first hello" })]);
    expect(s[0].ask).toMatch(/Jo/);
  });
  it("answers the customer first when they wrote last", () => {
    const s = solSuggestions(
      deal({ stage: "proposal", events: [{ kind: "message", at: ago(1), text: "Is the battery big enough?" } as FeedDeal["events"][0]] }),
      now,
    );
    expect(s[0]).toMatchObject({ kind: "write", label: "Answer Jo" });
  });
  it("follows up a proposal, and puts Sol's own email to review first", () => {
    const s = solSuggestions(deal({ stage: "proposal", sol: { subject: "Your proposal", firesAt: ago(-2), held: false } }), now);
    expect(s.map((x) => x.kind)).toEqual(["review", "write"]);
    expect(s[1].label).toBe("Write a follow-up");
    expect(s.length).toBeLessThanOrEqual(SUGGESTIONS_MAX);
  });
  it("asks about install days on a sale with no day", () => {
    expect(solSuggestions(deal({ stage: "won" }), now)[0].label).toBe("Ask about install days");
    expect(solSuggestions(deal({ stage: "won", installDate: "2026-12-01" }), now)).toEqual([]);
  });
  it("writes nothing without an email on the record", () => {
    expect(solSuggestions(deal({ canEmail: false }), now)).toEqual([]);
  });
});
