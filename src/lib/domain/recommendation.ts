import type { BillSummary } from "./bill";
import { PANEL } from "./catalogue";
import { YIELD_MODEL, blendedYieldPerKw } from "./sunshine";
import { COSTING, billOfMaterials, inverterOptions, maxPanelsForInverter, sellPrice, type CostGroup, type PartnerPricing } from "./costing";
import { NO_INCENTIVES, VERIFIED_RATES, rebatesFor, type Incentives, type RebateRates } from "./rebates";
import { realAnnualUse, solarSituation } from "./existing-solar";
import type {
  LineItemId,
  AddOn,
  AddOnId,
  EnergyProfile,
  HomeAnalysis,
  PriceBreakdown,
  Recommendation,
  SystemConfig,
  SystemEstimate,
  RoofType,
  SystemTier,
  UsageBasis,
} from "./types";

/**
 * Assumptions used by the sizing model. Usage and prices come from the
 * customer's bill; these fill the gaps. Product costs live in catalogue.ts and
 * costing.ts. PLACEHOLDERS: validate with installer partners before launch.
 */
const PANEL_WATTS = PANEL.watts;
/** The smallest system RENUABL offers. */
const MIN_SYSTEM_KW = 5;

export const ASSUMPTIONS = {
  panelWatts: PANEL_WATTS,
  minSystemKw: MIN_SYSTEM_KW,
  minPanels: Math.ceil((MIN_SYSTEM_KW * 1000) / PANEL_WATTS), // 11 x 475 W = 5.2 kW
  /** The most the largest inverter allows (array <= 133% of its rating): 10 kW single phase, 15 kW three phase. */
  maxPanels: maxPanelsForInverter(inverterOptions("hybrid", "three")),
  maxPanelsSinglePhase: maxPanelsForInverter(inverterOptions("hybrid", "single")),
  tariffPerKwh: 0.3,
  feedInPerKwh: 0.04,
  /** Used when a home's NASA sunshine isn't known: Melbourne average. */
  dailyYieldKwhPerKw: 3.8,
  /** Used when the bill doesn't split usage by time of day. */
  eveningShare: 0.6,
  /** Homes with solar buy most of their grid power after dark. */
  solarHomeEveningShare: 0.75,
  evAnnualKwh: 2500,
  baseSelfConsumption: 0.4,
  /**
   * PLACEHOLDER: the most of a home's yearly use we claim solar (and a battery)
   * covers. Winter days and cloudy weeks always need some grid power, so
   * estimates never say 100%.
   */
  maxSolarShare: 0.9,
  /** SigenStor 8 kWh modules, up to one stack of six. */
  batterySizes: [8, 16, 24, 32, 40, 48] as const,
  batteryUsableShare: 0.9,
  /**
   * With a battery (now or planned), solar is sized this much above annual use
   * so there's daytime surplus to charge it, including through winter.
   * PLACEHOLDER: confirm with Primero.
   */
  batteryReadySolar: 1.25,
  /** Taken after the confirmation call. Nothing is charged to reserve a date. */
  deposit: 499,
} as const;

/**
 * Optional products offered after the system recommendation. Only costed ones
 * carry a price; the rest (heat pumps and the placeholders) are "discuss on my
 * call": no price, not in the total, passed to the call.
 */
export const ADD_ONS: AddOn[] = [
  { id: "heat-pump", name: "Heat Pump Hot Water", blurb: "Efficient, all-electric hot water.", price: null },
  { id: "smart-switchboard", name: "Smart Switchboard", blurb: "Prepare for a smarter, safer home.", price: null },
  { id: "home-backup", name: "Home Backup", blurb: "Keep essentials running during outages.", price: null },
  { id: "smart-home", name: "Smart Home Integration", blurb: "Connect and optimise your whole home.", price: null },
];

/** A costed add-on the customer can buy now (the rest are discussed on the call). */
export function isPricedAddOn(id: AddOnId) {
  return ADD_ONS.find((a) => a.id === id)?.price != null;
}

/** Display order is the key order: good, better, best. */
export const TIER_LABELS: Record<SystemTier, string> = {
  essential: "Essential",
  recommended: "Recommended",
  independence: "Maximum",
};

