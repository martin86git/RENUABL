import { describe, expect, it } from "vitest";
import { cleanSinceDay, contactCountsWords } from "./contact-counts";

describe("contact counts for Sol", () => {
  it("reads only a real day", () => {
    expect(cleanSinceDay("2026-11-20")).toBe("2026-11-20");
    expect(cleanSinceDay("2026-02-30")).toBeNull();
    expect(cleanSinceDay("last week")).toBeNull();
    expect(cleanSinceDay(undefined)).toBeNull();
  });

  it("says the totals, the Pylon import and what came after it", () => {
    const words = contactCountsWords({
      people: 2300,
      customers: 2100,
      bySource: [
        { source: "Pylon", people: 2181 },
        { source: "Lead inbox", people: 40 },
      ],
      imports: [{ source: "pylon", brought: 2242, first: "2026-11-20", last: "2026-11-22" }],
      sinceImport: [{ source: "pylon", after: "2026-11-22", people: 52 }],
      since: null,
    });
    expect(words).toContain("2300 (2100 customers with a job installed, 200 contacts)");
    expect(words).toContain("Brought in from Pylon from 2026-11-20 to 2026-11-22: 2242 records.");
    expect(words).toContain("Added since the last Pylon import finished (2026-11-22), not by an import: 52.");
  });

  it("says when nothing was imported", () => {
    const words = contactCountsWords({
      people: 3,
      customers: 0,
      bySource: [],
      imports: [],
      sinceImport: [],
      since: { day: "2026-11-01", people: 3, customers: 0 },
    });
    expect(words).toContain("Nothing has been brought in");
    expect(words).toContain("Added since 2026-11-01 (that day included): 3, of whom 0");
  });
});
