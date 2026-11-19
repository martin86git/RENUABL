import { describe, expect, it } from "vitest";
import {
  chosenWords,
  configKey,
  holdMessage,
  isConfigKey,
  nearestVariant,
  backupPick,
  batteriesFor,
  inverterChoices,
  withModules,
  invertersFor,
  MAX_OTHER_INVERTERS,
  switchInverter,
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
import { pricedWorkspace, sampleInputs, sampleSet } from "./proposal-fixture";
import { workspaceCatalogue } from "./pricing";
import { includedExtrasOf, lineKey } from "./quote";
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
  const solar = (size: number) => nearestVariant(cfg, { size, panel: 0, inverter: 0, extra: 0, battery: null, ev: false, backup: false })!;
  const withBatt = (size: number, backup = false) =>
    nearestVariant(cfg, { size, panel: 0, inverter: 0, extra: 0, battery: 0, ev: false, backup })!;

  it("prices every mix on publishing, largest size first, and starts as designed", () => {
    expect(cfg.sizes.length).toBeGreaterThan(1);
    expect(cfg.sizes[0].panels).toBe(view.system.panels);
    for (let i = 1; i < cfg.sizes.length; i++) expect(cfg.sizes[i].panels).toBeLessThan(cfg.sizes[i - 1].panels);
    const start = cfg.variants.find((v) => v.goal === cfg.start)!;
    expect(pickOf(start)).toEqual({ size: 0, panel: 0, inverter: 0, extra: 0, battery: 0, ev: false, backup: false });
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
  it("switches blackout backup on from any mix, adding a battery when there is none", () => {
    const fromBattery = backupPick(cfg, pickOf(withBatt(0)))!;
    expect(fromBattery).toEqual({ ...pickOf(withBatt(0)), backup: true });
    const fromSolar = backupPick(cfg, pickOf(solar(0)))!;
    expect(fromSolar.backup).toBe(true);
    expect(fromSolar.battery).toBe(cfg.batteries.find((b) => b.size === 0)!.id);
    expect(fromSolar.size).toBe(0);
    // Nothing with backup priced: nothing to switch to.
    const none = { ...cfg, variants: cfg.variants.filter((v) => !v.backup) };
    expect(backupPick(none, pickOf(withBatt(0)))).toBeNull();
  });
  it("offsets more of the home's power with a battery, and saves more", () => {
    const alone = solarOnly(cfg, withBatt(0))!;
    expect(alone.batteryId).toBeNull();
    expect(withBatt(0).bill!.selfReliance).toBeGreaterThan(alone.bill!.selfReliance);
    expect(withBatt(0).bill!.saving).toBeGreaterThan(alone.bill!.saving);
  });
  it("offers the batteries that fit, each a maker of its own, and an EV charger when one is listed", () => {
    const makers = cfg.batteries.filter((b) => b.size === 0 && (b.inverter ?? 0) === 0).map((b) => b.maker);
    expect(makers.length).toBeGreaterThan(0);
    expect(new Set(makers).size).toBe(makers.length);
    if (cfg.charger) {
      const ev = nearestVariant(cfg, { size: 0, panel: 0, inverter: 0, extra: 0, battery: 0, ev: true, backup: false })!;
      expect(ev.ev).toBe(true);
      expect(ev.price.youPay).toBeGreaterThan(withBatt(0).price.youPay);
    }
  });
  it("shows the chosen mix's roof, system and price, and its own lines for the order", () => {
    const key = configKey({ size: 1, panel: 0, inverter: 0, extra: 0, battery: null, ev: false, backup: false });
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
    expect(chosenWords(cfg, configKey({ size: 1, panel: 0, inverter: 0, extra: 0, battery: null, ev: false, backup: false }))).toMatch(
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

// 19 Nov 2026, Martin: "different inverters to choose from that work with the design".
describe("inverters to choose from", () => {
  const set = sampleSet(true);
  const design = set.designs[0];
  const listed = workspaceCatalogue(pricedWorkspace()).inverters ?? [];

  it("offers the one designed with first, then other makers of the same kind that take the panels", () => {
    const choices = inverterChoices({ design, inverters: listed });
    expect(choices[0].sku).toBe(design.inverters![0].sku);
    expect(choices.length).toBeLessThanOrEqual(1 + MAX_OTHER_INVERTERS);
    const arrayKw = (designPanels(design).length * panelOf(design).watts) / 1000;
    const makers = choices.map((c) => c.name.split(" ")[0].toLowerCase());
    expect(new Set(makers).size).toBe(makers.length);
    for (const c of choices.slice(1)) {
      expect(c.kw * 1.33).toBeGreaterThanOrEqual(arrayKw);
      expect(/three/i.test(c.name)).toBe(false);
      expect(/hybrid/i.test(c.name)).toBe(false);
    }
  });
  it("offers only the one designed with when the design has two", () => {
    const two = { ...design, inverters: [design.inverters![0], design.inverters![0]] };
    expect(inverterChoices({ design: two, inverters: listed })).toHaveLength(2);
    expect(inverterChoices({ design: two, inverters: listed }).every((i) => i.sku === design.inverters![0].sku)).toBe(true);
  });
  it("keeps keys of the inverter designed with as before, and marks another", () => {
    const base = { size: 0, panel: 1, battery: 2, extra: 0, ev: true, backup: false };
    expect(configKey({ ...base, inverter: 0 })).toBe("cfg-0-1-2-10");
    expect(configKey({ ...base, inverter: 2 })).toBe("cfg-0-1-2-10-i2");
    expect(isConfigKey("cfg-0-1-2-10-i2")).toBe(true);
    expect(isConfigKey("cfg-0-1-2-10")).toBe(true);
    expect(isConfigKey("cfg-0-1-b")).toBe(true);
    expect(isConfigKey("cfg-0-1-2-i2")).toBe(false);
  });
  it("prices each inverter's mixes with batteries of its own, and switching keeps the battery's maker where it can", () => {
    const cfg = readConfigurator(built({ withBattery: true }).view.configurator!);
    const here = invertersFor(cfg, 0);
    expect(here[0].id).toBe(0);
    for (const inv of here) {
      const mixes = cfg.variants.filter((v) => v.size === 0 && (v.inverter ?? 0) === inv.id);
      expect(mixes.length).toBeGreaterThan(0);
      for (const v of mixes) if (v.batteryId !== null) expect(batteriesFor(cfg, 0, inv.id).some((b) => b.id === v.batteryId)).toBe(true);
    }
    if (here.length > 1) {
      const now = pickOf(cfg.variants.find((v) => v.goal === cfg.start)!);
      const moved = switchInverter(cfg, now, here[1].id);
      expect(moved.inverter).toBe(here[1].id);
      const was = batteriesFor(cfg, 0, now.inverter).find((b) => b.id === now.battery)?.maker;
      const there = batteriesFor(cfg, 0, here[1].id);
      if (there.some((b) => b.maker === was)) expect(there.find((b) => b.id === moved.battery)?.maker).toBe(was);
      expect(nearestVariant(cfg, moved)?.inverter ?? 0).toBe(here[1].id);
    }
  });
});

describe("inverters that need parts behind every panel, and the mixes' lines sent once", () => {
  it("never swaps in SolarEdge, Enphase or Tigo for another maker's inverter", () => {
    const design = sampleSet(true).designs[0];
    const listed = workspaceCatalogue(pricedWorkspace()).inverters ?? [];
    const names = inverterChoices({ design, inverters: listed }).map((i) => i.name.toLowerCase());
    expect(names.some((n) => /solaredge|solar edge|enphase|tigo/.test(n))).toBe(false);
  });
  it("sends each system line once and reads every mix's lines back in order", () => {
    const view = built({ withBattery: true }).view;
    const cfg = view.configurator!;
    expect(cfg.say!.length).toBeGreaterThan(0);
    expect(cfg.variants.every((v) => v.system.details.length === 0)).toBe(true);
    const read = readConfigurator(cfg);
    expect(read.variants.every((v) => v.system.details.length > 0)).toBe(true);
    const shown = viewForChoice(view, cfg.start);
    expect(shown.system.details.length).toBeGreaterThan(0);
    expect(variantOf(cfg, cfg.start)!.system.details).toEqual(read.variants.find((v) => v.goal === cfg.start)!.system.details);
  });
});

// 19 Nov 2026, Martin: "an option to increase or decrease the storage by adding or removing a module".
describe("storage a module up or down", () => {
  const cfg = readConfigurator(built({ withBattery: true }).view.configurator!);
  const at = (extra: number) => nearestVariant(cfg, { size: 0, panel: 0, inverter: 0, battery: 0, extra, ev: false, backup: false })!;

  it("prices the battery a module fewer and a module more, holding more and costing more", () => {
    expect(at(0).extra ?? 0).toBe(0);
    expect(at(1).extra).toBe(1);
    expect(at(1).system.batteryKwh).toBeGreaterThan(at(0).system.batteryKwh);
    expect(at(1).price.youPay).toBeGreaterThan(at(0).price.youPay);
    if ((at(-1).extra ?? 0) === -1) {
      expect(at(-1).system.batteryKwh).toBeLessThan(at(0).system.batteryKwh);
      expect(at(-1).price.youPay).toBeLessThan(at(0).price.youPay);
    }
  });
  it("marks the step in the key only when there is one, and never steps under one module", () => {
    const base = { size: 0, panel: 0, inverter: 0, battery: 0, ev: false, backup: false };
    expect(configKey({ ...base, extra: 0 })).toBe("cfg-0-0-0-00");
    expect(configKey({ ...base, extra: 1 })).toBe("cfg-0-0-0-00-m1");
    expect(configKey({ ...base, extra: -1, inverter: 2 })).toBe("cfg-0-0-0-00-i2-m-1");
    expect(isConfigKey("cfg-0-0-0-00-m1")).toBe(true);
    expect(isConfigKey("cfg-0-0-0-00-i2-m-1")).toBe(true);
    const one = { sku: "X", name: "Sigenergy 8 kWh module", kwh: 8, qty: 1, x: 0, y: 0 };
    expect(withModules(one, -1)).toBeNull();
    expect(withModules(one, 1)?.qty).toBe(2);
  });
  it("says the step on the deal, so the design is updated before stock is ordered", () => {
    expect(chosenWords(cfg, at(1).goal)).toMatch(/Update the design/);
  });
});

describe("costs decided on the job, shown as included", () => {
  it("names the decided costs included in the quote, in the customer's words, with how many RCBOs", () => {
    const lines = [
      { group: "Switchboard", label: "Switchboard upgrade", amount: 1000, confirm: true },
      { group: "Switchboard", label: "RCBO", amount: 100, confirm: true, qty: 1 },
      { group: "Battery", label: "Protective bollard", amount: 220, confirm: true },
      { group: "Battery", label: "Fireproofing (sheeting)", amount: 200, confirm: true },
    ] as Parameters<typeof includedExtrasOf>[0];
    const edits = {
      [lineKey(lines[0])]: { removed: true as const },
      [lineKey(lines[1])]: { on: true as const, qty: 3 },
      [lineKey(lines[2])]: { on: true as const },
      [lineKey(lines[3])]: { on: true as const },
    };
    expect(includedExtrasOf(lines, edits)).toEqual(["RCBO switches (3)", "Protective bollards", "Fire sheeting"]);
  });
});
