import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readXlsxRows } from "@/lib/server/xlsx";
import { VERIFIED_RATES } from "../rebates";
import type { RoofModel } from "../roof-layout";
import { batteryCatalogue, inverterCatalogue, panelCatalogue } from "./catalogue";
import { DEFAULT_WORKSPACE, readSupplierList, type Workspace } from "./pricing";
import { costSystem, defaultQuote } from "./quote";
import { cleanDesign, facePanels, type Face } from "./roof-design";
import { NO_BILL_KW, SELF_DESIGN_LABELS, selfDesign, type SelfDesignInput } from "./self-design";
import { YIELD_PER_KW_DAY, shiftingKwhOf, systemSpecOf } from "./system";

const rows = readXlsxRows(readFileSync("src/lib/domain/__fixtures__/awm-price-list.xlsx"));
const workspace: Workspace = { ...DEFAULT_WORKSPACE, lists: [readSupplierList("awm.xlsx", rows, "2026-10-10")] };
const panel = panelCatalogue()[0];
const centre = { lat: -37.89, lng: 145.18 };

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
// A big north face and an east face beside it.
const north: Face = { id: "n", points: rect(-8, -4, 8, 4), angle: 0, landscape: false, setback: 0.3, facing: "N", tilt: 22, off: [] };
const east: Face = { id: "e", points: rect(9, -4, 14, 4), angle: 90, landscape: false, setback: 0.3, facing: "E", tilt: 22, off: [] };

let made = 0;
const base = (over: Partial<SelfDesignInput> = {}): SelfDesignInput => ({
  centre,
  faces: [north, east],
  model: null,
  panel: { sku: panel.sku, name: panel.name, watts: panel.watts, long: panel.long, short: panel.short },
  panelElectrical: panel.electrical,
  firstListed: panel,
  inverters: inverterCatalogue(),
  batteries: batteryCatalogue(),
  // A quarterly bill of $900: about 25 kWh a day.
  bill: { interval: "quarterly", amount: 900, supplyPerDay: 1.1, rate: 0.31, feedIn: 0.05 },
  selfUseShare: 0.35,
  yieldPerKwDay: YIELD_PER_KW_DAY,
  form: defaultQuote("3150").form,
  workspace,
  rates: VERIFIED_RATES,
  date: "2026-10-18",
  newId: (p) => `${p}${made++}`,
  ...over,
});
const panelsOn = (design: { faces: Face[] }, id: string) => facePanels(design.faces.find((f) => f.id === id)!).length;

// A home that uses a lot after dark (about 45 kWh a day on a $1,500 quarterly bill) on a roof too small to fill every
// evening: the best return stops at what the roof spares, the most independence holds the whole of the evenings.
const bigHome = { interval: "quarterly" as const, amount: 1500, supplyPerDay: 1.1, rate: 0.31, feedIn: 0.05 };
const smallNorth: Face = { ...north, points: rect(-5, -3, 5, 3) };
const smallEast: Face = { ...east, points: rect(6, -3, 9, 3) };

describe("the roof designing itself, for three outcomes", () => {
  const result = selfDesign(base({ bill: bigHome, faces: [smallNorth, smallEast] }));
  const by = (key: string) => result.options.find((o) => o.key === key)!;

  it("makes a design for the fastest payback, the best return and the most independence", () => {
    expect(result.from).toBe("traced");
    expect(result.options.map((o) => o.key)).toEqual(["payback", "return", "independence"]);
    for (const o of result.options) {
      expect(o.design.label).toBe(SELF_DESIGN_LABELS[o.key]);
      expect(o.design.goal).toBe(o.key);
      expect(o.design.inverters?.length).toBeGreaterThan(0);
      expect(o.figures.youPay).toBeGreaterThan(0);
      expect(o.figures.saving).toBeGreaterThan(0);
      expect(o.why.length).toBeGreaterThan(20);
    }
  });

  it("pays back soonest, for the least outlay, with panels alone", () => {
    const fast = by("payback").figures;
    expect(by("payback").design.battery).toBeUndefined();
    for (const o of result.options) {
      expect(fast.payback!).toBeLessThanOrEqual(o.figures.payback!);
      expect(fast.youPay).toBeLessThanOrEqual(o.figures.youPay);
    }
  });

  it("leaves the customer the most dollars ahead with the best return, battery and all", () => {
    const best = by("return");
    expect(best.design.battery?.qty).toBeGreaterThan(0);
    expect(best.design.battery?.backup).toBeUndefined();
    for (const o of result.options) expect(best.figures.netReturn!).toBeGreaterThanOrEqual(o.figures.netReturn!);
  });

  it("fills the whole roof for the most independence, with a module more than the evenings need, held for blackouts", () => {
    const most = by("independence");
    const all = facePanels(smallNorth).length + facePanels(smallEast).length;
    expect(most.figures.panels).toBe(all);
    const b = most.design.battery!;
    expect(b.backup).toBe(true);
    // About 45 kWh a day, 60% after dark, over what a battery gives back: the modules that hold it, and one more.
    const evenings = Math.ceil((((bigHome.amount / (365 / 4) - bigHome.supplyPerDay) / bigHome.rate) * 0.6) / 0.9 / b.kwh - 1e-9);
    expect(b.qty).toBe(evenings + 1);
    expect(most.figures.youPay).toBeGreaterThan(by("return").figures.youPay);
    for (const o of result.options) expect(most.figures.selfReliance!).toBeGreaterThanOrEqual(o.figures.selfReliance!);
  });

  it("puts the backup wiring on its quote, and leaves the held module out of the savings", () => {
    const design = by("independence").design;
    const lines = costSystem(systemSpecOf(design, panel), base().form, workspace).lines;
    expect(lines.some((l) => l.label === "Backup circuits for blackouts" && l.amount === workspace.install.backup)).toBe(true);
    const plain = costSystem(systemSpecOf(by("return").design, panel), base().form, workspace).lines;
    expect(plain.some((l) => l.label === "Backup circuits for blackouts")).toBe(false);
    expect(shiftingKwhOf(design)).toBe(design.battery!.kwh * (design.battery!.qty - 1));
  });

  it("fills the sunnier north face before the east one", () => {
    const fast = by("payback");
    const full = facePanels(smallNorth).length;
    expect(panelsOn(fast.design, "n")).toBe(Math.min(full, fast.figures.panels));
    if (fast.figures.panels <= full) expect(panelsOn(fast.design, "e")).toBe(0);
  });

  it("leaves alone the places someone switched off", () => {
    const blocked: Face = { ...smallNorth, off: [0, 1, 2] };
    const again = selfDesign(base({ bill: bigHome, faces: [blocked, smallEast] }));
    for (const o of again.options) expect(o.design.faces.find((f) => f.id === "n")!.off).toEqual(expect.arrayContaining([0, 1, 2]));
  });

  it("strings each design by rule, or says why not when the limits aren't on file", () => {
    // This panel's electrical limits aren't on file, so nothing can be checked against an inverter.
    expect(panel.electrical).toBeUndefined();
    expect(result.options.every((o) => !o.design.strings?.length)).toBe(true);
    expect(result.notes.some((n) => n.startsWith("Not strung:"))).toBe(true);
  });

  it("keeps the goal and the blackout wiring through saving", () => {
    const saved = cleanDesign(JSON.parse(JSON.stringify(by("independence").design)));
    expect(saved?.goal).toBe("independence");
    expect(saved?.battery?.backup).toBe(true);
    expect(cleanDesign({ ...by("return").design, goal: "biggest" })?.goal).toBeUndefined();
    expect(
      cleanDesign({ ...by("return").design, battery: { ...by("return").design.battery!, backup: "yes" } })?.battery?.backup,
    ).toBeUndefined();
  });
});

