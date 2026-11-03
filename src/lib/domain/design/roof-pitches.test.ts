import { describe, expect, it } from "vitest";
import { MAX_ROOFS, cleanExtras } from "./quote";

const defaults = { bill: { interval: "quarterly" as const, amount: "", supplyPerDay: "1", rate: "0.3", feedIn: "0.04" }, postcode: "3150" };

describe("a home's other roofs", () => {
  it("keeps each roof's pitch, whole degrees in range, up to the most roofs", () => {
    const got = cleanExtras({ quotes: [{ form: { pitch: 22, pitchSet: true, pitches: [15.4, 90, "x", 5, 30, 40] } }] }, 1, defaults as never);
    expect(got.quotes[0].form.pitch).toBe(22);
    expect(got.quotes[0].form.pitches).toEqual([15, 5, 30].slice(0, MAX_ROOFS - 1));
  });
  it("has none unless they were added", () => {
    const got = cleanExtras({ quotes: [{ form: { pitch: 22 } }] }, 1, defaults as never);
    expect(got.quotes[0].form.pitches).toBeUndefined();
  });
});
