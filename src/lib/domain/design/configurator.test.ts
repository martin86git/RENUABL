import { describe, expect, it } from "vitest";
import {
  chosenWords,
  configKey,
  holdMessage,
  isConfigKey,
  nearestVariant,
  panelChoices,
  pickOf,
  readConfigurator,
  sizeCounts,
  solarOnly,
  trimDesign,
  variantOf,
  withBattery,
  withPanel,
} from "./configurator";
import { COST_WORDS, buildProposal, internalForChoice, viewForChoice } from "./proposal";
import { sampleInputs, sampleSet } from "./proposal-fixture";
import { designPanels, panelAspects, panelOf } from "./roof-design";
import { yearOnPlane } from "./tilt";

const built = (over: Parameters<typeof sampleInputs>[0] = {}) => {
  const result = buildProposal(sampleInputs(over));
  if (!result.ok) throw new Error(result.problems.join(" "));
  return result;
};

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, found));
  else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      keysOf(inner, found);
    }
  return found;
}

// 19 Nov 2026, Martin: the proposal as Tesla would sell it. The layout is fixed, so sizes are worked back from the
// drawn design; the panel's maker and a battery can be swapped on any size.
describe("the configurator's sizes", () => {
  it("are the design as drawn, then smaller, never under the minimum or twice", () => {
    expect(sizeCounts(20)).toEqual([20, 16, 12]);
    expect(sizeCounts(8)).toEqual([8, 6]);
    expect(sizeCounts(6)).toEqual([6]);
    expect(sizeCounts(4)).toEqual([4]);
    expect(sizeCounts(10)).toEqual([10, 8, 6]);
  });
  it("take the least sunny panels off first, and the strings with them", () => {
    const design = { ...sampleSet().designs[0], strings: [{ id: "s1", panels: [] }] } as never;
    const all = designPanels(design);
    const trimmed = trimDesign(design, all.length - 3);
    expect(designPanels(trimmed)).toHaveLength(all.length - 3);
    expect(trimmed.strings).toBeUndefined();
    // Nothing kept is less sunny than anything taken off.
    const sun = (d: typeof design) => panelAspects(d).map((a) => yearOnPlane(a.tilt, a.facing));
    const kept = new Set(designPanels(trimmed).map((p) => p.key));
    const allSun = sun(design);
    const keptSun = all.flatMap((p, i) => (kept.has(p.key) ? [allSun[i]] : []));
    const goneSun = all.flatMap((p, i) => (kept.has(p.key) ? [] : [allSun[i]]));
    expect(Math.min(...keptSun)).toBeGreaterThanOrEqual(Math.max(...goneSun));
    expect(trimDesign(design, all.length + 5)).toBe(design);
  });
  it("keep a swapped panel in the same places, and take a battery on or off", () => {
    const design = sampleSet(true).designs[0];
    const swapped = withPanel(design, { sku: "TRINA-440", name: "Trina 440W", watts: 440 });
    expect(designPanels(swapped)).toHaveLength(designPanels(design).length);
    expect(panelOf(swapped)).toMatchObject({ watts: 440, long: panelOf(design).long, short: panelOf(design).short });
    expect(withBattery(design, null).battery).toBeUndefined();
  });
  it("offer the panel designed with, then the nearest of other makers", () => {
    const designed = { sku: "J", name: "Jinko 475W", watts: 475 };
    const listed = [
      { sku: "J2", name: "Jinko 440W", watts: 440 },
      { sku: "T1", name: "Trina 470W", watts: 470 },
      { sku: "T2", name: "Trina 400W", watts: 400 },
      { sku: "A1", name: "Aiko 478W", watts: 478 },
      { sku: "L1", name: "LONGi 430W", watts: 430 },
    ];
    expect(panelChoices(designed, listed).map((p) => p.sku)).toEqual(["J", "A1", "T1"]);
  });
});

