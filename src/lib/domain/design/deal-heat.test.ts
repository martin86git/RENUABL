import { describe, expect, it } from "vitest";
import { boardPriority, dealClock, dealHeat, hasPulse, rankPulses, type DealPulse, type HeatInput } from "./deal-heat";

// Monday 2 November 2026, 10 am in Melbourne.
const now = new Date("2026-11-01T23:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const base = (extra: Partial<HeatInput> = {}): HeatInput => ({
  now,
  clock: dealClock(daysAgo(3), now),
  theirs: [],
  ours: [],
  calls: [],
  proposalOut: false,
  proposalOpened: false,
  emailOpened: false,
  ...extra,
});

describe("the deal clock", () => {
  it("counts down the usual 21 days by thirds, then over", () => {
    expect(dealClock(daysAgo(0), now)).toMatchObject({ day: 0, left: 21, band: "green", words: "21 days left" });
    expect(dealClock(daysAgo(8), now)?.band).toBe("amber");
    expect(dealClock(daysAgo(15), now)?.band).toBe("red");
    expect(dealClock(daysAgo(21), now)?.words).toBe("Last day");
    expect(dealClock(daysAgo(24), now)).toMatchObject({ band: "over", words: "3 days over" });
    expect(dealClock("not a date", now)).toBeNull();
  });

  it("reads a late-evening lead as a day old the next morning", () => {
    // 11 pm Sunday 1 November in Melbourne.
    expect(dealClock("2026-11-01T12:00:00Z", now)?.day).toBe(1);
  });
});

describe("the deal's temperature", () => {
  it("is warm with nothing either way", () => {
    expect(dealHeat(base())).toMatchObject({ heat: "warm", score: 0, reasons: [] });
  });

  it("warms with a recent, keen customer and a proposal they opened", () => {
    const h = dealHeat(
      base({ theirs: [{ at: daysAgo(1), text: "Happy to proceed, when can you start?" }], proposalOut: true, proposalOpened: true }),
    );
    expect(h.heat).toBe("hot");
    expect(h.reasons[0].text).toBe("Wrote to us yesterday");
    expect(h.reasons.map((r) => r.text)).toContain("Their latest message reads as ready to go");
  });

  it("cools when we are chasing, they step back, or the clock runs out", () => {
    const h = dealHeat(
      base({
        clock: dealClock(daysAgo(25), now),
        theirs: [{ at: daysAgo(20), text: "We've gone with another installer" }],
        ours: [{ at: daysAgo(10) }, { at: daysAgo(5) }],
      }),
    );
    expect(h.heat).toBe("cold");
    expect(h.reasons.map((r) => r.text)).toEqual(
      expect.arrayContaining([
        "2 of our messages unanswered",
        "Their latest message reads as stepping back",
        "Past the usual time to close",
      ]),
    );
  });

  it("only has a pulse while a deal is being sold", () => {
    expect(hasPulse("proposal")).toBe(true);
    expect(hasPulse("won")).toBe(false);
  });
});

describe("the board's order", () => {
  it("puts heat first, then the clock, and marks the top three not cold", () => {
    const clock = dealClock(daysAgo(18), now)!;
    const fresh = dealClock(daysAgo(1), now)!;
    const warm = dealHeat(base());
    expect(boardPriority(warm, clock)).toBeGreaterThan(boardPriority(warm, fresh));
    const p = (score: number, heat: "hot" | "warm" | "cold"): DealPulse => ({
      heat: { heat, score, reasons: [] },
      clock,
      priority: score * 10,
    });
    const ranked = rankPulses({ a: p(5, "hot"), b: p(1, "warm"), c: p(-2, "cold"), d: p(2, "warm"), e: p(0, "warm") });
    expect([ranked.a.rank, ranked.d.rank, ranked.b.rank, ranked.e.rank, ranked.c.rank]).toEqual([1, 2, 3, undefined, undefined]);
  });
});
