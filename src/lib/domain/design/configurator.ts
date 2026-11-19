/**
 * The configurator (19 Nov 2026, Martin: "compare it with ordering a car with Tesla … $65,000 and yet it doesn't feel
 * like a huge commitment"). A second way to read a proposal, beside the page we have: the home from above on one
 * side, a few choices on the other, one price that moves, and one small step, Order.
 *
 * What a customer can change, and why only these (Martin): the layout is fixed, so the sizes are designs. The
 * business draws the fullest system the roof takes, and the smaller sizes are worked back from it by taking the
 * least sunny panels off first; or, when the roof has two or three designs offered (Quickest payback and the rest),
 * those designs are the sizes. What isn't placed on the roof can be swapped on any size: the panel's maker (same
 * places), the battery (none, or one of up to three makers that work with the inverter), blackout backup (one module
 * more, held for blackouts, and the backup circuits) and an EV charger. Every mix is priced in full on the server when
 * the proposal is published, exactly as the designer's quote does, so the page only ever switches between figures it
 * was sent. Pure.
 */
import { COSTING } from "../costing";
import { autoStringDesign } from "./auto-string";
import type { CatalogueBattery, CatalogueInverter, CataloguePanel } from "./catalogue";
import type { PanelElectrical } from "./electrical";
import { makerName, makerOf, suggestBatteries } from "./battery-suggest";
import { isKnownMaker } from "./makers";
import { DAY } from "./quote";
import {
  MAX_BATTERY_QTY,
  designPanels,
  panelAspects,
  panelOf,
  type DesignBattery,
  type DesignCharger,
  type InverterSpec,
  type RoofDesign,
} from "./roof-design";
import { yearOnPlane } from "./tilt";
import type { ProposalOption } from "./proposal";

/**
 * A configurator mix as kept when a customer orders: `cfg-<size>-<panel>-<battery>-<ev><backup>`, the battery `n` for
 * none or which of the size's batteries, the last two `1` or `0`, then `-i<inverter>` when it isn't the inverter
 * designed with. (The first proposals, 19 Nov 2026, kept `cfg-<size>-<panel>-<b|n>`, still read.)
 */
export type ConfigKey = `cfg-${string}`;

/** What a customer has picked. */
export interface ConfigPick {
  size: number;
  panel: number;
  /** Which of the size's inverters: 0 the one designed with. */
  inverter: number;
  /** Which of the batteries offered with that inverter, or null for none. */
  battery: number | null;
  ev: boolean;
  backup: boolean;
}

export const configKey = (p: ConfigPick): ConfigKey =>
  `cfg-${p.size}-${p.panel}-${p.battery === null ? "n" : p.battery}-${p.ev ? 1 : 0}${p.backup ? 1 : 0}${p.inverter ? `-i${p.inverter}` : ""}`;

export const isConfigKey = (raw: unknown): raw is ConfigKey =>
  typeof raw === "string" && /^cfg-\d{1,2}-\d{1,2}-(n|b|\d{1,2})(-[01]{2}(-i\d{1,2})?)?$/.test(raw);

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

/**
 * An inverter a customer can choose for a size (19 Nov 2026, Martin: "different inverters to choose from that work with
 * the design"): the one designed with first, then others of other makers that take the size's panels.
 */
export interface ConfigInverter {
  size: number;
  id: number;
  name: string;
  maker: string;
  kw: number;
}

/** A battery a customer can choose for a size and inverter: the one designed with, else what suits it, then other makers. */
export interface ConfigBattery {
  size: number;
  /** The inverter it goes with (left out before inverters could be chosen: the one designed with). */
  inverter?: number;
  id: number;
  name: string;
  maker: string;
  /** What it holds without the module held for blackouts, kWh. */
  kwh: number;
  qty: number;
}

/** One mix, priced in full: an option like the proposal's own, with what it is a mix of. */
export interface ConfigVariant extends ProposalOption {
  goal: ConfigKey;
  size: number;
  panel: number;
  /** Which of the size's inverters (left out before inverters could be chosen: the one designed with). */
  inverter?: number;
  /** Whether it has a battery (and `batteryId` which; left out on the first proposals, where it was the one). */
  battery: boolean;
  batteryId?: number | null;
  /** With the EV charger (left out on the first proposals: none). */
  ev?: boolean;
  /**
   * Its system lines as places in `ConfiguratorView.say` (`packLines`): the same lines repeat across mixes, so each is
   * sent once. `system.details` is then empty until read back (`readConfigurator`, `variantOf`).
   */
  sayIds?: number[];
}

