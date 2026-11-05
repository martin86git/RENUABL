import { describe, expect, it } from "vitest";
import {
  agentFor,
  agentOn,
  chipWords,
  cleanAgentSettings,
  countdownWords,
  DEFAULT_AGENT_SETTINGS,
  nextOpen,
  outboxState,
  sendAt,
  shouldFire,
  withinHours,
} from "./sol-agents";

// Melbourne is UTC+11 in November.
const mel = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+11:00`).toISOString();
const at = (day: string, hhmm: string) => new Date(mel(day, hhmm));

describe("business hours", () => {
  it("knows when it is open", () => {
    expect(withinHours(at("2026-11-05", "09:00"), "business")).toBe(true);
    expect(withinHours(at("2026-11-05", "16:59"), "business")).toBe(true);
    expect(withinHours(at("2026-11-05", "17:00"), "business")).toBe(false);
    expect(withinHours(at("2026-11-05", "08:30"), "business")).toBe(false);
    expect(withinHours(at("2026-11-05", "08:30"), "long")).toBe(true);
    // Saturday, and Melbourne Cup day.
    expect(withinHours(at("2026-11-07", "11:00"), "business")).toBe(false);
    expect(withinHours(at("2026-11-03", "11:00"), "business")).toBe(false);
  });

  it("finds the next opening", () => {
    expect(nextOpen(at("2026-11-05", "07:00"), "business")).toBe(mel("2026-11-05", "09:00"));
    expect(nextOpen(at("2026-11-05", "11:20"), "business")).toBe(mel("2026-11-05", "11:20"));
    expect(nextOpen(at("2026-11-06", "18:00"), "business")).toBe(mel("2026-11-09", "09:00"));
    expect(nextOpen(at("2026-11-02", "18:00"), "business")).toBe(mel("2026-11-04", "09:00"));
  });

  it("sends half an hour after it was ready, inside the hours", () => {
    expect(sendAt(mel("2026-11-05", "10:00"), "business", at("2026-11-05", "10:00"))).toBe(mel("2026-11-05", "10:30"));
    expect(sendAt(mel("2026-11-05", "16:45"), "business", at("2026-11-05", "16:45"))).toBe(mel("2026-11-06", "09:00"));
    expect(sendAt(mel("2026-11-05", "07:00"), "business", at("2026-11-05", "07:00"))).toBe(mel("2026-11-05", "09:00"));
  });

  it("never sends at night: a time that passed out of hours waits for the morning", () => {
    expect(sendAt(mel("2026-11-05", "16:00"), "business", at("2026-11-05", "21:00"))).toBe(mel("2026-11-06", "09:00"));
    // Passed, but still inside the hours: it goes now.
    expect(sendAt(mel("2026-11-05", "10:00"), "business", at("2026-11-05", "13:00"))).toBe(mel("2026-11-05", "10:30"));
  });
});

describe("settings", () => {
  it("cleans to agents on and the hours", () => {
    expect(cleanAgentSettings(null)).toEqual(DEFAULT_AGENT_SETTINGS);
    expect(cleanAgentSettings({ on: ["proposal", "nope", "won"], hours: "long" })).toEqual({ on: ["proposal", "won"], hours: "long" });
    expect(cleanAgentSettings({ on: "proposal", hours: "all night" })).toEqual({ on: [], hours: "business" });
  });

  it("reads older settings as the same agents on", () => {
    expect(cleanAgentSettings({ sending: true, windows: ["10:00"], paused: ["won"] }).on).toEqual(["lead", "designed", "proposal"]);
    expect(cleanAgentSettings({ sending: true, pausedAll: true }).on).toEqual([]);
    expect(cleanAgentSettings({ sending: false }).on).toEqual([]);
  });
});

describe("countdown", () => {
  const now = at("2026-11-05", "08:08");
  it("says how long in plain words", () => {
    expect(countdownWords(mel("2026-11-05", "10:00"), now)).toBe("in 1h 52m");
    expect(countdownWords(mel("2026-11-05", "08:20"), now)).toBe("in 12m");
    expect(countdownWords(mel("2026-11-05", "08:00"), now)).toBe("now");
    expect(countdownWords(mel("2026-11-05", "14:30"), now)).toBe("at 2:30 pm");
    expect(countdownWords(mel("2026-11-06", "10:00"), now)).toBe("at 10 am tomorrow");
    expect(countdownWords(mel("2026-11-09", "10:00"), now)).toBe("at 10 am Mon");
  });
});

describe("outbox state", () => {
  const on = { ...DEFAULT_AGENT_SETTINGS, on: ["proposal" as const] };
  it("counts down only while its agent is on", () => {
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: on })).toBe("counting");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: DEFAULT_AGENT_SETTINGS })).toBe("waiting");
    expect(outboxState({ stage: "won", held: false, hasEmail: true, settings: on })).toBe("waiting");
    expect(outboxState({ stage: null, held: false, hasEmail: true, settings: on })).toBe("waiting");
    expect(outboxState({ stage: "proposal", held: true, hasEmail: true, settings: on })).toBe("held");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: false, settings: on })).toBe("no-email");
    expect(agentOn(on, "proposal")).toBe(true);
    expect(agentOn(on, null)).toBe(false);
  });

  it("fires only when counting and its time has come", () => {
    const now = at("2026-11-05", "10:01");
    expect(shouldFire("counting", mel("2026-11-05", "10:00"), now)).toBe(true);
    expect(shouldFire("counting", mel("2026-11-05", "14:00"), now)).toBe(false);
    expect(shouldFire("waiting", mel("2026-11-05", "10:00"), now)).toBe(false);
    expect(chipWords("counting", mel("2026-11-05", "10:30"), now)).toBe("Sol emails in 29m");
  });

  it("maps deal stages to agents", () => {
    expect(agentFor("proposal")).toBe("proposal");
    expect(agentFor("installed")).toBeNull();
  });
});
