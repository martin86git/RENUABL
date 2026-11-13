import { describe, expect, it } from "vitest";
import {
  AGENT_KINDS,
  AGENT_WORDS,
  NEED_SETTINGS,
  agentNeeds,
  agentStanding,
  cleanAgentKind,
  kindsToAdd,
  needsNewNumber,
  numberRequestNote,
  type AgentStatus,
} from "./agents";

const status = (over: Partial<AgentStatus> = {}): AgentStatus => ({
  callsOn: true,
  browserCalls: true,
  teamLine: true,
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
    expect(AGENT_WORDS.sales.ownNumber).toBe(false);
    expect(AGENT_WORDS.admin.ownNumber).toBe(false);
    expect(AGENT_WORDS.colleague.ownNumber).toBe(true);
    expect(AGENT_WORDS.colleague.number).toContain("new phone number of its own");
  });
});

describe("what an agent needs", () => {
  it("a phone assistant needs only the customer number, already there once calls are on", () => {
    expect(agentNeeds("sales", status())).toEqual([expect.objectContaining({ key: "customer-number", state: "ready" })]);
    expect(needsNewNumber("admin", status())).toBe(false);
  });
  it("a phone assistant needs a number while calls are off", () => {
    expect(needsNewNumber("sales", status({ callsOn: false }))).toBe(true);
    expect(agentStanding("sales", status({ callsOn: false }))).toEqual({ ready: false, words: "Needs a phone number" });
  });
  it("the chief of staff needs a new number of its own to be rung from a phone", () => {
    const s = status({ teamLine: false });
    expect(needsNewNumber("colleague", s)).toBe(true);
    const own = agentNeeds("colleague", s).find((n) => n.key === "own-number");
    expect(own).toMatchObject({ state: "missing", optional: true, needsNumber: true });
    expect(own?.words).toContain("can't share the number your customers ring");
  });
  it("the chief of staff still works without its number, and says so", () => {
    expect(agentStanding("colleague", status({ teamLine: false }))).toEqual({
      ready: true,
      words: "Ready to chat · needs its own number to be rung from a phone",
    });
    expect(agentStanding("colleague", status({ browserCalls: false })).words).toContain("calling from this computer");
    expect(agentStanding("colleague", status())).toEqual({ ready: true, words: "Ready" });
  });
  it("the chief of staff isn't ready while it can't even be chatted to", () => {
    expect(agentStanding("colleague", status({ chat: false, teamLine: false })).ready).toBe(false);
  });
  it("has a setting named for every need, for staff", () => {
    for (const k of AGENT_KINDS) for (const n of agentNeeds(k, status())) expect(NEED_SETTINGS[n.key]).toBeTruthy();
  });
});

describe("adding one", () => {
  it("offers each kind once", () => {
    expect(kindsToAdd(status())).toEqual(["sales", "admin", "colleague"]);
    expect(kindsToAdd(status({ made: { sales: true, admin: false, colleague: true } }))).toEqual(["admin"]);
  });
});

describe("asking RENUABL for a number", () => {
  it("says who asked and why, and nothing of customers", () => {
    const note = numberRequestNote({
      business: "Sunrise Solar (example)",
      by: "sam@sunrise-solar.example",
      kind: "colleague",
      agentName: "Tim",
    });
    expect(note.subject).toBe("A phone number is wanted for Sunrise Solar (example)'s chief of staff");
    expect(note.text).toContain("Chief of staff (Tim)");
    expect(note.text).toContain("sam@sunrise-solar.example");
    expect(note.text).not.toMatch(/customer['’]?s? (name|phone|email)/i);
  });
});
