import { describe, expect, it } from "vitest";
import { EXAMPLE_DEALS, exampleAddress, exampleEmail, mayHaveExamples } from "./example-deals";

describe("example deals", () => {
  it("only go to a made-up business", () => {
    expect(mayHaveExamples("sample-retailer@renuabl-staff.example")).toBe(true);
    expect(mayHaveExamples("martin@primerosolar.com.au")).toBe(false);
  });

  it("are plainly fictional: example.com, Sample Street, the fiction range of mobiles", () => {
    EXAMPLE_DEALS.forEach((d, i) => {
      expect(exampleEmail(d)).toMatch(/@example\.com$/);
      expect(exampleAddress(d, i)).toMatch(/Sample Street/);
      expect(d.phone.replace(/\s/g, "")).toMatch(/^049157\d{4}$/);
    });
  });

  it("cover every kind of card", () => {
    const stages = new Set(EXAMPLE_DEALS.map((d) => d.stage));
    for (const s of ["lead", "designed", "proposal", "won", "ordered", "scheduled"]) expect(stages).toContain(s);
    expect(EXAMPLE_DEALS.some((d) => d.events.some((e) => e.on === "chat" && e.from === "them"))).toBe(true);
  });
});
