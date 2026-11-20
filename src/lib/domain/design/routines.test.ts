import { describe, expect, it } from "vitest";
import { daysWords, routineLive, routinesFor, runningCount, stepsOf, type RoutineFacts } from "./routines";
import { cleanAgentSettings, DEFAULT_AGENT_SETTINGS, firesAtFor } from "./sol-agents";
import { dueFollowUp } from "./proposal-lists";

const facts = (over: Partial<RoutineFacts> = {}): RoutineFacts => ({
  settings: DEFAULT_AGENT_SETTINGS,
  solAnswers: true,
  callsOn: true,
  voice: [
    { key: "sales", name: "Charlie", role: "sales", first: true, audience: "enquired", reason: "", script: "Main script", scripts: [] },
    { key: "admin", name: "Tim", role: "admin", first: false, audience: "enquired", reason: "", script: "Main script", scripts: [] },
  ],
  ...over,
});

describe("routines", () => {
  it("shows Sol's, then each voice agent's, then what is coming", () => {
    const r = routinesFor(facts());
    expect(r.map((x) => x.id)).toEqual(["sol-lead", "sol-proposal", "voice-sales", "voice-admin", "sol-designed", "sol-won"]);
    expect(r.find((x) => x.id === "sol-designed")?.soon).toBeTruthy();
  });

  it("follows the business's own settings", () => {
    const settings = cleanAgentSettings({ on: ["proposal"], followUpDays: [3, 10], reviewMinutes: 60, helloMinutes: 15, callAttempts: 2 });
    const r = routinesFor(facts({ settings }));
    const prop = r.find((x) => x.id === "sol-proposal")!;
    expect(prop.on).toBe(true);
    expect(prop.nodes.find((n) => n.kind === "loop")?.title).toBe("Repeats on day 3, 10");
    expect(prop.what).toContain("3 and 10 days");
    expect(stepsOf(prop).find((s) => s.id === "prop-wait")?.title).toBe("Waits an hour");
    expect(stepsOf(prop).find((s) => s.id === "prop-send")?.title).toBe("Sends the follow-up");
    const lead = r.find((x) => x.id === "sol-lead")!;
    expect(lead.on).toBe(false);
    expect(stepsOf(lead).find((s) => s.id === "lead-send")?.title).toMatch(/Waits for your press/);
    expect(stepsOf(lead).find((s) => s.id === "lead-wait")?.title).toBe("Waits 15 minutes");
    expect(r.find((x) => x.id === "voice-sales")!.nodes.find((n) => n.kind === "loop")?.title).toBe("Up to twice");
  });

  it("never lets the calling hours be changed", () => {
    const sales = routinesFor(facts()).find((x) => x.id === "voice-sales")!;
    const hours = stepsOf(sales).find((s) => s.id === "sales-hours")!;
    expect(hours.fixed).toBeTruthy();
    expect(hours.setting).toBeUndefined();
  });

  it("says a voice agent isn't running while calls aren't on", () => {
    const r = routinesFor(facts({ callsOn: false, callsWhy: "Calls & Texts isn't on your plan." }));
    expect(r.find((x) => x.id === "voice-sales")?.on).toBeNull();
    expect(runningCount(r)).toBe(0);
  });

  it("a cold-call agent says so", () => {
    const voice = facts().voice.map((v) => (v.key === "sales" ? { ...v, audience: "cold" as const } : v));
    expect(routinesFor(facts({ voice })).find((x) => x.id === "voice-sales")?.title).toBe("New numbers are cold called");
  });
});

describe("routine settings", () => {
  it("keeps only what can be chosen", () => {
    const s = cleanAgentSettings({ followUpDays: [14, 2, 2, 0, 99, 7, 5], reviewMinutes: 7, helloMinutes: 15, callAttempts: 9 });
    expect(s.followUpDays).toEqual([2, 5, 7]);
    expect(s.reviewMinutes).toBe(30);
    expect(s.helloMinutes).toBe(15);
    expect(s.callAttempts).toBe(3);
    expect(cleanAgentSettings({}).followUpDays).toEqual([2, 7, 14]);
  });

  it("an email waits as long as the routine says", () => {
    const at = "2026-11-17T00:00:00.000Z"; // Tuesday 11 am in Melbourne
    const s = { hours: "business" as const, reviewMinutes: 60, helloMinutes: 2 };
    expect(firesAtFor({ createdAt: at }, s, new Date(at))).toBe("2026-11-17T01:00:00.000Z");
    expect(firesAtFor({ createdAt: at, kind: "hello" }, s, new Date(at))).toBe("2026-11-17T00:02:00.000Z");
  });

  it("a follow-up falls due on the business's own days", () => {
    const base = { sentAt: "2026-11-02T00:00:00.000Z", now: new Date("2026-11-05T00:00:00.000Z"), done: [], lastWord: null };
    expect(dueFollowUp(base)?.day).toBe(2);
    expect(dueFollowUp({ ...base, days: [3, 10] })?.day).toBe(3);
    expect(dueFollowUp({ ...base, days: [4] })).toBeNull();
  });

  it("says the days plainly", () => {
    expect(daysWords([2, 7, 14])).toBe("2, 7 and 14 days");
    expect(daysWords([1])).toBe("1 day");
  });
});

describe("live counts on the steps", () => {
  const when = (iso: string) => `at ${iso.slice(11, 16)}`;
  const now = new Date("2026-11-20T00:00:00.000Z");
  const r = routinesFor(facts());

  it("counts Sol's emails waiting, waiting for a press, and sent", () => {
    const live = routineLive(
      r,
      {
        outbox: [
          { kind: "follow-up", jobId: "j1", customer: "Ann", firesAt: "2026-11-20T02:00:00.000Z", state: "counting" },
          { kind: "follow-up", jobId: "j2", customer: "Bo", firesAt: "2026-11-20T01:00:00.000Z", state: "counting" },
          { kind: "hello", jobId: "j3", customer: "Cy", firesAt: "2026-11-20T01:00:00.000Z", state: "waiting" },
        ],
        sent: [{ kind: "follow-up", jobId: "j4", customer: "Di", at: "2026-11-19T00:00:00.000Z" }],
        calls: {},
      },
      when,
      now,
    );
    expect(live["prop-wait"].words).toBe("2 waiting · next goes at 01:00");
    expect(live["prop-wait"].deals[0].customer).toBe("Bo");
    expect(live["prop-send"].words).toBe("1 sent this week");
    expect(live["lead-send"]).toMatchObject({ words: "1 waits for your press", tone: "press" });
    expect(live["lead-wait"]).toBeUndefined();
  });

  it("counts a voice agent's calls", () => {
    const live = routineLive(
      r,
      {
        outbox: [],
        sent: [],
        calls: {
          sales: [
            { jobId: "a", customer: "Ann", standing: "lined-up", dueAt: "2026-11-20T03:00:00.000Z" },
            { jobId: "b", customer: "Bo", standing: "lined-up", dueAt: "2026-11-20T01:00:00.000Z" },
            { jobId: "c", customer: "Cy", standing: "no-answer" },
            { jobId: "d", customer: "Di", standing: "needs-you" },
          ],
          admin: [{ jobId: "e", customer: "Ed", standing: "live" }],
        },
      },
      when,
      now,
    );
    expect(live["sales-ring"].words).toBe("2 calls lined up · next at 01:00");
    expect(live["sales-loop"].tone).toBe("press");
    expect(live["sales-answer"].words).toBe("1 wants the team to call back");
    expect(live["admin-offer"].words).toBe("On a call now with Ed");
  });
});
