import { describe, expect, it } from "vitest";
import {
  allClearWords,
  feedOf,
  isMarkLine,
  laterUntil,
  markHolds,
  markRecordLine,
  markWords,
  needsYou,
  nextMove,
  type FeedDeal,
} from "./deal-feed";

const now = new Date("2026-11-09T03:00:00Z"); // Monday 2 pm in Melbourne
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const deal = (over: Partial<FeedDeal> = {}): FeedDeal => ({
  jobId: "job_1",
  customer: "Jo Citizen",
  suburb: "Glen Waverley",
  title: "Solar",
  stage: "lead",
  value: null,
  kw: null,
  batteryKwh: null,
  projectId: null,
  sample: false,
  createdAt: ago(20),
  installDate: null,
  heat: "warm",
  heatWhy: [],
  clock: null,
  proposal: null,
  events: [],
  sol: null,
  canCall: true,
  canEmail: true,
  phone: "0491 570 006",
  place: null,
  ...over,
});

describe("Done and Later on the feed", () => {
  it("takes a deal out of Needs you, and its lit move away, while nothing new has happened", () => {
    const d = deal();
    expect(needsYou(d, now)).not.toBeNull();
    const done = deal({ mark: { kind: "done", until: null, need: "New lead", by: "sam@x.example", at: ago(1) } });
    expect(markHolds(done, now)).toBe(true);
    expect(needsYou(done, now)).toBeNull();
    expect(nextMove(done, now)).toBeNull();
    expect(feedOf([done], "needs", now)).toHaveLength(0);
    expect(feedOf([done], "all", now)).toHaveLength(1);
  });

  it("brings it back the moment something new happens on the deal", () => {
    const d = deal({
      events: [{ kind: "message", text: "Any news?", at: ago(0.5), by: "Jo" }],
      mark: { kind: "done", until: null, need: "New lead", by: "sam@x.example", at: ago(1) },
    });
    expect(markHolds(d, now)).toBe(false);
    expect(needsYou(d, now)).toBe("Jo is waiting on a reply");
  });

  it("holds a mark made in the same moment as the line it wrote on the record", () => {
    const at = ago(1);
    const d = deal({
      events: [{ kind: "note", text: "Marked done on Today.", at, by: "sam" }],
      mark: { kind: "done", until: null, need: "", by: "sam@x.example", at },
    });
    expect(markHolds(d, now)).toBe(true);
  });

  it("lets a Later run out", () => {
    const later = (until: string) => deal({ mark: { kind: "later", until, need: "", by: "sam@x.example", at: ago(1) } });
    expect(markHolds(later(ago(-2)), now)).toBe(true);
    expect(markHolds(later(ago(0.1)), now)).toBe(false);
  });

  it("works out when a Later comes back", () => {
    // Monday: tomorrow is Tuesday 9am Melbourne (22:00 UTC the day before); next week is next Monday 9am.
    expect(laterUntil("tomorrow", now)).toBe("2026-11-09T22:00:00.000Z");
    expect(laterUntil("week", now)).toBe("2026-11-15T22:00:00.000Z");
    expect(laterUntil("reply", now)).toBeNull();
    // Friday: tomorrow passes over the weekend.
    expect(laterUntil("tomorrow", new Date("2026-11-13T03:00:00Z"))).toBe("2026-11-15T22:00:00.000Z");
  });

  it("says what happened, on the record and on the card", () => {
    expect(markRecordLine("done", "Call Jo", null)).toBe("Marked done on Today: Call Jo.");
    expect(markRecordLine("later", "", null)).toBe("Put off on Today until they reply.");
    expect(markRecordLine("later", "Call Jo", "2026-11-09T22:00:00.000Z")).toMatch(/^Put off on Today until Tue.*9.*: Call Jo\.$/);
    expect(markWords({ kind: "done", until: null, need: "", by: "sam@x.example", at: ago(1) }, now)).toBe("Done by sam");
    expect(markWords({ kind: "later", until: null, need: "", by: "sam@x.example", at: ago(1) }, now)).toBe("Back when they reply");
  });

  it("knows its own lines on the record, so they aren't news on the card", () => {
    expect(isMarkLine(markRecordLine("done", "Call Jo", null))).toBe(true);
    expect(isMarkLine(markRecordLine("later", "", "2026-11-09T22:00:00.000Z"))).toBe(true);
    expect(isMarkLine("Spoke to Jo, marked done on the quote")).toBe(false);
  });

  it("counts the day's work beside All clear", () => {
    expect(allClearWords({ mine: 7, sol: 4 })).toBe("All clear. 7 done today. Sol sent 4.");
    expect(allClearWords({ mine: 0, sol: 0 })).toBe("All clear.");
    expect(allClearWords(null)).toBe("All clear.");
  });
});
