import { describe, expect, it } from "vitest";
import { padLines, solLine, todayParts, todaySummary, type FeedDeal } from "./deal-feed";
import type { DealLine } from "./deal-team";

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

const askLine: DealLine = {
  id: "dl_aaaaaaaa",
  jobId: "job_1",
  by: "sol",
  kind: "ask",
  text: 'I need a design for Jo. Our notes say: "a battery, please".',
  at: ago(5),
  ask: { type: "design", want: "A design with a battery", why: [] },
};

describe("Today in parts", () => {
  it("puts a deal needing a person in Needs you, Sol's lined-up emails in Coming up soonest first, and the rest in hand", () => {
    const waiting = deal({ jobId: "a", events: [{ kind: "message", text: "Does it fit?", at: ago(1), by: "Jo" }] });
    const later = deal({ jobId: "b", sol: { subject: "Checking in", firesAt: ago(-5), held: false, state: "counting" } });
    const sooner = deal({ jobId: "c", sol: { subject: "Hello", firesAt: ago(-1), held: false, state: "counting" } });
    const quiet = deal({ jobId: "d" });
    const parts = todayParts([quiet, later, waiting, sooner], now);
    expect(parts.needs.map((d) => d.jobId)).toEqual(["a"]);
    expect(parts.coming.map((d) => d.jobId)).toEqual(["c", "b"]);
    expect(parts.inHand.map((d) => d.jobId)).toEqual(["d"]);
  });

  it("never shows a deal twice: one that needs you and has an email lined up stays in Needs you", () => {
    const both = deal({
      events: [{ kind: "message", text: "Quick question", at: ago(1), by: "Jo" }],
      sol: { subject: "Checking in", firesAt: ago(-1), held: false, state: "counting" },
    });
    const parts = todayParts([both], now);
    expect(parts.needs).toHaveLength(1);
    expect(parts.coming).toHaveLength(0);
  });
});

describe("a card says it once", () => {
  it("reads Sol's open request in his own words, and leaves it out of the pad", () => {
    const d = deal({ stage: "lead", team: { lines: [askLine], openAsks: [{ id: askLine.id, type: "design" }] } });
    expect(solLine(d, now)).toBe(askLine.text);
    expect(padLines(d)).toEqual([]);
  });

  it("keeps the team's own lines, and a request once it's done, in the pad", () => {
    const said: DealLine = { ...askLine, id: "dl_bbbbbbbb", by: "sam@example.com", kind: "note", text: "On it", ask: undefined };
    const d = deal({ team: { lines: [askLine, said], openAsks: [] } });
    expect(padLines(d).map((l) => l.id)).toEqual([askLine.id, said.id]);
  });

  it("says why the next move is next when Sol hasn't asked for anything", () => {
    expect(solLine(deal({ events: [{ kind: "message", text: "Hi", at: ago(1), by: "Jo" }] }), now)).toBe(
      "Jo asked something and is waiting on a reply.",
    );
  });
});

describe("Sol's line at the top of Today", () => {
  it("says what needs you, what he sends next and what's been done", () => {
    const parts = todayParts(
      [
        deal({ jobId: "a", events: [{ kind: "message", text: "Hi", at: ago(1), by: "Jo" }] }),
        deal({ jobId: "b", customer: "Sam Lee", sol: { subject: "Hello", firesAt: ago(-2), held: false, state: "counting" } }),
      ],
      now,
    );
    expect(todaySummary(parts, { mine: 3, sol: 4 }, now)).toBe("One deal needs you. I email Sam in 2h 0m. 3 done by you today, I sent 4.");
  });

  it("says nothing needs you when that's so", () => {
    expect(todaySummary({ needs: [], coming: [], inHand: [] }, null, now)).toBe("Nothing needs you right now.");
  });
});
