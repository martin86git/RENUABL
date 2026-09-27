import type { BillSummary } from "./bill";
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
  SystemTier,
  UsageBasis,
} from "./types";

/**
 * Assumptions used by the first-pass sizing and pricing model. Usage and
 * prices come from the customer's bill; these fill the gaps.
 * PLACEHOLDERS: validate every figure with installer partners before launch.
 */
const PANEL_WATTS = 440;
/** The smallest system RENUABL offers. */
const MIN_SYSTEM_KW = 5;

export const ASSUMPTIONS = {
  panelWatts: PANEL_WATTS,
  minSystemKw: MIN_SYSTEM_KW,
  minPanels: Math.ceil((MIN_SYSTEM_KW * 1000) / PANEL_WATTS), // 12 panels = 5.3 kW
  maxPanels: 36,
  tariffPerKwh: 0.3,
  feedInPerKwh: 0.04,
  dailyYieldKwhPerKw: 3.8, // Melbourne average
  /** Used when the bill doesn't split usage by time of day. */
  eveningShare: 0.6,
  evAnnualKwh: 2500,
  baseSelfConsumption: 0.4,
  batterySizes: [10, 13.5, 20, 27] as const, // 27 = two 13.5 kWh units
  batteryUsableShare: 0.9,
  /**
   * With a battery (now or planned), solar is sized this much above annual use
   * so there's daytime surplus to charge it, including through winter.
   * PLACEHOLDER: confirm with Primero.
   */
  batteryReadySolar: 1.25,
  prices: {
    solarPerKw: 1050,
    batteryPerKwh: 850,
    evCharger: 1650,
    monitoring: 350,
    doubleStorey: 650,
  },
  rebates: {
    solarPerKw: 370,
    batteryShare: 0.3,
  },
  deposit: 499,
} as const;

/** Optional products offered after the system recommendation. Prices are placeholders. */
export const ADD_ONS: AddOn[] = [
  { id: "heat-pump", name: "Heat Pump Hot Water", blurb: "Efficient, all-electric hot water.", price: 3900 },
  { id: "smart-switchboard", name: "Smart Switchboard", blurb: "Prepare for a smarter, safer home.", price: 1450 },
  { id: "home-backup", name: "Home Backup", blurb: "Keep essentials running during outages.", price: 1850 },
  { id: "smart-home", name: "Smart Home Integration", blurb: "Connect and optimise your whole home.", price: 690 },
];

/** Display order is the key order: good, better, best. */
export const TIER_LABELS: Record<SystemTier, string> = {
  essential: "Essential",
  recommended: "Recommended",
  independence: "Maximum",
};

