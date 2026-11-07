import { describe, expect, it } from "vitest";
import { agoWords, batteryOf, caption, feedOf, needsYou, suburbOfAddress, systemLine, type FeedDeal } from "./deal-feed";

const now = new Date("2026-11-06T05:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const deal = (over: Partial<FeedDeal> = {}): FeedDeal => ({
  jobId: "job_1",
  customer: "Jo Citizen",
  suburb: "Glen Waverley",
  title: "Solar and battery",
  stage: "proposal",
  value: 14890,
  kw: 6.6,
  batteryKwh: 13.5,
  projectId: "proj_1",
  sample: false,
  createdAt: ago(200),
  installDate: null,
  heat: "warm",
  heatWhy: [],
  clock: "12 days left",
  proposal: { opened: true },
  events: [{ kind: "opened", text: "Opened the proposal", at: ago(2) }],
  sol: null,
  canCall: true,
  canEmail: true,
  phone: null,
  place: null,
  ...over,
});

describe("deal feed", () => {
  it("says a customer waiting on a reply needs you", () => {
    const d = deal({ events: [{ kind: "message", text: "Does it fit?", at: ago(1), by: "Jo" }] });
    expect(needsYou(d, now)).toBe("Jo is waiting on a reply");
    expect(caption(d, now)).toMatch(/hasn't heard back/);
  });

  it("flags a new lead nobody has contacted, and a hot deal not called", () => {
    expect(needsYou(deal({ stage: "lead", createdAt: ago(1), events: [] }), now)).toMatch(/New lead/);
    expect(needsYou(deal({ heat: "hot" }), now)).toBe("Hot: worth a call today");
    expect(needsYou(deal({ heat: "hot", events: [{ kind: "call", text: "Spoke", at: ago(5) }] }), now)).toBeNull();
  });

  it("leaves a deal Sol has in hand alone, and says what he has lined up", () => {
    const d = deal({ sol: { subject: "Checking in", firesAt: ago(-2), held: false } });
    expect(needsYou(d, now)).toBeNull();
    expect(caption(d, now)).toMatch(/Sol has a follow-up lined up/);
  });

  it("orders by the latest activity and filters each view", () => {
    const a = deal({ jobId: "a", events: [{ kind: "opened", text: "", at: ago(5) }] });
    const b = deal({ jobId: "b", events: [{ kind: "message", text: "?", at: ago(1) }] });
    const c = deal({ jobId: "c", sol: { subject: "", firesAt: ago(-1), held: false }, events: [{ kind: "email", text: "", at: ago(3) }] });
    expect(feedOf([a, b, c], "all", now).map((d) => d.jobId)).toEqual(["b", "c", "a"]);
    expect(feedOf([a, b, c], "needs", now).map((d) => d.jobId)).toEqual(["b"]);
    expect(feedOf([a, b, c], "sol", now).map((d) => d.jobId)).toEqual(["c"]);
  });

  it("writes the small words", () => {
    expect(agoWords(ago(0.1), now)).toBe("6 min ago");
    expect(agoWords(ago(3), now)).toBe("3 h ago");
    expect(agoWords(ago(30), now)).toBe("Yesterday");
    expect(systemLine({ kw: 6.6, batteryKwh: 13.5, value: 14890 })).toBe("6.6 kW · 13.5 kWh battery · $14,890");
    expect(suburbOfAddress("12 Sample Street, Glen Waverley VIC 3150")).toBe("Glen Waverley");
    expect(suburbOfAddress("1 Sample St, Glen Waverley, VIC 3150, Australia")).toBe("Glen Waverley");
    expect(batteryOf({ batteryStorage: "13.5 kWh" })).toBe(13.5);
    expect(batteryOf({})).toBeNull();
  });
});