describe("a home whose best return already covers its evenings", () => {
  it("still makes the most independence, set apart by the blackout module and the whole roof", () => {
    const result = selfDesign(base());
    expect(result.options.map((o) => o.key)).toEqual(["payback", "return", "independence"]);
    const [, best, most] = result.options;
    expect(most.figures.batteryKwh).toBeGreaterThan(best.figures.batteryKwh - 1e-9);
    expect(most.design.battery?.backup).toBe(true);
  });
});

describe("without a bill, or a home that hardly uses power at night", () => {
  it("sizes to the usual home and says the bill would size it to the payback", () => {
    const result = selfDesign(base({ bill: null }));
    expect(result.notes.join(" ")).toMatch(/bill/);
    const fast = result.options.find((o) => o.key === "payback")!;
    expect(fast.figures.kw).toBeCloseTo(NO_BILL_KW, 0);
    expect(fast.figures.payback).toBeNull();
  });

  it("gives only the most independence a battery when the nights are small: one module for them, one for blackouts", () => {
    // $150 a quarter: a few kWh a day.
    const result = selfDesign(base({ bill: { interval: "quarterly", amount: 150, supplyPerDay: 1.1, rate: 0.31, feedIn: 0.05 } }));
    const most = result.options.find((o) => o.key === "independence")!;
    expect(most.design.battery).toMatchObject({ qty: 2, backup: true });
    expect(result.options.filter((o) => o.key !== "independence").every((o) => !o.design.battery)).toBe(true);
    expect(result.notes.join(" ")).toMatch(/battery would do little/);
  });
});

describe("where the panels come from", () => {
  it("uses Google's roof model when nothing is traced", () => {
    const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
    const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
    const slots = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 10; c++)
        slots.push({
          lat: centre.lat + (r * 1.75) / mLat,
          lng: centre.lng + (c * 1.05) / mLng,
          orientation: "PORTRAIT" as const,
          segment: 0,
          kwh: 600 - r,
        });
    const model: RoofModel = { panel: { heightM: 1.879, widthM: 1.045, watts: 400 }, faces: [{ azimuth: 0, pitch: 22 }], slots };
    const result = selfDesign(base({ faces: [], model }));
    expect(result.from).toBe("roof model");
    expect(result.options.length).toBeGreaterThan(0);
    for (const o of result.options) {
      expect(o.design.faces).toEqual([]);
      expect(o.design.loose?.length).toBe(o.figures.panels);
    }
  });

  it("says to trace the roof when there is nothing to go on", () => {
    const result = selfDesign(base({ faces: [], model: null }));
    expect(result.options).toEqual([]);
    expect(result.notes[0]).toMatch(/Trace the roof faces/);
  });
});

describe("choosing inverters that can be strung", () => {
  it("takes a slightly bigger inverter whose limits are on file over one that can't be strung", () => {
    // A 3 kW string inverter with no limits on file, smaller than any on file.
    const unknown = { sku: "NOFILE3", name: "Brand 3kW Single Phase String Inverter", kw: 3, phase: "single" as const, hybrid: false };
    const result = selfDesign(
      base({
        inverters: [unknown, ...inverterCatalogue()],
        bill: { interval: "quarterly", amount: 330, supplyPerDay: 1.1, rate: 0.31, feedIn: 0.05 },
      }),
    );
    const fast = result.options.find((o) => o.key === "payback")!;
    expect(fast.design.inverters?.some((i) => i.sku === "NOFILE3")).toBe(false);
    expect(fast.design.inverters?.every((i) => inverterCatalogue().find((c) => c.sku === i.sku)?.electrical)).toBe(true);
  });
});