/**
 * What the home actually uses, plus a planned EV the bill can't show yet.
 * With existing solar the bill shows only grid purchases: expanding keeps that
 * (the battery covers them); replacing adds back the solar the home uses itself.
 */
export function usageBasis(
  bill: BillSummary,
  profile: EnergyProfile,
  dailyYieldKwhPerKw: number = ASSUMPTIONS.dailyYieldKwhPerKw,
): UsageBasis {
  const situation = solarSituation(bill, profile);
  const base = situation === "replace" ? realAnnualUse(bill) : bill.annualUsageKwh;
  const annualKwh = base + (profile.evPlanned ? ASSUMPTIONS.evAnnualKwh : 0);
  return {
    annualKwh,
    dailyKwh: Math.round((annualKwh / 365) * 10) / 10,
    eveningShare: bill.eveningShare ?? (situation === "expand" ? ASSUMPTIONS.solarHomeEveningShare : ASSUMPTIONS.eveningShare),
    usageRate: bill.usageRate ?? ASSUMPTIONS.tariffPerKwh,
    feedInRate: bill.feedInRate ?? ASSUMPTIONS.feedInPerKwh,
    existingSolar: situation === "expand" ? { exportedDailyKwh: bill.exportedDailyKwh ?? 0 } : null,
    dailyYieldKwhPerKw,
  };
}

export function panelsToKw(panelCount: number): number {
  return Math.round(((panelCount * ASSUMPTIONS.panelWatts) / 1000) * 10) / 10;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Panels to cover a year's use, within the roof's limit. A home with a
 * battery, now or planned, needs extra generation to charge it.
 */
export function panelsNeeded(
  annualKwh: number,
  analysis: Pick<HomeAnalysis, "maxPanels">,
  battery = false,
  dailyYieldKwhPerKw: number = ASSUMPTIONS.dailyYieldKwhPerKw,
) {
  const kw = (annualKwh * (battery ? ASSUMPTIONS.batteryReadySolar : 1)) / (dailyYieldKwhPerKw * 365);
  return clamp(Math.ceil((kw * 1000) / ASSUMPTIONS.panelWatts), ASSUMPTIONS.minPanels, Math.min(ASSUMPTIONS.maxPanels, analysis.maxPanels));
}

/** Smallest standard battery that covers a typical evening and night; one size up for backup. */
export function batteryNeeded(usage: UsageBasis, backup: boolean): number {
  const sizes = ASSUMPTIONS.batterySizes;
  const overnight = usage.dailyKwh * usage.eveningShare;
  let i = sizes.findIndex((s) => s * ASSUMPTIONS.batteryUsableShare >= overnight);
  if (i === -1) i = sizes.length - 1;
  if (backup) i = Math.min(i + 1, sizes.length - 1);
  return sizes[i];
}

function previousBatterySize(kwh: number) {
  return [...ASSUMPTIONS.batterySizes].reverse().find((s) => s < kwh) ?? kwh;
}

/** Evening grid use a battery can cover each day. */
function eveningKwh(usage: UsageBasis) {
  return usage.dailyKwh * usage.eveningShare;
}

/**
 * Extra panels for an existing system, only when what it exports today can't
 * fill the battery (with the same winter headroom as a new system).
 */
export function topUpPanels(usage: UsageBasis, batteryKwh: number, analysis: Pick<HomeAnalysis, "maxPanels">) {
  if (!usage.existingSolar) return 0;
  const toStore = Math.min(batteryKwh * ASSUMPTIONS.batteryUsableShare, eveningKwh(usage));
  const shortfall = toStore * ASSUMPTIONS.batteryReadySolar - usage.existingSolar.exportedDailyKwh;
  if (shortfall <= 0) return 0;
  const perPanelDaily = (ASSUMPTIONS.panelWatts / 1000) * usage.dailyYieldKwhPerKw;
  return Math.min(Math.ceil(shortfall / perPanelDaily), analysis.maxPanels);
}

const kwh = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 1 });

/**
 * Three options sized from the customer's bill; they differ in battery. Solar
 * covers what the home uses, plus charging headroom whenever there's a battery
 * now or planned. The customer doesn't pick panel counts or battery sizes.
 */
