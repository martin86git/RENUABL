import { describe, expect, it } from "vitest";
import {
  AGENT_KINDS,
  AGENT_WORDS,
  NEED_SETTINGS,
  NUMBER_MONTHLY_CENTS,
  agentNeeds,
  agentStanding,
  cleanAgentKind,
  kindsToAdd,
  needsNewNumber,
  numberPriceWords,
  numberRequestNote,
  type AgentStatus,
} from "./agents";
import { COLLEAGUE_CALLS } from "./colleague-chat";

const status = (over: Partial<AgentStatus> = {}): AgentStatus => ({
  callsOn: true,
  chat: true,
  made: { sales: false, admin: false, colleague: false },
  ...over,
});

describe("the kinds of agent", () => {
  it("are read only from the list", () => {
    expect(cleanAgentKind("colleague")).toBe("colleague");
    expect(cleanAgentKind("boss")).toBeNull();
    expect(cleanAgentKind(undefined)).toBeNull();
  });
  it("each say whether a number is needed before they are made", () => {
    for (const k of AGENT_KINDS) expect(AGENT_WORDS[k].number).toMatch(/number/);
  });
  it("share one business number between the phone agents, and the chief of staff uses none", () => {
    expect(AGENT_WORDS.sales.usesNumber).toBe(true);
    expect(AGENT_WORDS.admin.usesNumber).toBe(true);
    expect(AGENT_WORDS.admin.number).toContain("the same one your sales assistant uses");
    expect(AGENT_WORDS.colleague.usesNumber).toBe(false);
    expect(AGENT_WORDS.colleague.number).toContain("needs no phone number");
  });
  it("never offer a call to the chief of staff while its calls are off", () => {
    expect(COLLEAGUE_CALLS).toBe(false);
    expect(AGENT_WORDS.colleague.does).not.toMatch(/call/i);
  });
});

describe("what an agent needs", () => {
  it("a phone agent needs only the business number, already there once it is set up", () => {
    expect(agentNeeds("sales", status())).toEqual([expect.objectContaining({ key: "business-number", state: "ready" })]);
    expect(needsNewNumber("admin", status())).toBe(false);
    expect(agentStanding("sales", status())).toEqual({ ready: true, words: "Ready" });
  });
  it("a phone agent can't ring until the business has bought its number", () => {
    const s = status({ callsOn: false });
    expect(needsNewNumber("sales", s)).toBe(true);
    expect(needsNewNumber("admin", s)).toBe(true);
    expect(agentStanding("admin", s)).toEqual({ ready: false, words: "Needs your business phone number" });
  });
  it("the chief of staff never needs a number", () => {
    for (const callsOn of [true, false]) {
      expect(needsNewNumber("colleague", status({ callsOn }))).toBe(false);
      expect(agentStanding("colleague", status({ callsOn }))).toEqual({ ready: true, words: "Ready to chat" });
    }
    expect(agentStanding("colleague", status({ chat: false }))).toEqual({ ready: false, words: "Not switched on yet" });
  });
  it("has a setting named for every need, for staff", () => {
    for (const k of AGENT_KINDS) for (const n of agentNeeds(k, status())) expect(NEED_SETTINGS[n.key]).toBeTruthy();
  });
});

describe("the number's price", () => {
  it("isn't shown or charged until it is set", () => {
    expect(NUMBER_MONTHLY_CENTS).toBeNull();
    expect(numberPriceWords(null)).toContain("confirm the price with you before anything is charged");
    expect(numberPriceWords(null)).not.toMatch(/\$/);
  });
  it("is said as a monthly extra on the plan once set", () => {
    expect(numberPriceWords(1900)).toBe("It adds $19 a month to your plan, including GST.");
    expect(numberPriceWords(1950)).toBe("It adds $19.50 a month to your plan, including GST.");
  });
});

describe("adding one", () => {
  it("offers each kind once", () => {
    expect(kindsToAdd(status())).toEqual(["sales", "admin", "colleague"]);
    expect(kindsToAdd(status({ made: { sales: true, admin: false, colleague: true } }))).toEqual(["admin"]);
  });
});

describe("asking RENUABL for the business number", () => {
  it("says who asked, that the price comes first, and nothing of customers", () => {
    const note = numberRequestNote({
      business: "Sunrise Solar (example)",
      by: "sam@sunrise-solar.example",
      kind: "admin",
      agentName: "Alex",
    });
    expect(note.subject).toBe("Sunrise Solar (example) wants its business phone number");
    expect(note.text).toContain("Admin assistant (Alex)");
    expect(note.text).toContain("sam@sunrise-solar.example");
    expect(note.text).toContain("Confirm the price with them before anything is charged");
    expect(note.text).not.toMatch(/customer['’]?s? (name|phone|email)/i);
  });
});

describe("each agent's job on the rail", () => {
  it("is a couple of words, different for each, and says who rings and who writes", () => {
    const jobs = AGENT_KINDS.map((k) => AGENT_WORDS[k].job);
    expect(new Set(jobs).size).toBe(jobs.length);
    for (const j of jobs) expect(j.length).toBeLessThanOrEqual(14);
    expect(AGENT_WORDS.sales.job).toMatch(/calls/i);
    expect(AGENT_WORDS.admin.job).toMatch(/install/i);
    expect(AGENT_WORDS.colleague.job).not.toMatch(/call/i);
    expect(AGENT_WORDS.colleague.jobLine).toContain("in writing");
  });
});
