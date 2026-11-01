import { describe, expect, it } from "vitest";
import { cleanPrefs } from "./prefs";
import { SOL_JOIN_GAP_MINUTES, SOL_JOIN_PER_HOUR, SOL_PASS, mayStepIn, readStepIn, stepInPrompt, stillHisToTake } from "./sol-joins-in";

describe("a line Sol might step in on", () => {
  it("is a question asked in a channel", () => {
    expect(mayStepIn("grid", "What's the export limit on United Energy?")).toBe(true);
    expect(mayStepIn("installations", "how far does a battery need to be from a window")).toBe(true);
    expect(mayStepIn("deals", "Anyone know when Chloe's install is booked")).toBe(true);
  });
  it("is never in a direct conversation", () => {
    expect(mayStepIn("dm:a@x.com,b@x.com", "What's the export limit on United Energy?")).toBe(false);
  });
  it("leaves alone a question to a teammate, or one already asking him", () => {
    expect(mayStepIn("deals", "@sam when is Chloe's install booked?")).toBe(false);
    expect(mayStepIn("deals", "@Sol when is Chloe's install booked?")).toBe(false);
  });
  it("leaves alone remarks and short words", () => {
    expect(mayStepIn("deals", "Signed Chloe today, great work everyone")).toBe(false);
    expect(mayStepIn("deals", "ok?")).toBe(false);
    expect(mayStepIn("deals", "Thanks Sam!")).toBe(false);
  });
});

describe("whether it is still his to take after the wait", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  const base = { asker: "Sam@x.com", since: [], solLast: null, solThisHour: 0, now };
  it("is, when nobody has answered", () => {
    expect(stillHisToTake(base)).toBe(true);
    expect(stillHisToTake({ ...base, since: [{ by: "sam@x.com" }] })).toBe(true);
  });
  it("isn't once a teammate or Sol has answered", () => {
    expect(stillHisToTake({ ...base, since: [{ by: "ash@x.com" }] })).toBe(false);
    expect(stillHisToTake({ ...base, since: [{ by: "sol" }] })).toBe(false);
  });
  it("isn't while he spoke there moments ago, or has said a lot there this hour", () => {
    const justNow = new Date(now.getTime() - (SOL_JOIN_GAP_MINUTES * 60_000 - 1000));
    expect(stillHisToTake({ ...base, solLast: justNow })).toBe(false);
    expect(stillHisToTake({ ...base, solLast: new Date(now.getTime() - 60 * 60_000) })).toBe(true);
    expect(stillHisToTake({ ...base, solThisHour: SOL_JOIN_PER_HOUR })).toBe(false);
  });
});

describe("Sol's reply when unasked", () => {
  it("is nothing when he passes", () => {
    for (const r of ["PASS", " pass. ", "PASS\n", "", "PASS - not mine"]) expect(readStepIn(r)).toBeNull();
  });
  it("is his words otherwise", () => {
    expect(readStepIn(" Usually 5 kW per phase on United Energy. ")).toBe("Usually 5 kW per phase on United Energy.");
  });
  it("is asked with the way to pass, and never for costs or a customer's details", () => {
    const p = stepInPrompt({ channel: "Grid connections", asker: "Sam", question: "Export limit on UE?", context: "" });
    expect(p).toContain(SOL_PASS);
    expect(p).toMatch(/never a cost or margin/);
    expect(p).toMatch(/never a customer's phone or email/);
    expect(p).toContain("Export limit on UE?");
  });
});

describe("the business's switch", () => {
  it("is on unless switched off", () => {
    expect(cleanPrefs({}).solJoinsIn).toBe(true);
    expect(cleanPrefs({ solJoinsIn: false }).solJoinsIn).toBe(false);
    expect(cleanPrefs({ solJoinsIn: "no" }).solJoinsIn).toBe(true);
  });
});
