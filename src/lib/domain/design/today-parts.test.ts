import { describe, expect, it } from "vitest";
import {
  arrivalWords,
  leadOwnerFor,
  opensOnMine,
  teamLines,
  padLines,
  solLine,
  todayParts,
  todaySummary,
  type FeedDeal,
} from "./deal-feed";
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
    expect(todaySummary({ fresh: [], needs: [], coming: [], inHand: [] }, null, now)).toBe("Nothing needs you right now.");
  });
});

describe("New in", () => {
  it("holds the leads waiting for a design, newest first, whenever they came in, and keeps them out of Needs you", () => {
    const fresh = deal({ jobId: "f", stage: "lead", projectId: null, createdAt: ago(3), events: [] });
    const older = deal({ jobId: "g", stage: "lead", projectId: null, createdAt: ago(400), events: [] });
    const asking = deal({
      jobId: "w",
      stage: "lead",
      projectId: null,
      createdAt: ago(10),
      events: [{ kind: "message", text: "Hi?", at: ago(1), by: "Jo" }],
    });
    const old = deal({ jobId: "o" });
    const parts = todayParts([old, older, asking, fresh], now);
    expect(parts.fresh.map((d) => d.jobId)).toEqual(["f", "w", "g"]);
    expect(parts.needs).toEqual([]);
    expect(parts.inHand.map((d) => d.jobId)).toEqual(["o"]);
    expect(todaySummary(parts, null, now)).toBe("3 new leads to design. Nothing needs you right now.");
  });

  it("leaves out a lead with a design, a designed deal and a deal won", () => {
    const drawn = deal({ jobId: "drawn", stage: "lead", projectId: "proj_2", events: [] });
    const designed = deal({ jobId: "designed", stage: "designed", events: [] });
    const won = deal({ jobId: "won", stage: "won", createdAt: ago(5) });
    expect(todayParts([drawn, designed, won], now).fresh).toEqual([]);
  });
});

describe("Needs you", () => {
  it("is for deals past the proposal: a designed deal with a customer waiting stays out of it", () => {
    const designed = deal({ jobId: "d", stage: "designed", events: [{ kind: "message", text: "Hi?", at: ago(1), by: "Jo" }] });
    const sent = deal({ jobId: "s", events: [{ kind: "message", text: "Hi?", at: ago(1), by: "Jo" }] });
    const won = deal({ jobId: "w", stage: "won", installDate: null, events: [] });
    expect(
      todayParts([designed, sent, won], now)
        .needs.map((d) => d.jobId)
        .sort(),
    ).toEqual(["s", "w"]);
  });
});

describe("a new arrival", () => {
  it("says where a new arrival has got to", () => {
    expect(arrivalWords(deal({ stage: "lead", events: [] }))).toEqual({ words: "Not contacted yet", waiting: true });
    expect(arrivalWords(deal({ stage: "lead", events: [{ kind: "call", text: "Spoke", at: ago(1), by: "sam" }] }))).toEqual({
      words: "Sam called",
      waiting: false,
    });
    expect(arrivalWords(deal({ stage: "proposal" })).words).toBe("Proposal sent");
  });
});

describe("the team's size and roles", () => {
  it("opens the owner on everyone's deals, anyone else in a team on their own, and someone alone on theirs", () => {
    expect(opensOnMine("owner", 3)).toBe(false);
    expect(opensOnMine("member", 3)).toBe(true);
    expect(opensOnMine("member", 1)).toBe(false);
  });

  it("gives a lead the owner adds to the one salesperson, and leaves everyone else's with them", () => {
    const two = [
      { email: "Ann@co.example", role: "owner" },
      { email: "sam@co.example", role: "member" },
    ];
    expect(leadOwnerFor("ann@co.example", two)).toBe("sam@co.example");
    expect(leadOwnerFor("sam@co.example", two)).toBe("sam@co.example");
    // Two salespeople: nobody is chosen for them by this rule.
    expect(leadOwnerFor("ann@co.example", [...two, { email: "jo@co.example", role: "member" }])).toBe("ann@co.example");
    // A designer isn't a salesperson.
    expect(leadOwnerFor("ann@co.example", [two[0], { email: "di@co.example", role: "designer" }])).toBe("ann@co.example");
  });
});

describe("sharing out leads in a larger team", () => {
  const team = [
    { email: "ann@co.example", role: "owner" },
    { email: "sam@co.example", role: "member" },
    { email: "jo@co.example", role: "member" },
  ];
  it("keeps the owner's leads by default, and in turns gives each to the salesperson given one longest ago", () => {
    expect(leadOwnerFor("ann@co.example", team)).toBe("ann@co.example");
    expect(leadOwnerFor("ann@co.example", team, "turns", { "sam@co.example": "2026-11-09T00:00:00Z" })).toBe("jo@co.example");
    expect(
      leadOwnerFor("ann@co.example", team, "turns", { "jo@co.example": "2026-11-10T00:00:00Z", "sam@co.example": "2026-11-09T00:00:00Z" }),
    ).toBe("sam@co.example");
    // A salesperson's own lead is theirs whatever the rule.
    expect(leadOwnerFor("sam@co.example", team, "turns")).toBe("sam@co.example");
  });

  it("gives the owner a line a salesperson", () => {
    const deals = [
      deal({ jobId: "a", owner: "sam@co.example", stage: "lead", createdAt: ago(5), events: [] }),
      deal({ jobId: "b", owner: "sam@co.example", stage: "proposal", value: 10000 }),
      deal({ jobId: "c", owner: "jo@co.example", stage: "won" }),
    ];
    expect(
      teamLines(
        deals,
        [
          { email: "sam@co.example", name: "Sam" },
          { email: "jo@co.example", name: "Jo" },
        ],
        now,
      ),
    ).toEqual([
      { email: "sam@co.example", name: "Sam", fresh: 1, waiting: 1, inPlay: 2, value: 24890 },
      { email: "jo@co.example", name: "Jo", fresh: 0, waiting: 0, inPlay: 0, value: 0 },
    ]);
  });
});
