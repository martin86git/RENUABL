import { describe, expect, it } from "vitest";
import { DESIGNS_PER_TURN, cleanDesignShown, cleanDesignsShown, designHref } from "./sol-designs";
import { cleanTurns } from "./sol";

describe("a design Sol shows", () => {
  it("keeps the deal and a title", () => {
    expect(cleanDesignShown({ jobId: "job_abc123", title: "  Chloe Fraser ·\n 3 Sample St " })).toEqual({
      jobId: "job_abc123",
      title: "Chloe Fraser · 3 Sample St",
    });
  });

  it("refuses anything that isn't a deal id", () => {
    expect(cleanDesignShown({ jobId: "../x", title: "x" })).toBeNull();
    expect(cleanDesignShown({ jobId: "<svg>", title: "x" })).toBeNull();
    expect(cleanDesignShown(null)).toBeNull();
  });

  it("titles one without a title", () => {
    expect(cleanDesignShown({ jobId: "job_1" })?.title).toBe("Roof design");
  });

  it("shows each deal once, and only so many", () => {
    const many = ["job_1", "job_1", "job_2", "job_3"].map((jobId) => ({ jobId, title: jobId }));
    const kept = cleanDesignsShown(many);
    expect(kept.map((d) => d.jobId)).toEqual(["job_1", "job_2"].slice(0, DESIGNS_PER_TURN));
  });

  it("opens the deal with its design", () => {
    expect(designHref("job_1")).toBe("/design/deals/job_1?design=1");
  });

  it("is kept on Sol's turn, even with no words", () => {
    const [t] = cleanTurns([{ role: "sol", text: "", at: "2026-11-03T01:00:00.000Z", designs: [{ jobId: "job_1", title: "Chloe" }] }]);
    expect(t.designs).toEqual([{ jobId: "job_1", title: "Chloe" }]);
  });
});
