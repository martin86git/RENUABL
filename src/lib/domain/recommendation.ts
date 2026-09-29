import type { BillSummary } from "./bill";
import { PANEL } from "./catalogue";
import { YIELD_MODEL, blendedYieldPerKw, type Sunshine } from "./sunshine";
import {
  COSTING,
  arrayRatio,
  billOfMaterials,
  inverterOptions,
  maxPanelsForInverter,
  sellPrice,
  type CostGroup,
  type PartnerPricing,
} from "./costing";
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
  /**
   * Winter (June to August) sunshine as a share of the year's average, used
   * when NASA's monthly figures aren't known. Melbourne is about half
   * (BoM/NASA: roughly 2 kWh/m² a day in winter against 4 over the year).
   */
  winterSunShare: 0.5,
  /** Used when the bill doesn't split usage by time of day. */
  eveningShare: 0.6,
  /** Homes with solar buy most of their grid power after dark. */
  solarHomeEveningShare: 0.75,
  evAnnualKwh: 2500,
  /**
   * PLACEHOLDER rule of thumb: the share of what the panels make that the home
   * uses as it's made (30–40% is typical in Australia without a battery). The
   * rest is surplus: it charges the battery, then goes to the grid.
   */
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
   * Existing solar being expanded: today's exports need this much headroom to
   * fill the battery, or extra panels are added. PLACEHOLDER: confirm with Primero.
   */
  batteryReadySolar: 1.25,
  /** Taken after the confirmation call. Nothing is charged to reserve a date. */
  deposit: 499,
} as const;

/**
 * Optional products offered after the system recommendation. Only costed ones
 * carry a price; the rest (the placeholders) are "discuss on my call": no
 * price, not in the total, passed to the call. Coming-soon products (home
 * electrification) take interest only: "Let me know when it's available".
 */
export const ADD_ONS: AddOn[] = [
  {
    id: "home-backup",
    name: "Blackout Backup",
    blurb: "Wire in backup circuits so your battery keeps them on in a blackout.",
    price: sellPrice(COSTING.backupCircuitsInstall),
    needsBattery: true,
  },
  { id: "smart-switchboard", name: "Smart Switchboard", blurb: "Prepare for a smarter, safer home.", price: null },
  { id: "smart-home", name: "Smart Home Integration", blurb: "Connect and optimise your whole home.", price: null },
  {
    id: "reverse-cycle",
    name: "Reverse-Cycle Heating & Cooling",
    blurb: "All-electric heating and cooling, powered by your sun.",
    price: null,
    comingSoon: true,
  },
  { id: "heat-pump", name: "Heat Pump Hot Water", blurb: "Efficient, all-electric hot water.", price: null, comingSoon: true },
];

/** A costed add-on the customer can buy now (the rest are discussed on the call, or coming soon). */
export function isPricedAddOn(id: AddOnId) {
  const a = ADD_ONS.find((x) => x.id === id);
  return a?.price != null && !a.comingSoon;
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
  winterYieldKwhPerKw: number = winterYield(dailyYieldKwhPerKw),
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
    winterYieldKwhPerKw,
  };
}

/**
 * Winter output per kW: the year's figure scaled by NASA's June–August
 * sunshine at the home against its yearly average (or Melbourne's share).
 */
export function winterYield(yearlyYieldKwhPerKw: number, sun?: Pick<Sunshine, "annual" | "monthly"> | null) {
  const share =
    sun && sun.annual > 0 && sun.monthly.length === 12
      ? (sun.monthly[5] + sun.monthly[6] + sun.monthly[7]) / 3 / sun.annual
      : ASSUMPTIONS.winterSunShare;
  return Math.round(yearlyYieldKwhPerKw * share * 100) / 100;
}

/**
 * One day of solar, by the rule of thumb: the home uses
 * `baseSelfConsumption` (40%) of what the panels make as it's made (never more
 * than it uses in a day); everything else it uses is after dark. The surplus
 * (60%) charges the battery up to what the home needs after dark, and the rest
 * goes to the grid.
 */