describe("a proposal with the configurator", () => {
  const { view, internal } = built({ withBattery: true });
  const cfg = view.configurator!;
  const solar = (size: number) => nearestVariant(cfg, { size, panel: 0, battery: null, ev: false, backup: false })!;
  const withBatt = (size: number, backup = false) => nearestVariant(cfg, { size, panel: 0, battery: 0, ev: false, backup })!;

  it("prices every mix on publishing, largest size first, and starts as designed", () => {
    expect(cfg.sizes.length).toBeGreaterThan(1);
    expect(cfg.sizes[0].panels).toBe(view.system.panels);
    for (let i = 1; i < cfg.sizes.length; i++) expect(cfg.sizes[i].panels).toBeLessThan(cfg.sizes[i - 1].panels);
    const start = cfg.variants.find((v) => v.goal === cfg.start)!;
    expect(pickOf(start)).toEqual({ size: 0, panel: 0, battery: 0, ev: false, backup: false });
    expect(start.price.youPay).toBe(view.price.youPay);
    // Each mix's own side is kept for the order, under the same key.
    expect(internal.configurator!.map((x) => x.goal).sort()).toEqual(cfg.variants.map((v) => v.goal).sort());
  });
  it("prices less for fewer panels and for no battery, more for blackout backup", () => {
    expect(withBatt(1).price.youPay).toBeLessThan(withBatt(0).price.youPay);
    expect(solar(0).price.youPay).toBeLessThan(withBatt(0).price.youPay);
    const backup = withBatt(0, true);
    expect(backup.backup).toBe(true);
    expect(backup.price.youPay).toBeGreaterThan(withBatt(0).price.youPay);
    expect(backup.system.batteryKwh).toBeGreaterThan(withBatt(0).system.batteryKwh);
  });
  it("offsets more of the home's power with a battery, and saves more", () => {
    const alone = solarOnly(cfg, withBatt(0))!;
    expect(alone.batteryId).toBeNull();
    expect(withBatt(0).bill!.selfReliance).toBeGreaterThan(alone.bill!.selfReliance);
    expect(withBatt(0).bill!.saving).toBeGreaterThan(alone.bill!.saving);
  });
  it("offers the batteries that fit, each a maker of its own, and an EV charger when one is listed", () => {
    const makers = cfg.batteries.filter((b) => b.size === 0).map((b) => b.maker);
    expect(makers.length).toBeGreaterThan(0);
    expect(new Set(makers).size).toBe(makers.length);
    if (cfg.charger) {
      const ev = nearestVariant(cfg, { size: 0, panel: 0, battery: 0, ev: true, backup: false })!;
      expect(ev.ev).toBe(true);
      expect(ev.price.youPay).toBeGreaterThan(withBatt(0).price.youPay);
    }
  });
  it("shows the chosen mix's roof, system and price, and its own lines for the order", () => {
    const key = configKey({ size: 1, panel: 0, battery: null, ev: false, backup: false });
    const shown = viewForChoice(view, key);
    expect(shown.roof.panels).toHaveLength(cfg.sizes[1].panels);
    expect(shown.system.batteryKwh).toBe(0);
    expect(shown.price.youPay).toBe(solar(1).price.youPay);
    expect(internalForChoice(internal, key).lines).toEqual(internal.configurator!.find((x) => x.goal === key)!.lines);
    expect(variantOf(cfg, "cfg-9-9-n-00")).toBeNull();
    expect(isConfigKey("design-1")).toBe(false);
    // The first proposals' keys are still read.
    expect(isConfigKey("cfg-0-1-b")).toBe(true);
  });
  it("sends the customer no cost, margin or product code", () => {
    const keys = keysOf(cfg);
    for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
  });
  it("tells the business what was ordered, and to update the design when it differs", () => {
    expect(chosenWords(cfg, cfg.start)).not.toMatch(/Update the design/);
    expect(chosenWords(cfg, configKey({ size: 1, panel: 0, battery: null, ev: false, backup: false }))).toMatch(
      /no battery. Update the design/,
    );
    expect(holdMessage(cfg, cfg.start, "the week of 8 December")).toMatch(/^I'd like to order .*installed the week of 8 December/);
  });
  it("reads a first proposal's configurator as today's", () => {
    const old = {
      ...cfg,
      batteries: [{ size: 0, kwh: 16, name: "Sigenergy 8 kWh module", backup: false }],
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- taking the new fields off, as a first proposal had none
      variants: cfg.variants.map(({ batteryId: _b, ev: _e, ...v }) => v),
    } as unknown as typeof cfg;
    const read = readConfigurator(old);
    expect(read.batteries[0]).toMatchObject({ id: 0, qty: 1 });
    expect(read.variants.every((v) => v.ev === false)).toBe(true);
  });
});
