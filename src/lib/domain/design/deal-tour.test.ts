import { describe, expect, it } from "vitest";
import { DEAL_TOUR, SAMPLE_DEAL_HINT } from "./deal-tour";

describe("the tour of a deal", () => {
  it("lights a different place at every step", () => {
    expect(DEAL_TOUR.length).toBeGreaterThanOrEqual(8);
    expect(new Set(DEAL_TOUR.map((s) => s.at)).size).toBe(DEAL_TOUR.length);
    for (const s of DEAL_TOUR) expect(s.at).toMatch(/^(\[data-tour="deal-[a-z-]+"\]|nav\[aria-label="This deal"\])$/);
  });
  it("starts by saying the deal is made up, and ends with the way back and the way to remove it", () => {
    expect(DEAL_TOUR[0].what).toMatch(/sample deal/i);
    expect(DEAL_TOUR[0].now).toMatch(/made up/);
    expect(DEAL_TOUR.at(-1)!.now).toMatch(/pipeline/);
    expect(DEAL_TOUR.at(-1)!.now).toMatch(/Delete it/);
  });
  it("covers what a deal's page holds", () => {
    const text = DEAL_TOUR.map((s) => `${s.what} ${s.now}`).join(" ");
    for (const word of ["Sol", "Design", "Proposal", "Call", "Email", "Files", "Details", "Notes", "stage", "job card", "Service"])
      expect(text).toContain(word);
  });
  it("keeps each step short and makes no claims", () => {
    for (const s of DEAL_TOUR) expect(`${s.what} ${s.now}`.length).toBeLessThan(230);
    const text = DEAL_TOUR.map((s) => `${s.what} ${s.now}`).join(" ") + SAMPLE_DEAL_HINT;
    expect(text).not.toMatch(/guarantee|\bbest\b|leading|\bAI\b|—/i);
  });
});
