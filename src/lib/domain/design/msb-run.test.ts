import { describe, expect, it } from "vitest";
import { cleanDesign } from "./roof-design";
import { hitRun, labelAt, msbRuns, runWords } from "./msb-run";

describe("msbRuns", () => {
  it("measures each placed inverter to the switchboard", () => {
    const runs = msbRuns([{ x: 0, y: 0 }, {}, { x: 3, y: 4 }], { x: 6, y: 8 });
    expect(runs.map((r) => [r.index, r.metres])).toEqual([
      [0, 10],
      [2, 5],
    ]);
  });
  it("adds up the stretches through the bends", () => {
    const [run] = msbRuns([{ x: 0, y: 0, route: [{ x: 0, y: 4 }] }], { x: 3, y: 4 });
    expect(run.metres).toBe(7);
    expect(run.points).toHaveLength(3);
    expect(labelAt(run)).toEqual({ x: 0, y: 2 });
  });
  it("says nothing without a switchboard", () => {
    expect(msbRuns([{ x: 1, y: 1 }], null)).toEqual([]);
  });
  it("words", () => {
    expect(runWords(0.4)).toBe("under 1 m");
    expect(runWords(8.44)).toBe("8.4 m");
  });
});

describe("hitRun", () => {
  const [run] = msbRuns([{ x: 0, y: 0, route: [{ x: 0, y: 10 }] }], { x: 10, y: 10 });
  it("takes hold of a bend before the line", () => {
    expect(hitRun(run, { x: 0.2, y: 9.9 }, 0.5)).toEqual({ kind: "bend", bend: 0 });
  });
  it("puts a new bend into the stretch pressed", () => {
    expect(hitRun(run, { x: 0.1, y: 5 }, 0.5)).toEqual({ kind: "line", insertAt: 0 });
    expect(hitRun(run, { x: 5, y: 10.2 }, 0.5)).toEqual({ kind: "line", insertAt: 1 });
  });
  it("leaves the ends and empty roof alone", () => {
    expect(hitRun(run, { x: 0, y: 0.2 }, 0.5)).toBeNull();
    expect(hitRun(run, { x: 5, y: 5 }, 0.5)).toBeNull();
  });
});

describe("cleanDesign keeps a run's bends", () => {
  it("keeps them on the inverter", () => {
    const d = cleanDesign({
      lat: -37.9,
      lng: 145.1,
      faces: [],
      inverters: [{ sku: "SG5", name: "5 kW", kw: 5, x: 1, y: 2, route: [{ x: 3, y: 4 }, { x: "no" }] }],
    });
    expect(d?.inverters?.[0].route).toEqual([{ x: 3, y: 4 }]);
  });
});
