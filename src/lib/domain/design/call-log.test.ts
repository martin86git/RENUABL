import { describe, expect, it } from "vitest";
import {
  callDay,
  callerName,
  callsOf,
  comingWords,
  liveCallWords,
  loggedWords,
  outcomeTone,
  outcomeWords,
  todayCallsWords,
  todaysCalls,
  type CallComing,
  type CallLogEntry,
} from "./call-log";

const entry = (o: Partial<CallLogEntry>): CallLogEntry => ({
  id: "a",
  jobId: "j",
  customer: "Alex Example",
  deal: "Solar",
  at: "2026-11-08T01:00:00Z",
  who: "sol",
  by: "Sol",
  outcome: "talked",
  words: "",
  transcript: null,
  ...o,
});

describe("call log", () => {
  it("filters by who rang and puts the newest first", () => {
    const all = [
      entry({ id: "1", at: "2026-11-07T01:00:00Z" }),
      entry({ id: "2", who: "team", by: "sam@x.example", outcome: null, at: "2026-11-08T02:00:00Z" }),
      entry({ id: "3", at: "2026-11-08T03:00:00Z" }),
    ];
    expect(callsOf(all, "all").map((e) => e.id)).toEqual(["3", "2", "1"]);
    expect(callsOf(all, "sol").map((e) => e.id)).toEqual(["3", "1"]);
    expect(callsOf(all, "team").map((e) => e.id)).toEqual(["2"]);
  });

  it("names the caller and the outcome", () => {
    expect(callerName(entry({ by: "Revo" }))).toBe("Revo");
    expect(callerName(entry({ who: "team", by: "sam@x.example" }))).toBe("sam");
    expect(outcomeWords(entry({ outcome: "voicemail" }))).toBe("Left a voicemail");
    expect(outcomeWords(entry({ outcome: null }))).toBe("Call logged");
    expect(outcomeTone("booked")).toBe("good");
    expect(outcomeTone("callback")).toBe("needs");
    expect(outcomeTone("no-answer")).toBe("plain");
  });

  it("keeps logged words short and says what is lined up", () => {
    expect(loggedWords("a  b\n c")).toBe("a b c");
    expect(loggedWords("x".repeat(500), 10)).toHaveLength(10);
    expect(comingWords({ status: "calling", attempts: 1, mode: "lead" })).toBe("Placed, waiting to ring");
    expect(comingWords({ status: "waiting", attempts: 0, mode: "proposal" })).toBe("They asked for a call · next calling window");
    expect(comingWords({ status: "waiting", attempts: 2, mode: "lead" })).toContain("2 tries");
  });

  it("groups by the market's day", () => {
    const now = new Date("2026-11-08T05:00:00Z"); // 4pm Sunday in Melbourne
    expect(callDay("2026-11-08T00:30:00Z", now)).toBe("Today");
    expect(callDay("2026-11-07T03:00:00Z", now)).toBe("Yesterday");
    expect(callDay("2026-11-05T03:00:00Z", now)).toMatch(/Thu/);
  });
});

describe("today's calls", () => {
  const now = new Date("2026-11-12T03:00:00Z"); // 2pm in Melbourne
  const coming = (o: Partial<CallComing>): CallComing => ({
    id: "c",
    jobId: "j",
    customer: "Jo Example",
    deal: "Solar",
    mode: "lead",
    status: "calling",
    attempts: 1,
    at: now.toISOString(),
    by: "Charlie",
    ...o,
  });

  it("splits live, lined up and today's done calls", () => {
    const t = todaysCalls(
      {
        calls: [entry({ id: "old", at: "2026-11-10T01:00:00Z" }), entry({ id: "today", at: "2026-11-12T00:30:00Z" })],
        coming: [
          coming({ id: "on", phase: "on-call" }),
          coming({ id: "ring", phase: "ringing" }),
          coming({ id: "wait", status: "waiting", phase: "lined-up" }),
        ],
      },
      now,
    );
    expect(t.live.map((c) => c.id)).toEqual(["on", "ring"]);
    expect(t.lined.map((c) => c.id)).toEqual(["wait"]);
    expect(t.done.map((c) => c.id)).toEqual(["today"]);
    expect(todayCallsWords(t)).toBe("2 on a call now · 1 done today · 1 lined up");
    expect(todayCallsWords({ live: [], lined: [], done: [] })).toBeNull();
  });

  it("says what the assistant is doing, by its name and their first name", () => {
    expect(liveCallWords(coming({ phase: "on-call" }))).toBe("Charlie is on the call with Jo");
    expect(liveCallWords(coming({ phase: "ringing" }))).toBe("Charlie is ringing Jo…");
    expect(liveCallWords(coming({ phase: "lined-up", by: "", status: "waiting" }))).toBe("Sol will call Jo");
    // Handed to the phone line but not ringing yet: never "will call" beside "ringing".
    expect(liveCallWords({ ...coming({ phase: "lined-up" }), status: "calling" })).toBe("Charlie is about to call Jo");
  });
});