/** What the configurator is sent: the choices and every mix of them that could be priced. */
export interface ConfiguratorView {
  sizes: ConfigSize[];
  panels: ConfigPanel[];
  /** Left out before inverters could be chosen. */
  inverters?: ConfigInverter[];
  batteries: ConfigBattery[];
  /** The EV charger offered, when there is one on the design or the business's lists. */
  charger?: { name: string; kw: number } | null;
  variants: ConfigVariant[];
  /** Every mix's system lines, each once (`packLines`); left out on proposals before 19 Nov 2026. */
  say?: { label: string; value: string }[];
  /** The mix it opens on: the recommended design, as designed. */
  start: ConfigKey;
}

/**
 * Makers whose inverters need parts behind every panel (optimisers, or microinverters in place of one), which a swap
 * of the inverter alone doesn't cost: never offered in place of another maker's (19 Nov 2026).
 */
export const NEEDS_PANEL_PARTS = ["solaredge", "enphase", "tigo"] as const;

/** Each mix's system lines put in one shared list, so a line repeated across mixes is sent once. */
export function packLines(cfg: ConfiguratorView): ConfiguratorView {
  const lines: { label: string; value: string }[] = [];
  const at = new Map<string, number>();
  const variants = cfg.variants.map((v) => {
    const sayIds = v.system.details.map((d) => {
      const key = `${d.label}\u0000${d.value}`;
      let i = at.get(key);
      if (i === undefined) {
        i = lines.length;
        lines.push(d);
        at.set(key, i);
      }
      return i;
    });
    return { ...v, system: { ...v.system, details: [] }, sayIds };
  });
  return { ...cfg, variants, say: lines };
}

/** A mix with its system lines read back from the shared list. */
function withLines<V extends ConfigVariant>(cfg: Pick<ConfiguratorView, "say">, v: V): V {
  if (!v.sayIds || !cfg.say) return v;
  const details = v.sayIds.map((i) => cfg.say![i]).filter(Boolean);
  return { ...v, system: { ...v.system, details } };
}

/** The fewest panels a size worked back from a design may have. */
export const MIN_CONFIG_PANELS = 6;
/** The shares of the drawn design the smaller sizes are worked back to. */
export const SIZE_STEPS = [1, 0.8, 0.6] as const;
/** The most panels of other makers offered beside the one designed with. */
export const MAX_OTHER_PANELS = 2;
/** The most inverters of other makers offered beside the one designed with. */
export const MAX_OTHER_INVERTERS = 2;
/** The most batteries a customer chooses between for a size. */
export const MAX_BATTERY_CHOICES = 3;

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

/** The design with the EV charger given, or with none. */
export function withCharger(design: RoofDesign, charger: DesignCharger | null): RoofDesign {
  return { ...design, charger: charger ?? undefined };
}

/** A battery with blackout backup: one module more, held for blackouts (the quote adds the backup circuits). */
export const withBackup = (battery: DesignBattery): DesignBattery => ({
  ...battery,
  qty: Math.min(MAX_BATTERY_QTY, battery.qty + 1),
  backup: true,
});

/** A battery as it runs the evenings: the module held for blackouts taken off. */
export const withoutBackup = (battery: DesignBattery): DesignBattery => {
  const { backup, ...rest } = battery;
  return { ...rest, qty: backup ? Math.max(1, rest.qty - 1) : rest.qty };
};

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

/** An inverter's supply and whether it takes a battery: as the list says, else read from its name. */
const phaseOf = (i: Pick<CatalogueInverter, "name" | "phase">) =>
  i.phase ?? (/three|3s?-?ph/i.test(i.name) ? "three" : /single|1s?-?ph/i.test(i.name) ? "single" : null);
const hybridOf = (i: Pick<CatalogueInverter, "name" | "hybrid">) => i.hybrid ?? /hybrid/i.test(i.name);

/**
 * The inverters a customer can choose between for a design (19 Nov 2026, Martin): the one designed with first, then,
 * one of each other maker the designer knows on the business's lists, the smallest of the same supply and kind (hybrid or not) that takes
 * the design's panels (`COSTING.maxArrayToInverter`, or `maxArrayToHybridWithBattery` for a hybrid), those whose input
 * limits are on file first, then nearest in size to the one designed; up to `MAX_OTHER_INVERTERS`. When the panel's and
 * the inverter's limits are both on file the panels must string onto it (`autoStringDesign`); else it is checked on
 * site as any design is. Only the designed one for a design with more than one inverter, or one whose supply can't be read.
 */
