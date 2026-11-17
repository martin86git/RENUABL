import { describe, expect, it } from "vitest";
import { OPENING_WORDS, helloText, opensWithOptions } from "./lead-opening";

const lead = { stage: "lead" as const, proposal: null, events: [{ kind: "note" as const, text: "Came in", at: "2026-11-18T00:00:00Z" }] };

describe("Sol's opening on a new lead", () => {
  it("opens on a lead nobody has been in touch with", () => {
    expect(opensWithOptions(lead)).toBe(true);
    expect(opensWithOptions({ ...lead, stage: "designed" })).toBe(true);
  });

  it("stays away once someone has emailed, called or sent a proposal", () => {
    for (const kind of ["email", "call", "reply", "proposal"] as const)
      expect(opensWithOptions({ ...lead, events: [{ kind, text: "", at: "" }] })).toBe(false);
    expect(opensWithOptions({ ...lead, proposal: { opened: false } })).toBe(false);
    expect(opensWithOptions({ ...lead, stage: "won" })).toBe(false);
  });

  it("greets by first name", () => {
    expect(OPENING_WORDS.hello("Roberto Perezzi")).toMatch(/^Roberto just came in/);
  });

  it("texts the link with no price or promise", () => {
    const t = helloText({ firstName: "Roberto", business: "Sunrise Solar", url: "https://example.com/hello/abc" });
    expect(t).toContain("Hi Roberto,");
    expect(t).toContain("https://example.com/hello/abc");
    expect(t).not.toMatch(/\$|\d+\s?kW|guarantee/i);
    expect(t.length).toBeLessThan(300);
  });
});