export function recommendSystem(profile: EnergyProfile, analysis: HomeAnalysis, bill: BillSummary): Recommendation {
  const flat = panelsLaidFlat(profile);
  const dailyYield =
    blendedYieldPerKw(analysis.sunshine, analysis.roofSunHours, flat) ??
    (flat
      ? Math.round(((ASSUMPTIONS.dailyYieldKwhPerKw * YIELD_MODEL.flatGain) / YIELD_MODEL.tiltGain) * 100) / 100
      : ASSUMPTIONS.dailyYieldKwhPerKw);
  const usage = usageBasis(bill, profile, dailyYield);
  if (usage.existingSolar) return expandSystem(profile, analysis, usage);
  const replacing = solarSituation(bill, profile) === "replace";
  const panelsForUse = panelsNeeded(usage.annualKwh, analysis, profile.wantsBattery, usage.dailyYieldKwhPerKw);
  const panelsWithBattery = panelsNeeded(usage.annualKwh, analysis, true, usage.dailyYieldKwhPerKw);
  const battery = batteryNeeded(usage, profile.backup);
  const sizedTo = (charging: boolean) =>
    `Solar sized to your ${kwh(usage.dailyKwh)} kWh a day${profile.evPlanned ? ", including your future EV" : ""}${charging ? ", plus enough to charge a battery" : ""}`;
  const covers = (b: number) =>
    `A ${kwh(b)} kWh battery covers ${b * ASSUMPTIONS.batteryUsableShare >= usage.dailyKwh * usage.eveningShare ? "your" : "most of your"} evening use`;

  const replaces = (why: string[]) => (replacing ? ["Replaces your current solar system", ...why] : why);

  return {
    usage,
    tiers: {
      essential: {
        tier: "essential",
        config: { panelCount: panelsForUse, batteryKwh: 0, evCharger: false, ...(profile.wantsBattery ? { batteryReady: true } : {}) },
        why: replaces([
          sizedTo(profile.wantsBattery),
          "Lowest upfront cost",
          profile.wantsBattery ? "Solar ready for a battery whenever you add one" : "Add a battery any time",
        ]),
      },
      recommended: {
        tier: "recommended",
        config: { panelCount: panelsWithBattery, batteryKwh: battery, evCharger: false },
        why: replaces([sizedTo(true), covers(battery), profile.backup ? "Keeps essentials on during outages" : "Maximises your savings"]),
      },
      independence: {
        tier: "independence",
        config: { panelCount: panelsWithBattery, batteryKwh: battery, evCharger: true },
        why: replaces([sizedTo(true), covers(battery), "A smart EV charger, powered by your own sun"]),
      },
    },
  };
}

/**
 * Keeping existing solar: every option is a battery for the power the home
 * still buys after dark, plus extra panels only if today's exports can't fill it.
 */
function expandSystem(profile: EnergyProfile, analysis: HomeAnalysis, usage: UsageBasis): Recommendation {
  const battery = batteryNeeded(usage, profile.backup);
  const small = previousBatterySize(battery);
  const exported = usage.existingSolar?.exportedDailyKwh ?? 0;
  const option = (batteryKwh: number, withPanels: boolean, evCharger: boolean): SystemConfig => ({
    panelCount: withPanels ? topUpPanels(usage, batteryKwh, analysis) : 0,
    batteryKwh,
    evCharger,
    existingSolar: true,
  });
  const essential = option(small, false, false);
  const recommended = option(battery, true, false);
  const independence = option(battery, true, true);
  const stores = (b: number) =>
    `A ${kwh(b)} kWh battery covers ${b * ASSUMPTIONS.batteryUsableShare >= eveningKwh(usage) ? "the" : "most of the"} ${kwh(eveningKwh(usage))} kWh you buy each evening`;
  const panels = (c: SystemConfig) =>
    c.panelCount > 0
      ? `Adds ${c.panelCount} panels so the battery fills, even in winter`
      : exported > 0
        ? `Charged by the ${kwh(exported)} kWh a day your panels export now`
        : "Charged by your existing panels";

  return {
    usage,
    tiers: {
      essential: { tier: "essential", config: essential, why: ["Keeps your existing solar", stores(small), "Lowest upfront cost"] },
      recommended: {
        tier: "recommended",
        config: recommended,
        why: ["Keeps your existing solar", stores(battery), panels(recommended)],
      },
      independence: {
        tier: "independence",
        config: independence,
        why: ["Keeps your existing solar", stores(battery), panels(independence), "A smart EV charger, powered by your own sun"],
      },
    },
  };
}