/** What the home actually uses (from the bill), plus a planned EV the bill can't show yet. */
export function usageBasis(bill: BillSummary, profile: EnergyProfile): UsageBasis {
  const annualKwh = bill.annualUsageKwh + (profile.evPlanned ? ASSUMPTIONS.evAnnualKwh : 0);
  return {
    annualKwh,
    dailyKwh: Math.round((annualKwh / 365) * 10) / 10,
    eveningShare: bill.eveningShare ?? ASSUMPTIONS.eveningShare,
    usageRate: bill.usageRate ?? ASSUMPTIONS.tariffPerKwh,
    feedInRate: bill.feedInRate ?? ASSUMPTIONS.feedInPerKwh,
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
export function panelsNeeded(annualKwh: number, analysis: Pick<HomeAnalysis, "maxPanels">, battery = false) {
  const kw = (annualKwh * (battery ? ASSUMPTIONS.batteryReadySolar : 1)) / (ASSUMPTIONS.dailyYieldKwhPerKw * 365);
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

function nextBatterySize(kwh: number) {
  return ASSUMPTIONS.batterySizes.find((s) => s > kwh) ?? kwh;
}

const kwh = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 1 });

/**
 * Three options sized from the customer's bill; they differ in battery. Solar
 * covers what the home uses, plus charging headroom whenever there's a battery
 * now or planned. The customer doesn't pick panel counts or battery sizes.
 */
export function recommendSystem(profile: EnergyProfile, analysis: HomeAnalysis, bill: BillSummary): Recommendation {
  const usage = usageBasis(bill, profile);
  const panelsForUse = panelsNeeded(usage.annualKwh, analysis, profile.batteryPlanned);
  const panelsWithBattery = panelsNeeded(usage.annualKwh, analysis, true);
  const battery = batteryNeeded(usage, profile.backup);
  const bigBattery = nextBatterySize(battery);
  const evCharger = profile.ev || profile.evPlanned;
  const sizedTo = (charging: boolean) =>
    `Solar sized to your ${kwh(usage.dailyKwh)} kWh a day${profile.evPlanned ? ", including your future EV" : ""}${charging ? ", plus enough to charge a battery" : ""}`;
  const covers = (b: number) =>
    `A ${kwh(b)} kWh battery covers ${b * ASSUMPTIONS.batteryUsableShare >= usage.dailyKwh * usage.eveningShare ? "your" : "most of your"} evening use`;

  return {
    usage,
    tiers: {
      essential: {
        tier: "essential",
        config: { panelCount: panelsForUse, batteryKwh: 0, evCharger: false },
        why: [
          sizedTo(profile.batteryPlanned),
          "Lowest upfront cost",
          profile.batteryPlanned ? "Ready for the battery you're planning" : "Add a battery any time",
        ],
      },
      recommended: {
        tier: "recommended",
        config: { panelCount: panelsWithBattery, batteryKwh: battery, evCharger },
        why: [sizedTo(true), covers(battery), profile.backup ? "Keeps essentials on during outages" : "Maximises your savings"],
      },
      independence: {
        tier: "independence",
        config: { panelCount: panelsWithBattery, batteryKwh: bigBattery, evCharger },
        why: [sizedTo(true), covers(bigBattery), "Longest backup during outages"],
      },
    },
  };
}

export function estimateOutcome(config: SystemConfig, usage: UsageBasis, price: PriceBreakdown): SystemEstimate {
  const solarKw = panelsToKw(config.panelCount);
  const generation = Math.round(solarKw * ASSUMPTIONS.dailyYieldKwhPerKw * 365);

  let selfUse: number = ASSUMPTIONS.baseSelfConsumption;
  if (config.batteryKwh > 0) selfUse += Math.min(0.4, config.batteryKwh / 40);
  if (config.evCharger) selfUse += 0.05;
  selfUse = Math.min(0.9, selfUse);

  const consumedFromSolar = Math.min(usage.annualKwh, generation * selfUse);
  const exported = Math.max(0, generation - consumedFromSolar);
  const annualSavings = Math.round(consumedFromSolar * usage.usageRate + exported * usage.feedInRate);

  return {
    solarKw,
    annualGenerationKwh: generation,
    annualSavings,
    paybackYears: annualSavings > 0 ? Math.round((price.total / annualSavings) * 10) / 10 : 0,
    selfPoweredShare: usage.annualKwh > 0 ? Math.min(1, consumedFromSolar / usage.annualKwh) : 0,
  };
}

export function priceSystem(config: SystemConfig, analysis: Pick<HomeAnalysis, "storeys">, addOns: AddOnId[] = []): PriceBreakdown {
  const { prices, rebates } = ASSUMPTIONS;
  const solarKw = panelsToKw(config.panelCount);
  const lines: PriceBreakdown["lines"] = [
    {
      id: "solar",
      label: `${solarKw} kW solar (${config.panelCount} panels)`,
      amount: Math.round(solarKw * prices.solarPerKw),
      removable: false,
    },
  ];
  if (config.batteryKwh > 0) {
    lines.push({
      id: "battery",
      label: `${config.batteryKwh} kWh battery`,
      amount: Math.round(config.batteryKwh * prices.batteryPerKwh),
      removable: true,
    });
  }
  if (config.evCharger) lines.push({ id: "ev-charger", label: "Smart EV charger", amount: prices.evCharger, removable: true });
  lines.push({ id: "monitoring", label: "Energy monitoring", amount: prices.monitoring, removable: false });
  if (analysis.storeys === "double") {
    lines.push({ id: "double-storey", label: "Double-storey install", amount: prices.doubleStorey, removable: false });
  }
  for (const id of addOns) {
    const addOn = ADD_ONS.find((a) => a.id === id);
    if (addOn) lines.push({ id: addOn.id, label: addOn.name, amount: addOn.price, removable: true });
  }

  const gross = lines.reduce((sum, l) => sum + l.amount, 0);
  const batteryCost = config.batteryKwh * prices.batteryPerKwh;
  const rebateTotal = Math.round(solarKw * rebates.solarPerKw + batteryCost * rebates.batteryShare);

  return {
    lines,
    gross,
    rebates: rebateTotal,
    total: gross - rebateTotal,
    deposit: ASSUMPTIONS.deposit,
  };
}

/** Plain-language one-liner of a system, e.g. "13.2 kW solar + 13.5 kWh battery + EV charger + monitoring". */
export function describeSystem(config: SystemConfig) {
  const parts = [`${panelsToKw(config.panelCount)} kW solar`];
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
  return a.panelCount === b.panelCount && a.batteryKwh === b.batteryKwh && a.evCharger === b.evCharger;
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
export function suggestedAdditions(config: SystemConfig, recommended: SystemConfig, addOns: AddOnId[]): SuggestedAddition[] {
  const out: SuggestedAddition[] = [];
  if (config.batteryKwh === 0) {
    const size = recommended.batteryKwh || ASSUMPTIONS.batterySizes[0];
    out.push({
      id: "battery",
      label: `${size} kWh battery`,
      blurb: "Use your sunshine at night and keep essentials on in outages.",
      amount: Math.round(size * ASSUMPTIONS.prices.batteryPerKwh),
    });
  }
  if (!config.evCharger) {
    out.push({
      id: "ev-charger",
      label: "Smart EV charger",
      blurb: "Charge your car from surplus solar.",
      amount: ASSUMPTIONS.prices.evCharger,
    });
  }
  for (const a of ADD_ONS) {
    if (!addOns.includes(a.id)) out.push({ id: a.id, label: a.name, blurb: a.blurb, amount: a.price });
  }
  return out;
}
