import { describe, expect, it } from "vitest";
import { byMonthAndWeek, dueFollowUp, followUpLine, sentOrder, sentStamp, systemWords } from "./proposal-lists";

// 18 Oct 2026, 3 pm in Melbourne (UTC+11).
const now = new Date("2026-10-18T04:00:00Z");
const sentDaysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("Proposals Sent", () => {
  it("is due its latest follow-up reached, until it is done or the customer writes", () => {
    expect(dueFollowUp({ sentAt: sentDaysAgo(1), now, done: [], lastWord: null })).toBeNull();
    expect(dueFollowUp({ sentAt: sentDaysAgo(3), now, done: [], lastWord: null })).toEqual({ step: 1, day: 2, age: 3 });
    expect(dueFollowUp({ sentAt: sentDaysAgo(8), now, done: [2], lastWord: null })).toMatchObject({ step: 2, day: 7 });
    expect(dueFollowUp({ sentAt: sentDaysAgo(8), now, done: [7], lastWord: null })).toBeNull();
    expect(dueFollowUp({ sentAt: sentDaysAgo(8), now, done: [], lastWord: sentDaysAgo(0) })).toBeNull();
    // Any email or chat reply from the business since it fell due counts as the follow-up; one before it doesn't.
    expect(dueFollowUp({ sentAt: sentDaysAgo(8), now, done: [], lastWord: null, lastTouch: sentDaysAgo(0) })).toBeNull();
    expect(dueFollowUp({ sentAt: sentDaysAgo(8), now, done: [], lastWord: null, lastTouch: sentDaysAgo(7) })).toMatchObject({
      step: 2,
    });
    expect(followUpLine({ step: 1, day: 2, age: 3 })).toBe("First follow-up due · day 2, sent 3 days ago");
  });

  it("puts those due a follow-up first, then the newest", () => {
    const rows = [
      { id: "a", at: sentDaysAgo(1), due: null },
      { id: "b", at: sentDaysAgo(9), due: { step: 2, day: 7, age: 9 } },
      { id: "c", at: sentDaysAgo(0), due: null },
    ];
    expect(sentOrder(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("says when it went out in the market's time", () => {
    expect(sentStamp("2026-10-18T04:04:00Z", now)).toMatchObject({ day: "18 Oct", time: "3:04 pm", ago: "today" });
    expect(sentStamp(sentDaysAgo(1), now).ago).toBe("yesterday");
  });

  it("describes the system", () => {
    expect(systemWords(6.6, 13.5)).toBe("6.60 kW with 13.5 kWh battery");
    expect(systemWords(6.6, 0)).toBe("6.60 kW");
  });
});

describe("Proposals Signed", () => {
  it("groups by month and by week starting Monday, newest first, with totals", () => {
    const groups = byMonthAndWeek([
      { signedAt: "2026-10-13T01:00:00Z", youPay: 10000 }, // Tue 13 Oct
      { signedAt: "2026-10-18T01:00:00Z", youPay: 5000 }, // Sun 18 Oct, same week
      { signedAt: "2026-10-01T01:00:00Z", youPay: 2000 }, // Thu 1 Oct: week of 28 September, so September
    ]);
    expect(groups.map((m) => [m.label, m.count, m.total])).toEqual([
      ["October 2026", 2, 15000],
      ["September 2026", 1, 2000],
    ]);
    expect(groups[0].weeks.map((w) => [w.label, w.rows.length, w.total])).toEqual([["Week of 12 October", 2, 15000]]);
    expect(groups[1].weeks[0].label).toBe("Week of 28 September");
  });
});