export function estimateOutcome(config: SystemConfig, usage: UsageBasis, price: PriceBreakdown): SystemEstimate {
  const solarKw = panelsToKw(config.panelCount);
  const generation = Math.round(solarKw * usage.dailyYieldKwhPerKw * 365);
  const payback = (savings: number) => (savings > 0 ? Math.round((price.total / savings) * 10) / 10 : 0);

  if (usage.existingSolar) {
    // Existing solar: the battery stores exports (and any new panels) for the evening.
    const exported = usage.existingSolar.exportedDailyKwh * 365;
    const available = exported + generation;
    const stored = Math.min(config.batteryKwh * ASSUMPTIONS.batteryUsableShare * 365, eveningKwh(usage) * 365, available);
    const storedFromExisting = Math.min(stored, exported);
    const storedFromNew = stored - storedFromExisting;
    const annualSavings = Math.round(
      stored * usage.usageRate - storedFromExisting * usage.feedInRate + (generation - storedFromNew) * usage.feedInRate,
    );
    return {
      solarKw,
      annualGenerationKwh: generation,
      annualSavings,
      paybackYears: payback(annualSavings),
      selfPoweredShare: usage.annualKwh > 0 ? Math.min(ASSUMPTIONS.maxSolarShare, stored / usage.annualKwh) : 0,
    };
  }

  let selfUse: number = ASSUMPTIONS.baseSelfConsumption;
  if (config.batteryKwh > 0) selfUse += Math.min(0.4, config.batteryKwh / 40);
  if (config.evCharger) selfUse += 0.05;
  selfUse = Math.min(0.9, selfUse);

  const consumedFromSolar = Math.min(usage.annualKwh * ASSUMPTIONS.maxSolarShare, generation * selfUse);
  const exported = Math.max(0, generation - consumedFromSolar);
  const annualSavings = Math.round(consumedFromSolar * usage.usageRate + exported * usage.feedInRate);

  return {
    solarKw,
    annualGenerationKwh: generation,
    annualSavings,
    paybackYears: payback(annualSavings),
    selfPoweredShare: usage.annualKwh > 0 ? consumedFromSolar / usage.annualKwh : 0,
  };
}

export interface Site {
  storeys: "single" | "double";
  roof: RoofType;
  phase: "single" | "three";
  /** Flat roof with panels on tilt frames. */
  tilt?: boolean;
}

/** Panels laid flat on a flat roof (the default there): they make a little less, so more are needed. */
export function panelsLaidFlat(profile: Pick<EnergyProfile, "roofType" | "flatMount">) {
  return profile.roofType === "flat" && profile.flatMount !== "tilt";
}

const LINE_LABELS: Partial<Record<CostGroup, string>> = {
  "ev-charger": "Smart EV charger",
};

/**
 * The customer's price: the system's bill of materials at supplier cost, plus
 * installation, margin and GST, grouped into the lines they see, less rebates.
 */
