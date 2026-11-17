import { describe, expect, it } from "vitest";
import type { FeedDeal } from "./deal-feed";
import { dealContext, eventWords, solOnDeal, solProposes } from "./sol-on-deal";

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
  events: [{ kind: "opened", text: "Opened the proposal", at: ago(2), by: "Jo" }],
  sol: null,
  canCall: true,
  canEmail: true,
  phone: "0491 570 006",
  place: null,
  ...over,
});

describe("Sol's line on a deal", () => {
  it("says what last happened, with how long ago", () => {
    expect(solOnDeal(deal(), now).happened).toEqual({ text: "Jo opened the proposal.", ago: "2 h ago" });
  });

  it("says when nothing has happened yet", () => {
    expect(solOnDeal(deal({ events: [] }), now).happened?.text).toMatch(/Nothing has happened/);
  });

  it("quotes the customer, cut short when long", () => {
    const long = "a".repeat(300);
    const text = eventWords({ kind: "message", text: long, at: ago(1), by: "Jo" }, "Jo Citizen");
    expect(text.startsWith("Jo wrote: “")).toBe(true);
    expect(text.length).toBeLessThan(140);
  });

  it("names who did it, and Sol when it was him", () => {
    expect(eventWords({ kind: "email", text: "x", at: ago(1), by: "sam" }, "Jo Citizen")).toBe("sam emailed Jo.");
    expect(eventWords({ kind: "sol", text: "x", at: ago(1), by: "Sol" }, "Jo Citizen")).toBe("Sol wrote to Jo.");
    expect(eventWords({ kind: "note", text: "Jo opened their page.", at: ago(1), by: "Customer" }, "Jo Citizen")).toBe(
      "Jo opened their page.",
    );
    expect(eventWords({ kind: "note", text: "x", at: ago(1), by: "sam" }, "Jo Citizen")).toBe("sam added a note.");
  });

  it("gives Sol's lined-up email as what's next, with its countdown, and asks nothing of the team", () => {
    const line = solOnDeal(
      deal({ sol: { id: "p1", subject: "Checking in", firesAt: ago(-2), held: false, state: "counting" }, heat: "warm" }),
      now,
    );
    expect(line.next).toMatchObject({ text: "Email Jo: “Checking in”", state: "counting" });
    expect(line.next?.when).toMatch(/^Sends in/);
    expect(line.need).toBeNull();
  });

  it("asks the team to send a held email", () => {
    const line = solOnDeal(deal({ sol: { id: "p1", subject: "Checking in", firesAt: ago(-2), held: true, state: "held" } }), now);
    expect(line.next?.when).toBe("Held until you send it");
    expect(line.need?.move?.kind).toBe("review");
  });

  it("puts a customer waiting on a reply as what's needed", () => {
    const line = solOnDeal(deal({ events: [{ kind: "message", text: "Does it fit?", at: ago(1), by: "Jo" }] }), now);
    expect(line.need?.move).toMatchObject({ kind: "reply", label: "Reply to Jo" });
  });

  it("needs nothing when Sol and the record have it in hand", () => {
    const line = solOnDeal(deal(), now);
    expect(line.next).toBeNull();
    expect(line.need).toBeNull();
  });
});

describe("Sol putting the next step to you", () => {
  it("offers his drafted email in the first person, with yes and no", () => {
    const p = solProposes(
      deal({ sol: { id: "o1", subject: "Your home from above", firesAt: ago(-2), held: false, state: "waiting" } }),
      now,
    );
    expect(p.say).toBe("I've drafted an email to Jo: “Your home from above”. Want me to send it?");
    expect(p.yes).toEqual({ label: "Yes, send it", kind: "send" });
    expect(p.no).toBe("No");
    expect(p.draft).toBe(true);
  });

  it("puts a customer waiting on a reply first", () => {
    const p = solProposes(deal({ events: [{ kind: "message", text: "Any news?", at: ago(1), by: "Jo" }] }), now);
    expect(p.say).toMatch(/^Jo has written in/);
    expect(p.yes?.kind).toBe("reply");
  });

  it("says plainly when nothing needs you", () => {
    const p = solProposes(deal(), now);
    expect(p.yes).toBeNull();
    expect(p.say).toMatch(/Nothing needs you/);
  });
});

describe("A deal's context in a line", () => {
  it("gives the stage and how long, the heat, the latest thing and the design", () => {
    expect(dealContext(deal(), now)).toBe("Proposal sent for 8 days · Warm · Jo opened the proposal 2 h ago · 6.6 kW designed");
  });

  it("reads for a lead made today with nothing designed", () => {
    expect(dealContext(deal({ stage: "lead", createdAt: ago(1), projectId: null, kw: null, heat: null, events: [] }), now)).toBe(
      "Lead since today · nothing on the record yet · no design yet",
    );
  });
});
