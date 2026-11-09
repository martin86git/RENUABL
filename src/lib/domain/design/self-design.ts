/**
 * "Design it for me": the roof designs itself, three ways, each priced from
 * the business's own lists and set against the customer's bill. Pure, tested.
 *
 * The panels come from the roof faces traced on the picture when there are
 * any (they are the roof as it is), else from Google's roof model. Each face
 * is filled in the fewest straight rows (`fillFace`, `suggestPanels`), the faces in order of how much sun
 * they get at their direction and pitch. Then, for every panel count the roof
 * allows, the inverter is chosen by rule (`inverter-suggest.ts`), the battery
 * by rule (`battery-suggest.ts`), the price worked out as the quote does
 * (`costSystem`, less STCs) and the saving as the bill panel does
 * (`designFinance`). Of those, three positive outcomes (Martin, 18 Oct 2026):
 *
 * 1. **Fastest payback.** Panels only, the count that pays for itself soonest
 *    (the smaller of two that pay back alike): the least outlay for the
 *    quickest return. (Return as a share of the outlay picks the same system,
 *    since it is only the payback turned over: so it isn't a design of its own.)
 * 2. **Best return.** Panels and a battery: the system that leaves the
 *    customer the most dollars ahead over `RETURN_YEARS` years once its price
 *    is paid, at the cost of a slower payback. (Panels alone when the home's
 *    evenings are too small for a battery to do much.)
 * 3. **Most independence.** The whole roof (as much as an inverter takes), a
 *    battery that holds the whole of the evenings, and one module more held
 *    back for blackouts, wired to keep chosen circuits on (`backup`: the quote
 *    adds the backup wiring, and the held module isn't counted in the
 *    savings). The most the home can do for itself, at the most outlay.
 *
 * Then each is strung by rule (`auto-string.ts`). Every figure is an estimate
 * (one price at all times, no price rises, no shade beyond what Google's roof
 * model knows), and every design is a starting point to check against the
 * picture: it knows nothing of vents, skylights or setbacks it isn't shown.
 */
import type { RebateRates } from "../rebates";
import type { RoofModel } from "../roof-layout";
import { autoStringDesign } from "./auto-string";
import { makerOf, suggestBatteries, SMALL_NIGHTS_KWH } from "./battery-suggest";
import type { CatalogueBattery, CatalogueInverter } from "./catalogue";
import type { PanelElectrical } from "./electrical";
import { suggestInverters, type InverterSuggestion } from "./inverter-suggest";
import type { Workspace } from "./pricing";
import { DAY, costSystem, designFinance, stcValue, type BillInterval, type QuoteForm } from "./quote";
import {
  ROOF_IMAGE,
  metresPerPixel,
  monthlyProduction,
  panelOf,
  designSummary,
  type DesignBattery,
  type DesignGoal,
  type Face,
  type InverterSpec,
  type Layout,
  type PanelSpec,
  type Point,
  type RoofDesign,
  MAX_BATTERY_QTY,
} from "./roof-design";
import { MAX_SUGGESTED, suggestPanels } from "./suggest";
import { packFaces } from "./pack";
import { shiftingKwhOf, systemSpecOf } from "./system";

/**
 * The years "best return" is counted over. VERIFY: panels are warranted for 25 years or more and batteries
 * commonly for 10, and a battery's replacement isn't counted; no price rises either. It is how the designs are
 * chosen, for the business: never a figure for the customer's proposal (no 25-year figures there).
 */
export const RETURN_YEARS = 15;
/** The fewest panels a design is made with. */
export const MIN_SELF_PANELS = 6;
/** A spot gets this share of the roof's best sun or more to count as well-sunned. */
export const GOOD_SUN = 0.8;
/** Without a bill, the system the first two designs are sized to, kW. */
export const NO_BILL_KW = 6.6;
/** Two paybacks this close, in years, are taken as the same. */
const PAYBACK_TIE = 0.05;

export type SelfDesignKey = DesignGoal;

export const SELF_DESIGN_LABELS: Record<SelfDesignKey, string> = {
  payback: "Fastest payback",
  return: "Best return",
  independence: "Most independence",
};