export function priceSystem(
  config: SystemConfig,
  site: Site,
  addOns: AddOnId[] = [],
  incentives: Incentives = NO_INCENTIVES,
  rates: RebateRates = VERIFIED_RATES,
  /** The matched partner's pricing; RENUABL's own rates and margin when absent. */
  partner?: PartnerPricing,
): PriceBreakdown {
  const priced = addOns.filter(isPricedAddOn);
  const bom = billOfMaterials({
    ...config,
    roof: site.roof,
    tilt: site.tilt,
    storeys: site.storeys,
    phase: site.phase,
    addOns: priced,
    partner,
  });
  const price = (c: number) => sellPrice(c, partner?.margin);
  const cost = (group: CostGroup) => bom.filter((l) => l.group === group).reduce((sum, l) => sum + l.total, 0);
  const solarKw = panelsToKw(config.panelCount);
  const lines: PriceBreakdown["lines"] = [];

  if (cost("solar") > 0) {
    const label =
      config.panelCount > 0 ? `${solarKw} kW ${config.existingSolar ? "extra " : ""}solar (${config.panelCount} panels)` : "Solar";
    lines.push({ id: "solar", label, amount: price(cost("solar")), removable: false });
  }
  if (config.batteryKwh > 0) {
    lines.push({ id: "battery", label: `${config.batteryKwh} kWh battery`, amount: price(cost("battery")), removable: true });
  }
  if (config.evCharger)
    lines.push({ id: "ev-charger", label: LINE_LABELS["ev-charger"]!, amount: price(cost("ev-charger")), removable: true });
  for (const id of priced) {
    const addOn = ADD_ONS.find((a) => a.id === id);
    if (addOn) lines.push({ id: addOn.id, label: addOn.name, amount: price(cost(id)), removable: true });
  }
  const discuss = ADD_ONS.filter((a) => addOns.includes(a.id) && a.price == null).map((a) => ({ id: a.id, label: a.name }));

  const gross = lines.reduce((sum, l) => sum + l.amount, 0);
  const solarLine = lines.find((l) => l.id === "solar")?.amount ?? 0;
  const rebates = rebatesFor(config, incentives, rates, solarLine);
  const rebateTotal = Math.min(gross, rebates.total);
  const total = gross - rebateTotal;
  const loan = Math.min(rebates.loan, total);

  return {
    lines,
    bom,
    gross,
    rebates: rebateTotal,
    rebateLines: rebates.lines,
    loan,
    outOfPocket: total - loan,
    total,
    deposit: ASSUMPTIONS.deposit,
    discuss,
  };
}

/** Plain-language one-liner of a system, e.g. "13.2 kW solar + 13.5 kWh battery + EV charger + monitoring". */
export function describeSystem(config: SystemConfig) {
  const parts: string[] = [];
  if (config.existingSolar) parts.push("Your existing solar");
  if (config.panelCount > 0) parts.push(`${panelsToKw(config.panelCount)} kW ${config.existingSolar ? "extra " : ""}solar`);
  if (config.batteryKwh > 0) parts.push(`${config.batteryKwh} kWh battery`);
  if (config.evCharger) parts.push("EV charger");
  parts.push("monitoring");
  return parts.join(" + ");
}

/** Short package name for installer views, e.g. "Solar + Battery". */
export function packageLabel(config: SystemConfig) {
  const parts: string[] = [];
  if (config.panelCount > 0) parts.push("Solar");
  if (config.batteryKwh > 0) parts.push("Battery");
  if (config.evCharger) parts.push("EV Charger");
  return parts.join(" + ");
}

export function isSameConfig(a: SystemConfig, b: SystemConfig) {
  return (
    a.panelCount === b.panelCount &&
    a.batteryKwh === b.batteryKwh &&
    a.evCharger === b.evCharger &&
    !a.existingSolar === !b.existingSolar &&
    !a.batteryReady === !b.batteryReady
  );
}

export interface SuggestedAddition {
  id: LineItemId;
  label: string;
  blurb: string;
  amount: number;
}

/**
 * "Add to your system" suggestions at checkout: anything optional the
 * customer doesn't have yet (including items they just removed).
 */
export function suggestedAdditions(config: SystemConfig, recommended: SystemConfig, addOns: AddOnId[], site: Site): SuggestedAddition[] {
  const out: SuggestedAddition[] = [];
  const base = priceSystem(config, site, addOns).gross;
  const added = (patch: Partial<SystemConfig>) => priceSystem({ ...config, ...patch }, site, addOns).gross - base;
  if (config.batteryKwh === 0) {
    const size = recommended.batteryKwh || ASSUMPTIONS.batterySizes[0];
    out.push({
      id: "battery",
      label: `${size} kWh battery`,
      blurb: "Use your sunshine at night and keep essentials on in outages.",
      amount: added({ batteryKwh: size }),
    });
  }
  if (!config.evCharger) {
    out.push({
      id: "ev-charger",
      label: "Smart EV charger",
      blurb: "Charge your car from surplus solar.",
      amount: added({ evCharger: true }),
    });
  }
  for (const a of ADD_ONS) {
    if (a.price != null && !addOns.includes(a.id)) out.push({ id: a.id, label: a.name, blurb: a.blurb, amount: a.price });
  }
  return out;
}

export { COSTING };