export function solarDay(solarKw: number, yieldKwhPerKw: number, dailyKwh: number, batteryUsableKwh = 0, evCharger = false) {
  const made = solarKw * yieldKwhPerKw;
  const selfUse = ASSUMPTIONS.baseSelfConsumption + (evCharger ? 0.05 : 0);
  const usedAsMade = Math.min(made * selfUse, dailyKwh);
  const afterDark = dailyKwh - usedAsMade;
  const surplus = made - usedAsMade;
  const stored = Math.min(batteryUsableKwh, surplus, afterDark);
  return { made, usedAsMade, afterDark, surplus, stored, exported: surplus - stored, fromGrid: afterDark - stored };
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

/** Panels that fill an inverter to the array limit: 133% of its rating, or more with a DC-coupled battery (`arrayRatio`). */
export function panelsToFillInverter(inverterKw: number, withBattery = true) {
  return Math.floor((inverterKw * arrayRatio(withBattery) * 1000) / ASSUMPTIONS.panelWatts);
}

/**
 * Solar for a home with a battery, sized for winter: the smallest hybrid
 * inverter, filled to its with-battery array limit
 * (`COSTING.maxArrayToHybridWithBattery`), whose winter surplus (60% of what it
 * makes) can fill the battery for everything the home uses after dark. That
 * means a winter day's solar at least matches the day's use. Never less than
 * `minPanels` (Essential's solar) and within the roof and the largest inverter.
 */
export function panelsForBattery(
  usage: Pick<UsageBasis, "dailyKwh" | "winterYieldKwhPerKw">,
  analysis: Pick<HomeAnalysis, "maxPanels">,
  phase: "single" | "three" = "single",
  minPanels: number = ASSUMPTIONS.minPanels,
) {
  const options = inverterOptions("hybrid", phase);
  const limit = Math.min(maxPanelsForInverter(options, arrayRatio(true)), analysis.maxPanels);
  for (const inverter of options) {
    const panels = clamp(panelsToFillInverter(inverter.kw), Math.min(minPanels, limit), limit);
    const winter = solarDay(panelsKw(panels), usage.winterYieldKwhPerKw, usage.dailyKwh);
    if (winter.surplus >= winter.afterDark || panels >= limit) return panels;
  }
  return limit;
}

/** Smallest standard battery that holds a given night's use; one size up for backup. */
export function batteryFor(afterDarkKwh: number, backup: boolean): number {
  const sizes = ASSUMPTIONS.batterySizes;
  let i = sizes.findIndex((s) => s * ASSUMPTIONS.batteryUsableShare >= afterDarkKwh);
  if (i === -1) i = sizes.length - 1;
  if (backup) i = Math.min(i + 1, sizes.length - 1);
  return sizes[i];
}

/** Existing solar: the battery covers what the home buys after dark (from the bill). */
export function batteryNeeded(usage: UsageBasis, backup: boolean): number {
  return batteryFor(usage.dailyKwh * usage.eveningShare, backup);
}

/** A new system's battery: what the home uses after dark on a winter day, with this much solar. */
export function batteryForSolar(usage: UsageBasis, panelCount: number, backup: boolean): number {
  return batteryFor(solarDay(panelsKw(panelCount), usage.winterYieldKwhPerKw, usage.dailyKwh).afterDark, backup);
}

/** Exact kW of a panel count (panelsToKw rounds for display). */
function panelsKw(panelCount: number) {
  return (panelCount * ASSUMPTIONS.panelWatts) / 1000;
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
  const usage = usageBasis(bill, profile, dailyYield, winterYield(dailyYield, analysis.sunshine));
  if (usage.existingSolar) return expandSystem(profile, analysis, usage);
  const replacing = solarSituation(bill, profile) === "replace";
  // Essential: the least solar that covers what the home uses (never below the minimum system).
  const panelsForUse = panelsNeeded(usage.annualKwh, analysis, false, usage.dailyYieldKwhPerKw);
  // With a battery: sized for winter, so the surplus fills the battery for the night.
  const panelsWithBattery = panelsForBattery(usage, analysis, profile.phase === "three" ? "three" : "single", panelsForUse);
  const battery = batteryForSolar(usage, panelsWithBattery, profile.backup);
  const winterNight = solarDay(panelsKw(panelsWithBattery), usage.winterYieldKwhPerKw, usage.dailyKwh).afterDark;
  const sizedTo = (charging: boolean) =>
    charging
      ? `Solar sized to your ${kwh(usage.dailyKwh)} kWh a day${profile.evPlanned ? " (including your future EV)" : ""}, with extra to fill your battery, even in winter`
      : `Solar sized to your ${kwh(usage.dailyKwh)} kWh a day${profile.evPlanned ? ", including your future EV" : ""}`;
  const covers = (b: number) =>
    `A ${kwh(b)} kWh battery covers ${b * ASSUMPTIONS.batteryUsableShare >= winterNight ? "your" : "most of your"} evening use`;

  const replaces = (why: string[]) => (replacing ? ["Replaces your current solar system", ...why] : why);

  return {
    usage,
    tiers: {
      essential: {
        tier: "essential",
        config: { panelCount: panelsForUse, batteryKwh: 0, evCharger: false },
        why: replaces([sizedTo(false), "Lowest upfront cost", "Add a battery any time"]),
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

/** Under every price: what it covers (brands are talked through on the call, not listed). */
export const PRICE_INCLUDES = "Includes installation, the inverter, electrical work, commissioning and GST.";

/** Blackout backup: the battery can run backup circuits; wiring them in is a priced extra ("Blackout Backup"). */
export function backupNote(hasBackup: boolean) {
  const extra = ADD_ONS.find((a) => a.id === "home-backup")?.price ?? 0;
  return hasBackup
    ? "Blackout backup is added: in a blackout, your backup circuits switch to the battery. We'll agree which circuits on your 15-minute call."
    : `Your battery can keep chosen circuits on in a blackout. Wiring them in is an optional extra (Blackout Backup, $${extra.toLocaleString("en-AU")} installed), which you can add on the next step.`;
}

/** Under the system on the system step: the size is a recommendation until the roof is checked. */
export const ROOF_SIZE_NOTE =
  "Your final system size is confirmed on your 15-minute call, once we've checked how many panels fit on your roof. If fewer fit, we'll adjust the system and the price before anything is final.";

/**
 * "How we worked this out" on the system step: the sizing in plain words, with
 * the customer's own figures. New systems only (expansions explain themselves).
 */
export function sizingExplanation(
  usage: UsageBasis,
  config: Pick<SystemConfig, "panelCount" | "batteryKwh">,
  opts: { nasa: boolean; replacing?: boolean },
): string[] {
  const one = (n: number) => kwh(Math.round(n * 10) / 10);
  const selfUse = Math.round(ASSUMPTIONS.baseSelfConsumption * 100);
  const lines = [
    `Your home uses about ${one(usage.dailyKwh)} kWh a day, ${opts.replacing ? "estimated from your bill and what your current panels export" : "from your bill"}.`,
    `${opts.nasa ? "NASA's sunshine records for your home" : "Melbourne's sunshine averages"} say each kW of panels makes about ${one(usage.dailyYieldKwhPerKw)} kWh a day over a year, and about ${one(usage.winterYieldKwhPerKw)} in winter (June to August), when the sun is weakest.`,
    `As a rule of thumb, a home uses about ${selfUse}% of its solar as it's made. The other ${100 - selfUse}% is spare: it charges a battery, then goes to the grid.`,
  ];
  const solarKw = panelsKw(config.panelCount);
  if (config.batteryKwh > 0) {
    const winter = solarDay(solarKw, usage.winterYieldKwhPerKw, usage.dailyKwh);
    const usable = config.batteryKwh * ASSUMPTIONS.batteryUsableShare;
    lines.push(
      `With a battery we size for winter. On a winter day ${one(solarKw)} kW makes about ${one(winter.made)} kWh: about ${one(winter.usedAsMade)} is used as it's made, leaving about ${one(winter.afterDark)} kWh for after dark.`,
      `A ${kwh(config.batteryKwh)} kWh battery holds about ${one(usable)} kWh${usable >= winter.afterDark ? ", enough for that" : ", most of that"}, and the ${one(winter.surplus)} kWh of spare solar ${winter.surplus >= Math.min(usable, winter.afterDark) ? "can fill it" : "fills part of it"}. In summer there's plenty to spare.`,
      `A battery inverter can take panels up to ${Math.round(arrayRatio(true) * 100)}% of its rating, so we fill it: the inverter costs the same, and the extra panels help most in winter.`,
    );
  } else {
    lines.push(
      config.panelCount <= ASSUMPTIONS.minPanels
        ? `Essential is the least solar that covers your yearly use. For your home that's under our smallest system, so it's ${ASSUMPTIONS.minSystemKw} kW.`
        : "Essential is the least solar that covers your yearly use: no bigger than you need.",
    );
  }
  lines.push(
    "It's never more solar than Google's roof data says could fit. These are estimates, not guarantees: your roof, shading and switchboard are checked on your 15-minute call.",
  );
  return lines;
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

  // An average day by the same rule of thumb as the sizing: 40% used as it's made, the surplus fills the battery.
  const day = solarDay(
    solarKw,
    usage.dailyYieldKwhPerKw,
    usage.dailyKwh,
    config.batteryKwh * ASSUMPTIONS.batteryUsableShare,
    config.evCharger,
  );
  const consumedFromSolar = Math.min(usage.annualKwh * ASSUMPTIONS.maxSolarShare, (day.usedAsMade + day.stored) * 365);
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
  const priced = addOns.filter((id) => isPricedAddOn(id) && (config.batteryKwh > 0 || !ADD_ONS.find((a) => a.id === id)?.needsBattery));
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
  const discuss = ADD_ONS.filter((a) => addOns.includes(a.id) && a.price == null && !a.comingSoon).map((a) => ({
    id: a.id,
    label: a.name,
  }));
  const interested = ADD_ONS.filter((a) => addOns.includes(a.id) && a.comingSoon).map((a) => ({ id: a.id, label: a.name }));

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
    interested,
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
      blurb: "Use your sunshine at night.",
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
    if (a.needsBattery && config.batteryKwh === 0) continue;
    if (a.price != null && !addOns.includes(a.id)) out.push({ id: a.id, label: a.name, blurb: a.blurb, amount: a.price });
  }
  return out;
}

export { COSTING };
