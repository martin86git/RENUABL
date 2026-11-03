import { describe, expect, it } from "vitest";
import { BUSINESS_KINDS } from "./business-kind";
import { SAMPLE_BUSINESSES, sampleByEmail, sampleOf } from "./staff-view";

describe("view as another kind of business", () => {
  it("has one sample business of each kind, on a domain nothing is delivered to", () => {
    expect(SAMPLE_BUSINESSES.map((s) => s.kind).sort()).toEqual(BUSINESS_KINDS.map((k) => k.kind).sort());
    expect(SAMPLE_BUSINESSES.every((s) => s.email.endsWith(".example"))).toBe(true);
    expect(SAMPLE_BUSINESSES.every((s) => /sample/i.test(s.name))).toBe(true);
  });
  it("finds a sample by kind and by email, and nothing else", () => {
    expect(sampleOf("installer")?.name).toMatch(/Installs/);
    expect(sampleOf("owner")).toBeNull();
    expect(sampleByEmail("SAMPLE-INSPECTOR@renuabl-staff.example")?.kind).toBe("inspector");
    expect(sampleByEmail("martin@renuabl.com.au")).toBeNull();
    expect(sampleByEmail(null)).toBeNull();
  });
});
