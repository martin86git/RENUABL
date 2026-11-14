import { describe, expect, it } from "vitest";
import { panelCounts, panelDeals, panelMark, type FeedDeal } from "./deal-feed";

const now = new Date("2026-11-06T03:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const deal = (over: Partial<FeedDeal> = {}): FeedDeal => ({
  jobId: "job_1",
  customer: "Jo Citizen",
  suburb: "Glen Waverley",
  title: "Solar",
  stage: "proposal",
  value: 14890,
  kw: 6.6,
  batteryKwh: null,
  projectId: "proj_1",
  sample: false,
  createdAt: ago(200),
  installDate: null,
  heat: null,
  heatWhy: [],
  clock: null,
  proposal: { opened: false },
  events: [{ kind: "opened", text: "Opened", at: ago(5) }],
  sol: null,
  canCall: true,
  canEmail: true,
  phone: null,
  place: null,
  ...over,
});

describe("the deals panel", () => {
  const lead = deal({ jobId: "lead", stage: "lead", events: [], customer: "Ann Lee" });
  const asked = deal({ jobId: "asked", stage: "won", events: [{ kind: "message", text: "?", at: ago(1), by: "Bo" }] });
  const sent = deal({ jobId: "sent", events: [{ kind: "opened", text: "Opened", at: ago(30) }] });
  const sold = deal({ jobId: "sold", stage: "won", events: [{ kind: "stage", text: "Won", at: ago(2) }] });
  const all = [lead, asked, sent, sold];

  it("splits new leads from deals in progress, and puts a reply needed first, then proposals out", () => {
    expect(panelDeals(all, "new", "").map((d) => d.jobId)).toEqual(["lead"]);
    expect(panelDeals(all, "progress", "").map((d) => d.jobId)).toEqual(["asked", "sent", "sold"]);
    expect(panelDeals(all, "all", "")).toHaveLength(4);
  });

  it("finds a deal by every word", () => {
    expect(panelDeals(all, "all", "ann lee").map((d) => d.jobId)).toEqual(["lead"]);
    expect(panelDeals(all, "all", "nobody")).toEqual([]);
  });

  it("marks a reply needed and where a proposal is, and counts them", () => {
    expect(panelMark(asked)).toEqual({ words: "Reply needed", tone: "reply" });
    expect(panelMark(sent)?.words).toBe("Proposal sent · not opened");
    expect(panelMark(sold)).toBeNull();
    expect(panelCounts(all)).toEqual({ fresh: 1, progress: 3, waiting: 1 });
  });
});
