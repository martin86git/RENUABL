/**
 * The configurator (19 Nov 2026, Martin: "compare it with ordering a car with Tesla … $65,000 and yet it doesn't feel
 * like a huge commitment"). A second way to read a proposal, beside the page we have: the home from above on one
 * side, a few choices on the other, one price that moves, and one small step.
 *
 * What a customer can change, and why only these (Martin): the layout is fixed, so the sizes are designs. The
 * business draws the fullest system the roof takes, and the smaller sizes are worked back from it by taking the
 * least sunny panels off first; or, when the roof has two or three designs offered (Quickest payback and the rest),
 * those designs are the sizes. A panel of another maker, and a battery added or taken off, change nothing on the
 * roof, so those can be swapped on any size. Every mix is priced in full on the server when the proposal is published,
 * exactly as the designer's quote does, so the page only ever switches between figures it was sent. Pure.
 */
import type { CatalogueBattery, CataloguePanel } from "./catalogue";
import { makerOf, suggestBatteries } from "./battery-suggest";
import { DAY } from "./quote";
import { designPanels, panelAspects, panelOf, type DesignBattery, type InverterSpec, type RoofDesign } from "./roof-design";
import { yearOnPlane } from "./tilt";
import type { ProposalOption } from "./proposal";

/** A configurator choice as kept when a customer goes ahead: `cfg-<size>-<panel>-<b|n>` (battery or none). */
export type ConfigKey = `cfg-${number}-${number}-${"b" | "n"}`;

export const configKey = (size: number, panel: number, battery: boolean): ConfigKey => `cfg-${size}-${panel}-${battery ? "b" : "n"}`;

export const isConfigKey = (raw: unknown): raw is ConfigKey => typeof raw === "string" && /^cfg-\d{1,2}-\d{1,2}-[bn]$/.test(raw);

/** One size on offer: a design (the business's own, or worked back from it) with its panels on the roof. */
export interface ConfigSize {
  id: number;
  /** What it is called: the design's goal when it has one ("Maximum return"), else its kW. */
  name: string;
  /** A few words under it ("As designed", "The least sunny 6 panels left off"). */
  note: string;
  panels: number;
  /** Worked back from the drawn design (fewer panels than drawn), not one of the business's own designs. */
  worked: boolean;
  /** Whether the design it comes from has a battery. */
  designedBattery: boolean;
  /** Each panel's four corners, as `ProposalView.roof.panels`. */
  roofPanels: number[][];
  roofAspects?: number[][];
}

/** A panel a customer can choose: the one designed with first, then up to two of other makers. */
export interface ConfigPanel {
  id: number;
  name: string;
  maker: string;
  watts: number;
}

/** One mix, priced in full: an option like the proposal's own, with what it is a mix of. */
export interface ConfigVariant extends ProposalOption {
  goal: ConfigKey;
  size: number;
  panel: number;
  battery: boolean;
}

/** What the configurator is sent: the choices and every mix of them that could be priced. */
export interface ConfiguratorView {
  sizes: ConfigSize[];
  panels: ConfigPanel[];
  /** The battery a size would have, or null when none fits the inverter on it (by size id). */
  batteries: { size: number; kwh: number; name: string; backup: boolean }[];
  variants: ConfigVariant[];
  /** The mix it opens on: the recommended design, as designed. */
  start: ConfigKey;
}

/** The fewest panels a size worked back from a design may have. */
export const MIN_CONFIG_PANELS = 6;
/** The shares of the drawn design the smaller sizes are worked back to. */
export const SIZE_STEPS = [1, 0.8, 0.6] as const;
/** The most panels of other makers offered beside the one designed with. */
export const MAX_OTHER_PANELS = 2;

/** The panel counts to offer from a design of `drawn` panels: as drawn, then smaller, none under the minimum or twice. */
export function sizeCounts(drawn: number): number[] {
  const counts: number[] = [];
  for (const step of SIZE_STEPS) {
    const n = step === 1 ? drawn : Math.round(drawn * step);
    if (n > 0 && (step === 1 || n >= MIN_CONFIG_PANELS) && !counts.includes(n)) counts.push(n);
  }
  return counts;
}