/** What each design aims for, as the designer says it before making them (Martin: say what to expect first). */
export const SELF_DESIGN_AIMS: Record<SelfDesignKey, string> = {
  payback: "Panels only, the size that pays for itself soonest, for the least outlay.",
  return: "Panels and a battery, the most dollars ahead once it's paid for. Slower to pay back.",
  independence: "The whole roof, a battery for the evenings and one module more held back for blackouts, with the backup circuits.",
};

export interface SelfDesignFigures {
  panels: number;
  kw: number;
  batteryKwh: number;
  /** What the customer pays: the price with GST, less STCs. */
  youPay: number;
  /** Lines with no cost on file: the price is short by them. */
  missing: number;
  /** A year's saving on the bill; null without a bill. */
  saving: number | null;
  /** Years to pay for itself; null without a bill or a saving. */
  payback: number | null;
  /** The saving over `RETURN_YEARS` years less what is paid; null without a bill. */
  netReturn: number | null;
  /** The share of the home's use the system supplies, 0 to 1; null without a bill. */
  selfReliance: number | null;
}

export interface SelfDesignOption {
  key: SelfDesignKey;
  label: string;
  design: RoofDesign;
  figures: SelfDesignFigures;
  /** Why this one, in a sentence or two. */
  why: string;
}

export interface SelfDesignResult {
  options: SelfDesignOption[];
  /** What the customer should know about all of them, or why there are fewer than three. */
  notes: string[];
  /** Where the panels came from. */
  from: "traced" | "roof model" | null;
}

