import { describe, expect, it } from "vitest";
import { msbRuns, runWords } from "./msb-run";

describe("msbRuns", () => {
  it("measures each placed inverter to the switchboard", () => {
    const runs = msbRuns([{ x: 0, y: 0 }, {}, { x: 3, y: 4 }], { x: 6, y: 8 });
    expect(runs.map((r) => [r.index, r.metres])).toEqual([
      [0, 10],
      [2, 5],
    ]);
  });
  it("says nothing without a switchboard", () => {
    expect(msbRuns([{ x: 1, y: 1 }], null)).toEqual([]);
  });
  it("words", () => {
    expect(runWords(0.4)).toBe("under 1 m");
    expect(runWords(8.44)).toBe("8.4 m");
  });
});