/**
 * The design with only `keep` of its panels: the least sunny taken off first (by each panel's tilt and direction),
 * and of those alike, the ones laid last (furthest from the gutter on a face). Strings are taken off: they were wired
 * for the whole design, and are done again on site for the size chosen.
 */
export function trimDesign(design: RoofDesign, keep: number): RoofDesign {
  const panels = designPanels(design);
  if (keep >= panels.length) return design;
  const aspects = panelAspects(design);
  const ranked = panels
    .map((p, i) => ({ key: p.key, at: i, sun: yearOnPlane(aspects[i].tilt, aspects[i].facing) }))
    .sort((a, b) => a.sun - b.sun || b.at - a.at);
  const drop = new Set(ranked.slice(0, panels.length - Math.max(0, keep)).map((r) => r.key));
  const faces = design.faces.map((face) => {
    const off = [...face.off];
    for (const key of drop) {
      const m = /^g:(.+):(\d+)$/.exec(key);
      if (m && m[1] === face.id) off.push(Number(m[2]));
    }
    return off.length === face.off.length ? face : { ...face, off: [...new Set(off)].sort((a, b) => a - b) };
  });
  const loose = (design.loose ?? []).filter((p) => !drop.has(`l:${p.id}`));
  return { ...design, faces, ...(design.loose ? { loose } : {}), strings: undefined };
}

/**
 * The design with another maker's panel in the same places: its name, code and watts, the designed panel's size kept,
 * so the layout (and how many fit) stays as drawn. A panel a little larger or smaller is checked on site.
 */
export function withPanel(design: RoofDesign, panel: Pick<CataloguePanel, "sku" | "name" | "watts">): RoofDesign {
  const size = panelOf(design);
  return { ...design, panel: { sku: panel.sku, name: panel.name, watts: panel.watts, long: size.long, short: size.short } };
}

/** The design with the battery given, or with none. */
export function withBattery(design: RoofDesign, battery: DesignBattery | null): RoofDesign {
  return { ...design, battery: battery ?? undefined };
}

/**
 * The panels a customer can choose between: the one designed with, then up to `MAX_OTHER_PANELS` of other makers on
 * the business's lists, each the one nearest in watts of its maker, nearest first.
 */
export function panelChoices(
  designed: Pick<CataloguePanel, "sku" | "name" | "watts">,
  listed: readonly Pick<CataloguePanel, "sku" | "name" | "watts">[],
): Pick<CataloguePanel, "sku" | "name" | "watts">[] {
  const own = makerOf(designed.name);
  const byMaker = new Map<string, Pick<CataloguePanel, "sku" | "name" | "watts">>();
  for (const p of listed) {
    const maker = makerOf(p.name);
    if (!maker || maker === own || !(p.watts > 0) || p.sku === designed.sku) continue;
    const best = byMaker.get(maker);
    if (!best || Math.abs(p.watts - designed.watts) < Math.abs(best.watts - designed.watts)) byMaker.set(maker, p);
  }
  const others = [...byMaker.values()].sort((a, b) => Math.abs(a.watts - designed.watts) - Math.abs(b.watts - designed.watts));
  return [designed, ...others.slice(0, MAX_OTHER_PANELS)];
}

/**
 * A battery to add to a design without one: what the battery suggestion picks for its panels and the home's bill,
 * of a maker that works with the inverter on it. Null when none on the lists fits.
 */
