import { describe, expect, it } from "vitest";
import {
  agentFor,
  chipWords,
  cleanAgentSettings,
  countdownWords,
  DEFAULT_AGENT_SETTINGS,
  firesAt,
  outboxState,
  sendAt,
  shouldFire,
  windowsWords,
} from "./sol-agents";

// Melbourne is UTC+11 in November.
const mel = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+11:00`).toISOString();

describe("send windows", () => {
  it("goes at the next window at least half an hour after it was ready", () => {
    expect(firesAt(mel("2026-11-05", "08:00"), ["10:00", "14:00"])).toBe(mel("2026-11-05", "10:00"));
    expect(firesAt(mel("2026-11-05", "09:45"), ["10:00", "14:00"])).toBe(mel("2026-11-05", "14:00"));
    expect(firesAt(mel("2026-11-05", "15:00"), ["10:00", "14:00"])).toBe(mel("2026-11-06", "10:00"));
  });

  it("skips weekends and public holidays", () => {
    // Friday afternoon → Monday morning.
    expect(firesAt(mel("2026-11-06", "15:00"), ["10:00"])).toBe(mel("2026-11-09", "10:00"));
    // Melbourne Cup day, Tuesday 3 Nov 2026, is passed over.
    expect(firesAt(mel("2026-11-02", "15:00"), ["10:00"])).toBe(mel("2026-11-04", "10:00"));
  });

  it("rolls a missed window on rather than sending at night", () => {
    const ready = mel("2026-11-05", "08:00");
    expect(sendAt(ready, ["10:00", "14:00"], new Date(mel("2026-11-05", "11:30")))).toBe(mel("2026-11-05", "10:00"));
    expect(sendAt(ready, ["10:00", "14:00"], new Date(mel("2026-11-05", "12:30")))).toBe(mel("2026-11-05", "14:00"));
    expect(sendAt(ready, ["10:00", "14:00"], new Date(mel("2026-11-05", "21:00")))).toBe(mel("2026-11-06", "10:00"));
  });

  it("cleans settings to whole, safe windows", () => {
    expect(cleanAgentSettings(null)).toEqual(DEFAULT_AGENT_SETTINGS);
    const s = cleanAgentSettings({ sending: true, windows: ["14:00", "07:00", "09:15", "11:30", "14:00", "nope"], paused: ["won", "x"] });
    expect(s.windows).toEqual(["11:30", "14:00"]);
    expect(s.paused).toEqual(["won"]);
    expect(s.sending).toBe(true);
    expect(cleanAgentSettings({ sending: "yes" }).sending).toBe(false);
    expect(windowsWords(["10:00", "14:30"])).toBe("10 am and 2:30 pm");
  });
});

describe("countdown", () => {
  const now = new Date(mel("2026-11-05", "08:08"));
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
  const on = { ...DEFAULT_AGENT_SETTINGS, sending: true };
  it("only counts down while sending is on and nothing is paused", () => {
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: on })).toBe("counting");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: DEFAULT_AGENT_SETTINGS })).toBe("waiting");
    expect(outboxState({ stage: "proposal", held: true, hasEmail: true, settings: on })).toBe("held");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: { ...on, paused: ["proposal"] } })).toBe("paused");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: true, settings: { ...on, pausedAll: true } })).toBe("paused");
    expect(outboxState({ stage: null, held: false, hasEmail: true, settings: on })).toBe("paused");
    expect(outboxState({ stage: "proposal", held: false, hasEmail: false, settings: on })).toBe("no-email");
  });

  it("fires only when counting and its time has come", () => {
    const now = new Date(mel("2026-11-05", "10:01"));
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