export function inverterChoices(input: {
  design: RoofDesign;
  inverters: readonly CatalogueInverter[];
  panel?: PanelElectrical;
}): InverterSpec[] {
  const designed = input.design.inverters ?? [];
  if (designed.length !== 1) return [...designed];
  const own = designed[0];
  const listed = input.inverters.find((i) => i.sku === own.sku);
  const phase = phaseOf({ name: own.name, phase: listed?.phase });
  const hybrid = hybridOf({ name: own.name, hybrid: listed?.hybrid });
  if (!phase) return [own];
  const arrayKw = (designPanels(input.design).length * panelOf(input.design).watts) / 1000;
  const ratio = hybrid ? COSTING.maxArrayToHybridWithBattery : COSTING.maxArrayToInverter;
  const ownMaker = makerOf(own.name);
  const byMaker = new Map<string, CatalogueInverter>();
  const fits = (i: CatalogueInverter) => {
    if (!(i.kw > 0) || arrayKw > i.kw * ratio) return false;
    if (!input.panel || !i.electrical) return true;
    return autoStringDesign(input.design, [{ electrical: i.electrical, name: i.name }], input.panel).ok;
  };
  for (const i of [...input.inverters].sort((a, b) => a.kw - b.kw)) {
    const maker = makerOf(i.name);
    if (!maker || maker === ownMaker || i.sku === own.sku || phaseOf(i) !== phase || hybridOf(i) !== hybrid) continue;
    if (!isKnownMaker(maker) || (NEEDS_PANEL_PARTS as readonly string[]).includes(maker)) continue;
    if (byMaker.has(maker) || !fits(i)) continue;
    byMaker.set(maker, i);
  }
  const others = [...byMaker.values()].sort(
    (a, b) => Number(Boolean(b.electrical)) - Number(Boolean(a.electrical)) || Math.abs(a.kw - own.kw) - Math.abs(b.kw - own.kw),
  );
  return [own, ...others.slice(0, MAX_OTHER_INVERTERS).map((i) => ({ sku: i.sku, name: i.name, kw: i.kw }))];
}

/** The design with the inverter given in place of its own (where it stands on the drawing kept). */
export function withInverter(design: RoofDesign, inverter: InverterSpec): RoofDesign {
  const at = design.inverters?.[0];
  return {
    ...design,
    inverters: [{ sku: inverter.sku, name: inverter.name, kw: inverter.kw, ...(at?.x !== undefined ? { x: at.x, y: at.y } : {}) }],
  };
}

/**
 * The batteries a customer can choose between for a design, each as it runs the evenings (no blackout module): the
 * one designed with first, then what the battery suggestion picks for its panels and the home's bill, one of each
 * maker that works with the inverter on it, up to `MAX_BATTERY_CHOICES`.
 */
export function batteryChoices(input: {
  design: RoofDesign;
  batteries: readonly CatalogueBattery[];
  monthlyKwh: readonly number[];
  dailyKwh: number | null;
  selfUseShare: number;
}): DesignBattery[] {
  const inverters: Pick<InverterSpec, "name">[] = input.design.inverters ?? [];
  const idea = suggestBatteries({
    batteries: [...input.batteries],
    inverters: inverters.map((i) => ({ name: i.name })),
    monthlyKwh: input.monthlyKwh,
    dailyKwh: input.dailyKwh,
    selfUseShare: input.selfUseShare,
    eveningShare: DAY.eveningShare,
  });
  const out: DesignBattery[] = input.design.battery ? [withoutBackup(input.design.battery)] : [];
  const own = inverters[0] ? makerOf(inverters[0].name) : null;
  // The inverter's own maker first, then the rest by size.
  const ideas = [...idea.suggestions].sort(
    (a, b) => Number(own !== null && makerOf(b.battery.name) === own) - Number(own !== null && makerOf(a.battery.name) === own),
  );
  for (const s of ideas) {
    if (out.length >= MAX_BATTERY_CHOICES) break;
    if (!(s.battery.kwh > 0) || out.some((b) => makerOf(b.name) === makerOf(s.battery.name))) continue;
    out.push({ sku: s.battery.sku, name: s.battery.name, kwh: s.battery.kwh, qty: s.qty, x: 0, y: 0 });
  }
  return out;
}

/** The first proposals' mixes read as today's: their battery the size's first, and no EV charger. */
export function readConfigurator(cfg: ConfiguratorView): ConfiguratorView {
  return {
    ...cfg,
    inverters: cfg.inverters ?? [],
    batteries: cfg.batteries.map((b, i) => ({
      ...b,
      inverter: b.inverter ?? 0,
      id: b.id ?? 0,
      maker: b.maker ?? makerName(makerOf(b.name)),
      qty: b.qty ?? 1,
      size: b.size ?? i,
    })),
    variants: cfg.variants
      .map((x) => withLines(cfg, x))
      .map((v) => ({
        ...v,
        batteryId: v.batteryId === undefined ? (v.battery ? 0 : null) : v.batteryId,
        ev: v.ev ?? false,
        inverter: v.inverter ?? 0,
      })),
  };
}