export interface SelfDesignInput {
  centre: { lat: number; lng: number };
  /** The faces traced on the picture: when there are any, panels go on them. */
  faces: Face[];
  /** Google's roof model, used when nothing is traced. */
  model: RoofModel | null;
  /** Where Google's model sits on the picture, metres east and south, once lined up with today's photo. */
  modelOffset?: { x: number; y: number };
  /** Places on the roof to keep clear (existing panels, vents, skylights: `roof-check.ts`), outlines in metres. */
  avoid?: { x: number; y: number }[][];
  /** On traced faces, share the panels across two faces looking different ways when one would hold them all (`splitPartner`). */
  split?: boolean;
  /** The panel the design is drawn with (undefined: the costing's). */
  panel?: PanelSpec;
  panelElectrical?: PanelElectrical;
  /** The first panel on the business's lists, which a design naming no panel is priced with. */
  firstListed?: { sku: string; name: string };
  inverters: CatalogueInverter[];
  batteries: CatalogueBattery[];
  /** The customer's bill, as numbers; null when none is typed in. */
  bill: { interval: BillInterval; amount: number; supplyPerDay: number; rate: number; feedIn: number } | null;
  selfUseShare: number;
  yieldPerKwDay: number;
  form: QuoteForm;
  workspace: Workspace;
  rates: RebateRates;
  /** Today, as an ISO date: the STC rules go by it. */
  date: string;
  newId: (prefix: string) => string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const phaseOf = (i: CatalogueInverter) =>
  i.phase ?? (/three|3s?-?ph/i.test(i.name) ? "three" : /single|1s?-?ph/i.test(i.name) ? "single" : null);

/** The way panels are laid for a count: on the traced faces, or from Google's roof model. */
interface Source {
  from: "traced" | "roof model";
  /** The most panels it can lay. */
  most: number;
  /** How many of those are well-sunned. */
  good: number;
  layout: (n: number) => Layout;
}

/**
 * The traced faces, laid by the installer's rules (`packFaces`: rows from the gutter up, portrait and
 * landscape mixed to fit the most, clear of every edge, the fewest arrays), as panels placed by hand on the faces.
 */
function tracedSource(
  faces: Face[],
  panel: PanelSpec | undefined,
  newId: (prefix: string) => string,
  avoid?: { x: number; y: number }[][],
  split = false,
): Source | null {
  const size = panelOf({ panel });
  const made = new Map<number, Layout>();
  const lay = (n: number): Layout => {
    const kept = made.get(n);
    if (kept) return kept;
    const packed = packFaces(faces, size, n, () => newId("p"), avoid, split);
    const laid: Layout = { faces: packed.faces, loose: packed.loose, ...(panel ? { panel } : {}) };
    made.set(n, laid);
    return laid;
  };
  const most = lay(MAX_SUGGESTED).loose?.length ?? 0;
  if (!most) return null;
  return { from: "traced", most, good: most, layout: lay };
}

/** Google's roof model: its spots laid as panels placed by hand (`suggestPanels`). */
function modelSource(input: SelfDesignInput): Source | null {
  const { model } = input;
  if (!model?.slots.length) return null;
  const size = panelOf({ panel: input.panel });
  const lay = (n: number) => suggestPanels(model, input.centre, n, size, () => input.newId("p"), input.modelOffset, input.avoid);
  // As many as fit in rows, which is fewer than Google's spots: our panels are laid afresh, wholly on the roof.
  const most = lay(MAX_SUGGESTED).length;
  if (!most) return null;
  const top = Math.max(...model.slots.map((s) => s.kwh));
  const good = Math.round((most * model.slots.filter((s) => s.kwh >= top * GOOD_SUN).length) / model.slots.length);
  // A layout is the same for the same count: worked out once each.
  const made = new Map<number, Layout>();
  return {
    from: "roof model",
    most,
    good,
    layout: (n) => {
      const kept = made.get(n);
      if (kept) return kept;
      const laid: Layout = {
        faces: [],
        loose: lay(n),
        ...(input.panel ? { panel: input.panel } : {}),
      };
      made.set(n, laid);
      return laid;
    },
  };
}

/** The inverter for a size of array: the home's supply, hybrid with a battery (else a string inverter, else a hybrid). */
function inverterFor(input: SelfDesignInput, arrayKw: number, battery: boolean): InverterSuggestion | null {
  const all = suggestInverters({ arrayKw, inverters: input.inverters, panel: input.panelElectrical, strings: [] });
  const phase = (s: InverterSuggestion) => phaseOf(s.inverter) === input.form.phase;
  const hybrid = (s: InverterSuggestion) => /hybrid/i.test(s.kind);
  const onSupply = all.filter(phase);
  // A home without a battery can still have a hybrid, when the lists hold no other kind.
  const pick = onSupply.find((s) => hybrid(s) === battery) ?? (battery ? null : (onSupply.find(hybrid) ?? null));
  if (!pick || pick.inverter.electrical || pick.count > 1) return pick;
  // Its input limits aren't on file, so the design couldn't be strung: a bigger one of the same kind that is on file,
  // when one is near enough the size (up to a step or so up), is the better choice.
  const sameKind = (i: CatalogueInverter) =>
    phaseOf(i) === phaseOf(pick.inverter) &&
    (i.hybrid ?? /hybrid/i.test(i.name)) === (pick.inverter.hybrid ?? /hybrid/i.test(pick.inverter.name));
  const onFile = input.inverters
    .filter((i) => i.electrical && sameKind(i) && i.kw >= pick.inverter.kw && i.kw <= Math.max(pick.inverter.kw * 1.7, arrayKw * 1.4))
    .sort((a, b) => a.kw - b.kw)[0];
  return onFile ? { ...pick, inverter: onFile, why: `${pick.why} Its limits are on file, so the strings can be checked.` } : pick;
}

/**
 * Where the inverters and the battery go on the drawing until they are moved (10 Nov 2026, Martin: they stood on the
 * house next door, at a fixed place on the picture): side by side on the home's south wall, the shaded side here and
 * where they are usually fitted, a little inside the roof's edge so the mark sits on the home. The home is the roof's
 * faces, else the panels laid. Metres from the picture's middle (y down, so south is the largest y).
 */
export function kitOnHome(home: Point[], inverters: number): { inverters: Point[]; battery: Point } | null {
  if (!home.length) return null;
  const south = Math.max(...home.map((p) => p.y));
  const wall = home.filter((p) => p.y >= south - KIT.wallBand);
  const xs = wall.map((p) => p.x);
  const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
  const y = r1(south - KIT.inset);
  const first = middle - (inverters * KIT.apart) / 2;
  return {
    inverters: Array.from({ length: inverters }, (_, i) => ({ x: r1(first + i * KIT.apart), y })),
    battery: { x: r1(first + inverters * KIT.apart), y },
  };
}
/** The kit's marks on the south wall: how far up from the southmost edge counts as that wall, how far inside the roof's edge they sit, and how far apart, metres. */
export const KIT = { wallBand: 1.5, inset: 0.9, apart: 2.2 } as const;

/** Where a battery stands when there is nothing to tell where the home is: low on the right of the picture. */
function batterySpot(lat: number) {
  const k = metresPerPixel(lat);
  return { x: r1(ROOF_IMAGE.width * k * 0.36), y: r1(ROOF_IMAGE.height * k * 0.3) };
}

interface Built {
  n: number;
  design: RoofDesign;
  figures: SelfDesignFigures;
  inverter: InverterSuggestion;
}

/**
 * How a design's battery is sized: none; by rule (`battery-suggest.ts`: the evenings, as far as a middling month's
 * spare sun fills them); or for the most independence (Martin): the evenings in full, whatever the roof spares,
 * plus one module held back for blackouts, wired for them (`backup`).
 */
type BatteryWay = "none" | "rule" | "blackout";

/** One design at a count of panels, with its battery, priced and set against the bill. Null when nothing fits it. */
function build(input: SelfDesignInput, source: Source, n: number, way: BatteryWay): Built | null {
  const withBattery = way !== "none";
  const layout = source.layout(n);
  const size = panelOf(layout);
  // What was laid: a count the roof can't hold in rows comes out smaller.
  const panels = designSummary(layout).panels;
  if (panels < n) return null;
  const kw = Math.round(panels * size.watts) / 1000;
  const inverter = inverterFor(input, kw, withBattery);
  if (!inverter) return null;
  const inverters: InverterSpec[] = Array.from({ length: inverter.count }, () => ({
    sku: inverter.inverter.sku,
    name: inverter.inverter.name,
    kw: inverter.inverter.kw,
  }));
  // On the home's south wall (`kitOnHome`): the roof's faces, else the panels laid.
  const home = layout.faces.length ? layout.faces.flatMap((f) => f.points) : (layout.loose ?? []).map((p) => ({ x: p.x, y: p.y }));
  const kit = kitOnHome(home, inverters.length);
  if (kit) kit.inverters.forEach((at, i) => Object.assign(inverters[i], at));
  const year = monthlyProduction(layout, input.yieldPerKwDay);
  let battery: DesignBattery | undefined;
  if (withBattery) {
    const idea = suggestBatteries({
      batteries: input.batteries,
      inverters: inverters.map((i) => ({ name: i.name, hybrid: true })),
      monthlyKwh: year,
      dailyKwh: input.bill ? dailyUse(input.bill) : null,
      selfUseShare: input.selfUseShare,
      eveningShare: DAY.eveningShare,
    });
    const pick = idea.suggestions.find((s) => s.battery.kwh * s.qty >= idea.size) ?? idea.suggestions[0];
    // With evenings too small to size a battery to, a blackout battery is still one module of the inverter's maker.
    const product = pick?.battery ?? (way === "blackout" ? smallestBattery(input.batteries, inverters[0].name) : null);
    if (!product || !(product.kwh > 0)) return null;
    let qty = pick?.qty ?? 0;
    if (way === "blackout") {
      const daily = input.bill ? dailyUse(input.bill) : null;
      // The same product, stacked to hold the whole of the evenings (after what a battery gives back), and one more for blackouts.
      const evenings = daily ? Math.ceil((daily * DAY.eveningShare) / DAY.batteryRoundTrip / product.kwh - 1e-9) : 0;
      qty = Math.max(qty, evenings) + 1;
    }
    battery = {
      sku: product.sku,
      name: product.name,
      kwh: product.kwh,
      qty: Math.min(MAX_BATTERY_QTY, Math.max(1, qty)),
      ...(kit?.battery ?? batterySpot(input.centre.lat)),
      ...(way === "blackout" ? { backup: true } : {}),
    };
  }
  const design: RoofDesign = {
    ...input.centre,
    faces: layout.faces,
    loose: layout.loose ?? [],
    strings: [],
    ...(layout.panel ? { panel: layout.panel } : {}),
    inverters,
    ...(battery ? { battery } : {}),
  };
  const spec = systemSpecOf(design, input.firstListed);
  const costing = costSystem(spec, input.form, input.workspace);
  const stc = stcValue(
    costing,
    /^\d{4}$/.test(input.form.postcode) ? input.form.postcode : null,
    input.date,
    input.rates,
    input.workspace.settings.stcPrice,
  );
  const youPay = Math.max(0, Math.round(costing.priceIncGst - stc));
  const batteryKwh = battery ? r1(battery.kwh * battery.qty) : 0;
  // The module held back for blackouts doesn't carry the evenings.
  const finance = input.bill ? designFinance(input.bill, year, shiftingKwhOf(design), input.selfUseShare) : null;
  const saving = finance ? finance.saving : null;
  return {
    n,
    design,
    inverter,
    figures: {
      panels,
      kw,
      batteryKwh,
      youPay,
      missing: costing.missing,
      saving,
      payback: saving !== null && saving > 0 ? r1(youPay / saving) : null,
      netReturn: saving !== null ? Math.round(saving * RETURN_YEARS - youPay) : null,
      selfReliance: finance ? Math.round(finance.selfReliance * 1000) / 1000 : null,
    },
  };
}

/** The smallest battery on the lists, of the inverter's maker when there is one. */
function smallestBattery(batteries: CatalogueBattery[], inverterName: string): CatalogueBattery | null {
  const maker = makerOf(inverterName);
  const same = batteries.filter((b) => makerOf(b.name) === maker && b.kwh > 0);
  const pool = same.length ? same : batteries.filter((b) => b.kwh > 0);
  return pool.length ? pool.reduce((a, b) => (b.kwh < a.kwh ? b : a)) : null;
}

/** What the home uses a day, worked back from the bill as `designFinance` does it. */
function dailyUse(bill: NonNullable<SelfDesignInput["bill"]>): number | null {
  const f = designFinance(bill, new Array(12).fill(0), 0, 0);
  return f ? f.dailyKwh : null;
}

/** The count of panels nearest a system size, within what the roof takes. */
const countFor = (kw: number, watts: number, most: number) => Math.max(1, Math.min(most, Math.round((kw * 1000) / watts)));

export function selfDesign(input: SelfDesignInput): SelfDesignResult {
  const source =
    (input.faces.length ? tracedSource(input.faces, input.panel, input.newId, input.avoid, input.split) : null) ?? modelSource(input);
  if (!source)
    return {
      options: [],
      from: null,
      notes: [
        input.faces.length
          ? "The traced faces have no room for panels. Check their outlines and the distance kept from the edges."
          : "There's no roof data for this address to design from. Trace the roof faces, then ask again.",
      ],
    };
  const notes: string[] = [];
  const watts = panelOf({ panel: input.panel }).watts;
  const low = Math.min(source.most, MIN_SELF_PANELS);
  const counts = Array.from({ length: source.most - low + 1 }, (_, i) => low + i);
  const hasBill = Boolean(input.bill && dailyUse(input.bill));
  if (!hasBill) notes.push("Add the customer's bill to size these against their payback. Until then they are sized by rule.");

  const nights = hasBill ? (dailyUse(input.bill!) ?? 0) * DAY.eveningShare : null;
  const smallNights = nights !== null && nights < SMALL_NIGHTS_KWH;
  if (smallNights)
    notes.push(
      `The home uses only about ${r1(nights!)} kWh after dark, so a battery would do little for the bill: only the most independence has one, for blackouts.`,
    );
  /** Of every design built, the best by `score` (higher is better); ties within `tie` go to the fewer panels. */
  const best = (built: (Built | null)[], score: (b: Built) => number | null, tie = 0) => {
    let top: Built | null = null;
    for (const b of built) {
      const s = b ? score(b) : null;
      if (!b || s === null) continue;
      if (!top || s > score(top)! + tie) top = b;
    }
    return top;
  };

  // 1. Fastest payback: panels only, the count that pays for itself soonest (without a bill, the usual size).
  const payback = hasBill
    ? best(
        counts.map((n) => build(input, source, n, "none")),
        (b) => (b.figures.payback === null ? null : -b.figures.payback),
        PAYBACK_TIE,
      )
    : build(input, source, countFor(NO_BILL_KW, watts, source.most), "none");

  // 2. Best return: panels and a battery, the most dollars ahead over the years once paid for.
  const returns = hasBill
    ? best(
        // Solar and a battery (Martin: the return, at the cost of a slower payback); panels alone only when a battery would do little.
        counts.map((n) => build(input, source, n, smallNights ? "none" : "rule")),
        (b) => b.figures.netReturn,
      )
    : smallNights
      ? null
      : build(input, source, countFor(NO_BILL_KW, watts, source.most), "rule");

  // 3. Most independence: the whole roof (as much of it as an inverter takes), a battery for the whole of the evenings
  // and one module more held back for blackouts, with the backup wiring.
  // The faces traced are the ones the business means to use; of Google's roof model, `suggestPanels` already lays only
  // the sunny faces. So all of either.
  const whole = source.most;
  let independence: Built | null = null;
  for (let n = whole; n >= low && !independence; n--) independence = build(input, source, n, "blackout");

  const options: SelfDesignOption[] = [];
  const add = (key: SelfDesignKey, b: Built | null, why: (b: Built) => string) => {
    if (!b) return;
    // The same system twice is shown once.
    const same = options.find((o) => o.figures.panels === b.figures.panels && o.figures.batteryKwh === b.figures.batteryKwh);
    if (same) {
      notes.push(`${SELF_DESIGN_LABELS[key]} comes out as the same system as ${same.label.toLowerCase()} for this home.`);
      return;
    }
    const label = SELF_DESIGN_LABELS[key];
    options.push({ key, label, design: { ...b.design, label, goal: key }, figures: b.figures, why: why(b) });
  };
  const kit = (b: Built) => `${b.figures.kw} kW${b.figures.batteryKwh ? ` with a ${b.figures.batteryKwh} kWh battery` : ", no battery"}`;
  const pays = (b: Built) => (b.figures.payback !== null ? ` Pays for itself in about ${b.figures.payback} years.` : "");
  add("payback", payback, (b) =>
    hasBill
      ? `${kit(b)}: the panel count that pays for itself soonest on this bill, for the least outlay.${pays(b)}`
      : `About ${NO_BILL_KW} kW, the usual size for a home, on the sunniest faces.`,
  );
  add("return", returns, (b) =>
    hasBill
      ? `${kit(b)}: the most dollars ahead over ${RETURN_YEARS} years once it's paid for, about ${dollars(b.figures.netReturn ?? 0)}.${pays(b)}`
      : `About ${NO_BILL_KW} kW with a ${b.figures.batteryKwh} kWh battery sized to what the panels spare.`,
  );
  add(
    "independence",
    independence,
    (b) =>
      `The whole roof (${kit(b)}), the battery holding the evenings and one module more held back for blackouts, wired to keep chosen circuits on` +
      (hasBill ? `: about ${Math.round((b.figures.selfReliance ?? 0) * 100)}% of the home's use from its own roof.${pays(b)}` : "."),
  );
  if (!options.length)
    notes.unshift("No inverter on the lists suits these panels on this home's supply. Add one to the price lists, or design by hand.");
  if (options.some((o) => o.figures.missing > 0))
    notes.push("Some products have no cost on file, so their prices are short and the paybacks too quick. Fill them in on the quote.");

  // Strung by rule, now the three are chosen. When the panel's or an inverter's limits aren't on file, it says so once.
  let unstrung = "";
  for (const o of options) {
    const items = (o.design.inverters ?? []).map((spec) => input.inverters.find((i) => i.sku === spec.sku));
    const strung = autoStringDesign(
      o.design,
      items.map((i) => ({ electrical: i?.electrical, name: i?.name })),
      input.panelElectrical,
      input.panel?.name,
    );
    if (strung.strings.length) o.design.strings = strung.strings;
    else unstrung = strung.note;
  }
  if (unstrung) notes.push(`Not strung: ${unstrung}`);
  return { options, notes, from: source.from };
}
