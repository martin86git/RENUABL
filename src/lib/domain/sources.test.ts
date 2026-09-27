import { describe, expect, it } from "vitest";
import { PLAN_ASSURANCE, PLAN_HEADLINE, planChecks } from "./sources";

const vic = { state: "VIC", lat: -37.88, lng: 145.16, placeId: "p1" };

describe("plan checks", () => {
  it("names Google Maps, NASA POWER, the Clean Energy Regulator and Solar Victoria for a Victorian home", () => {
    expect(planChecks({ address: vic }).map((c) => c.id)).toEqual(["google", "nasa", "cer", "solar-vic"]);
  });

  it("only credits Google and NASA when their data is actually used", () => {
    const ids = planChecks({ address: { ...vic, placeId: undefined }, sunshineUnavailable: true }).map((c) => c.id);
    expect(ids).toEqual(["sunshine-typical", "cer", "solar-vic"]);
    expect(planChecks({ address: { state: "VIC" } }).map((c) => c.id)).not.toContain("nasa");
  });

  it("leaves out Solar Victoria outside Victoria", () => {
    expect(planChecks({ address: { ...vic, state: "NSW" } }).map((c) => c.id)).not.toContain("solar-vic");
  });

  it("never claims exactness", () => {
    const text = [PLAN_HEADLINE, PLAN_ASSURANCE, ...planChecks({ address: vic }).flatMap((c) => [c.name, c.detail])].join(" ");
    expect(text.toLowerCase()).not.toMatch(/\bexact|guarantee|precise/);
  });
});