/** What a variant is a mix of. */
export const pickOf = (v: ConfigVariant): ConfigPick => ({
  size: v.size,
  panel: v.panel,
  inverter: v.inverter ?? 0,
  battery: v.batteryId === undefined ? (v.battery ? 0 : null) : v.batteryId,
  ev: Boolean(v.ev),
  backup: Boolean(v.backup),
});

/** A configurator variant in place of the proposal's own system, with its size's panels on the roof. */
export function variantOf(cfg: ConfiguratorView | undefined, key: unknown): (ConfigVariant & { size: number }) | null {
  if (!cfg || !isConfigKey(key)) return null;
  const found = cfg.variants.find((x) => x.goal === key);
  if (!found) return null;
  const v = withLines(cfg, found);
  const size = cfg.sizes.find((s) => s.id === v.size);
  return size ? { ...v, roofPanels: size.roofPanels, ...(size.roofAspects ? { roofAspects: size.roofAspects } : {}) } : null;
}

/**
 * The variant for a pick, or the nearest priced one on the same size: the panel matters most, then the inverter, the battery, then
 * the EV charger, then backup. Null only for a size with nothing priced.
 */
export function nearestVariant(cfg: ConfiguratorView, want: ConfigPick): ConfigVariant | null {
  let best: ConfigVariant | null = null;
  let bestScore = -1;
  for (const v of cfg.variants) {
    if (v.size !== want.size) continue;
    const p = pickOf(v);
    const score =
      (p.panel === want.panel ? 16 : 0) +
      (p.inverter === want.inverter ? 8 : 0) +
      (p.battery === want.battery ? 4 : 0) +
      (p.ev === want.ev ? 2 : 0) +
      (p.backup === want.backup ? 1 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The mix blackout backup switches on to (19 Nov 2026, Martin: "im unable to toggle the backup option"): the same mix
 * with backup when it was priced, else the nearest priced mix with backup on this size, keeping the battery chosen if
 * it can and else the first battery listed for the size (backup comes with a battery, so switching it on with no battery
 * adds one). Null only when nothing with backup was priced for this size.
 */
export function backupPick(cfg: ConfiguratorView, now: ConfigPick): ConfigPick | null {
  const order = batteriesFor(cfg, now.size, now.inverter).map((b) => b.id);
  let best: ConfigVariant | null = null;
  let bestScore = -1;
  for (const v of cfg.variants) {
    if (v.size !== now.size || !v.backup) continue;
    const p = pickOf(v);
    const rank = p.battery === null ? order.length : order.indexOf(p.battery);
    const score =
      (p.inverter === now.inverter ? 2000 : 0) +
      (p.panel === now.panel ? 1000 : 0) +
      (p.battery === now.battery ? 500 : 100 - Math.max(0, rank) * 10) +
      (p.ev === now.ev ? 1 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best ? pickOf(best) : null;
}

/** The same mix with no battery: what the panels alone do, for the performance bar. */
export function solarOnly(cfg: ConfiguratorView, v: ConfigVariant): ConfigVariant | null {
  const p = pickOf(v);
  const alone = cfg.variants.find((x) => {
    const q = pickOf(x);
    return q.size === p.size && q.panel === p.panel && q.inverter === p.inverter && q.ev === p.ev && q.battery === null;
  });
  return alone ?? null;
}

/** The battery a variant has, as offered. */
export function batteryOfVariant(cfg: ConfiguratorView, v: ConfigVariant): ConfigBattery | null {
  const p = pickOf(v);
  return p.battery === null ? null : (batteriesFor(cfg, p.size, p.inverter).find((b) => b.id === p.battery) ?? null);
}

/** The batteries offered on a size with one of its inverters. */
export const batteriesFor = (cfg: ConfiguratorView, size: number, inverter: number): ConfigBattery[] =>
  cfg.batteries.filter((b) => b.size === size && (b.inverter ?? 0) === inverter);

/** The inverters offered on a size (none listed before inverters could be chosen). */
export const invertersFor = (cfg: ConfiguratorView, size: number): ConfigInverter[] => (cfg.inverters ?? []).filter((i) => i.size === size);

/** The inverter a variant has, as offered. */
export function inverterOfVariant(cfg: ConfiguratorView, v: ConfigVariant): ConfigInverter | null {
  const p = pickOf(v);
  return invertersFor(cfg, p.size).find((i) => i.id === p.inverter) ?? null;
}

/**
 * The pick another size switches to: the same inverter's and battery's makers where that size offers them (each size
 * numbers its own), else the one designed with and that inverter's first battery; no battery stays no battery.
 */
export function switchSize(cfg: ConfiguratorView, now: ConfigPick, size: number): ConfigPick {
  const invMaker = invertersFor(cfg, now.size).find((i) => i.id === now.inverter)?.maker;
  const inverter = invertersFor(cfg, size).find((i) => i.maker === invMaker)?.id ?? 0;
  if (now.battery === null) return { ...now, size, inverter };
  const batMaker = batteriesFor(cfg, now.size, now.inverter).find((b) => b.id === now.battery)?.maker;
  const there = batteriesFor(cfg, size, inverter);
  const battery = (there.find((b) => b.maker === batMaker) ?? there[0])?.id;
  return battery === undefined ? { ...now, size, inverter, battery: null, backup: false } : { ...now, size, inverter, battery };
}

/**
 * The pick another inverter switches to: a battery of the same maker if that inverter has one, else its first, and no
 * battery when none was picked; the rest as it was.
 */
export function switchInverter(cfg: ConfiguratorView, now: ConfigPick, inverter: number): ConfigPick {
  if (now.battery === null) return { ...now, inverter };
  const maker = batteriesFor(cfg, now.size, now.inverter).find((b) => b.id === now.battery)?.maker;
  const there = batteriesFor(cfg, now.size, inverter);
  const same = there.find((b) => b.maker === maker) ?? there[0];
  return same ? { ...now, inverter, battery: same.id } : { ...now, inverter, battery: null, backup: false };
}

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/** A mix in a few words: "7.125 kW, 15 Jinko panels, a 16 kWh Sigenergy battery with blackout backup, an EV charger". */
export function mixWords(cfg: ConfiguratorView, key: ConfigKey): string | null {
  const v = cfg.variants.find((x) => x.goal === key);
  const size = v && cfg.sizes.find((s) => s.id === v.size);
  const panel = v && cfg.panels.find((p) => p.id === v.panel);
  if (!v || !size || !panel) return null;
  const battery = batteryOfVariant(cfg, v);
  const inverter = invertersFor(cfg, v.size).length > 1 ? inverterOfVariant(cfg, v) : null;
  const parts = [
    `${v.system.kw} kW`,
    `${size.panels} ${panel.maker} panels`,
    ...(inverter ? [`a ${inverter.kw} kW ${inverter.maker} inverter`] : []),
    v.battery
      ? `a ${v.system.batteryKwh} kWh ${battery?.maker ?? ""} battery${v.backup ? " with blackout backup" : ""}`.replace("  ", " ")
      : "no battery",
    ...(v.ev ? ["an EV charger"] : []),
  ];
  return parts.join(", ");
}

/** What the business is told was chosen, written on the deal when a configurator mix is ordered. */
export function chosenWords(cfg: ConfiguratorView, key: ConfigKey): string | null {
  const v = cfg.variants.find((x) => x.goal === key);
  const size = v && cfg.sizes.find((s) => s.id === v.size);
  const words = mixWords(cfg, key);
  if (!v || !size || !words) return null;
  // The order and the price are the mix's own; the drawing on the job card is still the design it came from.
  const p = pickOf(v);
  const differs =
    size.worked ||
    p.panel !== 0 ||
    p.inverter !== 0 ||
    (p.battery !== null) !== size.designedBattery ||
    (p.battery !== null && p.battery > 0) ||
    Boolean(v.ev);
  return `Ordered in the configurator: ${size.name}: ${words}.${differs ? " Update the design to match before ordering stock." : ""}`;
}

/** What a customer ordering an indicative proposal says in the chat (their line, sent by their press). */
export function holdMessage(cfg: ConfiguratorView, key: ConfigKey, week: string): string {
  const v = cfg.variants.find((x) => x.goal === key);
  const what = mixWords(cfg, key) ?? "the system I chose";
  const price = v ? ` It showed ${dollars(v.price.youPay)} after the federal rebate.` : "";
  return `I'd like to order ${what}, installed ${week}.${price} (Ordered from the configurator, to confirm at the site visit.)`;
}

/** The note on the install calendar's pencilled-in week. */
export function holdNote(cfg: ConfiguratorView, key: ConfigKey, week: string): string {
  return `Asked for by the customer in the configurator for ${week}: ${mixWords(cfg, key) ?? "their chosen system"}. Confirm with them.`;
}
