import { describe, expect, it } from "vitest";
import { handable, needsYou, solDoesWords, solHasIt, todayParts, type FeedDeal } from "./deal-feed";

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

const counting = { subject: "Checking in", firesAt: ago(-1), held: false, state: "counting" as const };
const waiting = { subject: "Checking in", firesAt: ago(-1), held: false, state: "waiting" as const };

describe("Sol's lane and handing work to him", () => {
  it("puts what Sol sends himself in his lane, and a draft waiting on you in yours", () => {
    const his = deal({ jobId: "job_his", sol: counting });
    const yours = deal({ jobId: "job_yours", sol: waiting });
    const parts = todayParts([his, yours], now);
    expect(parts.sols.map((d) => d.jobId)).toEqual(["job_his"]);
    expect(parts.needs.map((d) => d.jobId)).toEqual(["job_yours"]);
    expect(solHasIt(his)).toBe(true);
    expect(needsYou(his, now)).toBeNull();
    expect(needsYou(yours, now)).toMatch(/Sol drafted an email to Jo/);
  });

  it("keeps a customer waiting on a reply with a person, whatever Sol has lined up", () => {
    const d = deal({ sol: counting, events: [{ kind: "message", text: "Does it fit?", at: ago(1), by: "Jo" }] });
    expect(needsYou(d, now)).toMatch(/waiting on a reply/);
    expect(handable(d, now)).toBeNull();
    expect(todayParts([d], now).sols).toEqual([]);
  });

  it("hands a waiting draft to send, and a signed deal with no day to book", () => {
    expect(handable(deal({ sol: waiting }), now)).toBe("send");
    expect(handable(deal({ stage: "won" }), now)).toBe("book");
    // Already his, already booked, or no email to send to: nothing to hand.
    expect(handable(deal({ sol: counting }), now)).toBeNull();
    expect(handable(deal({ stage: "won", installDate: "2026-11-20" }), now)).toBeNull();
    expect(handable(deal({ stage: "won", canEmail: false }), now)).toBeNull();
  });

  it("says what Sol is doing on the deal", () => {
    expect(solDoesWords(deal({ sol: { ...counting, kind: "install-day", installDay: "2026-11-20" } }))).toBe(
      "Books Fri 20 Nov and emails Jo",
    );
    expect(solDoesWords(deal({ sol: counting }))).toBe("Emails Jo: Checking in");
  });
});
