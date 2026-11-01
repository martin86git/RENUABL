import { describe, expect, it } from "vitest";
import { readiness, readinessLight, type ReadinessInput } from "./readiness";

const good: ReadinessInput = {
  panels: 14,
  inverters: 1,
  strings: ["good", "good"],
  unstrung: 0,
  ratio: { percent: 120, limit: 133, over: false },
  tooClose: 0,
  pitchSet: true,
  undecided: [],
  missing: 0,
  solarVic: { on: false, bar: null },
  phase: "three",
  inverterKw: 5,
};

describe("ready to install", () => {
  it("goes green only when nothing needs fixing", () => {
    const items = readiness(good);
    expect(readinessLight(items)).toEqual({ ready: true, fix: 0, check: 0 });
  });
  it("asks for panels first, and nothing else, on an empty roof", () => {
    const items = readiness({ ...good, panels: 0 });
    expect(items).toHaveLength(1);
    expect(readinessLight(items).ready).toBe(false);
  });
  it("names a failing string by its letter, and unstrung panels", () => {
    const items = readiness({ ...good, strings: ["good", "bad"], unstrung: 2 });
    expect(items.find((i) => i.id === "strings")?.words).toContain("String B fails");
    expect(items.find((i) => i.id === "unstrung")?.words).toContain("2 panels aren't");
    expect(readinessLight(items).fix).toBe(2);
  });
  it("holds back for undecided costs, missing costs, the pitch and an inverter too small", () => {
    const items = readiness({
      ...good,
      undecided: ["Switchboard upgrade", "RCBO"],
      missing: 1,
      pitchSet: false,
      ratio: { percent: 140, limit: 133, over: true },
    });
    expect(items.find((i) => i.id === "costs")?.words).toBe("Include or leave out: switchboard upgrade, rcbo.");
    expect(readinessLight(items).fix).toBe(4);
  });
  it("only asks for a check when the edges can't be checked or a single-phase system is over 5 kW", () => {
    const items = readiness({ ...good, tooClose: null, phase: "single", inverterKw: 8 });
    const light = readinessLight(items);
    expect(light).toEqual({ ready: true, fix: 0, check: 2 });
    expect(items.find((i) => i.id === "export")?.words).toContain("8 kW of inverter on single phase");
  });
  it("won't pass a Solar Victoria rebate that can't apply", () => {
    const items = readiness({ ...good, solarVic: { on: true, bar: "Only for homes in Victoria." } });
    expect(items.find((i) => i.id === "solarVic")?.state).toBe("fix");
  });
});