export function batteryToAdd(input: {
  design: RoofDesign;
  batteries: readonly CatalogueBattery[];
  monthlyKwh: readonly number[];
  dailyKwh: number | null;
  selfUseShare: number;
}): DesignBattery | null {
  const inverters: Pick<InverterSpec, "name">[] = input.design.inverters ?? [];
  const idea = suggestBatteries({
    batteries: [...input.batteries],
    inverters: inverters.map((i) => ({ name: i.name })),
    monthlyKwh: input.monthlyKwh,
    dailyKwh: input.dailyKwh,
    selfUseShare: input.selfUseShare,
    eveningShare: DAY.eveningShare,
  });
  const own = inverters[0] ? makerOf(inverters[0].name) : null;
  const pick =
    idea.suggestions.find((s) => own && makerOf(s.battery.name) === own && s.battery.kwh * s.qty >= idea.size) ??
    idea.suggestions.find((s) => s.battery.kwh * s.qty >= idea.size) ??
    idea.suggestions[0];
  if (!pick || !(pick.battery.kwh > 0)) return null;
  return { sku: pick.battery.sku, name: pick.battery.name, kwh: pick.battery.kwh, qty: pick.qty, x: 0, y: 0 };
}

/** A configurator variant in place of the proposal's own system, with its size's panels on the roof. */
export function variantOf(cfg: ConfiguratorView | undefined, key: unknown): (ConfigVariant & { size: number }) | null {
  if (!cfg || !isConfigKey(key)) return null;
  const v = cfg.variants.find((x) => x.goal === key);
  if (!v) return null;
  const size = cfg.sizes.find((s) => s.id === v.size);
  return size ? { ...v, roofPanels: size.roofPanels, ...(size.roofAspects ? { roofAspects: size.roofAspects } : {}) } : null;
}

/** The variant for a mix, or the nearest priced one (the same size and panel with the battery the other way, then the size as designed). */
export function nearestVariant(cfg: ConfiguratorView, size: number, panel: number, battery: boolean): ConfigVariant | null {
  const at = (s: number, p: number, b: boolean) => cfg.variants.find((v) => v.size === s && v.panel === p && v.battery === b);
  return at(size, panel, battery) ?? at(size, panel, !battery) ?? at(size, 0, battery) ?? at(size, 0, !battery) ?? null;
}

/** What the business is told was chosen, written on the deal when a configurator mix is accepted. */
export function chosenWords(cfg: ConfiguratorView, key: ConfigKey): string | null {
  const v = cfg.variants.find((x) => x.goal === key);
  if (!v) return null;
  const size = cfg.sizes.find((s) => s.id === v.size);
  const panel = cfg.panels.find((p) => p.id === v.panel);
  if (!size || !panel) return null;
  const parts = [
    `${size.name}: ${v.system.kw} kW, ${size.panels} panels of ${panel.name}`,
    v.battery ? `with a ${v.system.batteryKwh} kWh battery` : "no battery",
  ];
  // The order and the price are the mix's own; the drawing on the job card is still the design it came from.
  const differs = size.worked || panel.id !== 0 || v.battery !== size.designedBattery;
  return `Chosen in the configurator: ${parts.join(", ")}.${differs ? " Update the design to match before ordering." : ""}`;
}

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/** A mix in a few words: "13.3 kW, 28 Jinko panels, with a 13.5 kWh battery". */
export function mixWords(cfg: ConfiguratorView, key: ConfigKey): string | null {
  const v = cfg.variants.find((x) => x.goal === key);
  const size = v && cfg.sizes.find((s) => s.id === v.size);
  const panel = v && cfg.panels.find((p) => p.id === v.panel);
  if (!v || !size || !panel) return null;
  return `${v.system.kw} kW, ${size.panels} ${panel.maker} panels, ${v.battery ? `with a ${v.system.batteryKwh} kWh battery` : "no battery"}`;
}

/** What a customer holding their week says in the chat (their line, sent by their press). */
export function holdMessage(cfg: ConfiguratorView, key: ConfigKey, week: string): string {
  const v = cfg.variants.find((x) => x.goal === key);
  const what = mixWords(cfg, key) ?? "the system I chose";
  const price = v ? ` It showed ${dollars(v.price.youPay)} after the federal rebate.` : "";
  return `I'd like to hold ${week} for my installation: ${what}.${price} (Held from the configurator.)`;
}

/** The note on the install calendar's pencilled-in week. */
export function holdNote(cfg: ConfiguratorView, key: ConfigKey, week: string): string {
  return `Held by the customer from the configurator for ${week}: ${mixWords(cfg, key) ?? "their chosen system"}. Confirm at the site visit.`;
}
