import type {
  AddOn,
  AddOnId,
  EnergyProfile,
  HomeAnalysis,
  PriceBreakdown,
  Recommendation,
  SystemConfig,
  SystemEstimate,
  SystemTier,
} from "./types";

/**
 * Assumptions used by the first-pass sizing and pricing model.
 * PLACEHOLDERS: validate every figure with installer partners before launch.
 */
export const ASSUMPTIONS = {
  panelWatts: 440,
  minPanels: 12,
  maxPanels: 36,
  tariffPerKwh: 0.3,
  feedInPerKwh: 0.04,
  dailyYieldKwhPerKw: 3.8, // Melbourne average
  baseAnnualKwh: 5200,
  poolAnnualKwh: 2200,
  electricHeatingAnnualKwh: 2600,
  evAnnualKwh: 2500,
  baseSelfConsumption: 0.4,
  batterySizes: [10, 13.5, 20] as const,
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
  deposit: 500,
} as const;

/** Optional products offered after the system recommendation. Prices are placeholders. */
export const ADD_ONS: AddOn[] = [
  { id: "heat-pump", name: "Heat Pump Hot Water", blurb: "Efficient, all-electric hot water.", price: 3900 },
  { id: "smart-switchboard", name: "Smart Switchboard", blurb: "Prepare for a smarter, safer home.", price: 1450 },
  { id: "home-backup", name: "Home Backup", blurb: "Keep essentials running during outages.", price: 1850 },
  { id: "smart-home", name: "Smart Home Integration", blurb: "Connect and optimise your whole home.", price: 690 },
];

export const TIER_LABELS: Record<SystemTier, string> = {
  recommended: "Recommended",
  independence: "Higher independence",
  essential: "Essential",
};

export function estimateAnnualUsage(profile: EnergyProfile): number {
  const a = ASSUMPTIONS;
  return (
    a.baseAnnualKwh +
    (profile.pool ? a.poolAnnualKwh : 0) +
    (profile.electricHeating ? a.electricHeatingAnnualKwh : 0) +
    (profile.ev ? a.evAnnualKwh : 0)
  );
}

export function panelsToKw(panelCount: number): number {
  return Math.round(((panelCount * ASSUMPTIONS.panelWatts) / 1000) * 10) / 10;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function panelsFor(usageKwh: number, coverage: number, analysis: HomeAnalysis) {
  const kw = (usageKwh * coverage) / (ASSUMPTIONS.dailyYieldKwhPerKw * 365);
  return clamp(Math.ceil((kw * 1000) / ASSUMPTIONS.panelWatts), ASSUMPTIONS.minPanels, Math.min(ASSUMPTIONS.maxPanels, analysis.maxPanels));
}

/** Three coherent options; "recommended" is the default the customer sees first. */
export function recommendSystem(profile: EnergyProfile, analysis: HomeAnalysis): Recommendation {
  const usage = estimateAnnualUsage(profile);
  const heavyEvening = profile.ev || profile.pool || profile.electricHeating;

  return {
    estimatedAnnualUsageKwh: usage,
    tiers: {
      recommended: {
        tier: "recommended",
        config: {
          panelCount: panelsFor(usage, 1.1, analysis),
          batteryKwh: profile.backup || heavyEvening ? 13.5 : 10,
          evCharger: profile.ev,
        },
        why: ["Matches your energy usage", "Maximises your savings", "Prepares you for the future"],
      },
      independence: {
        tier: "independence",
        config: {
          panelCount: panelsFor(usage, 1.4, analysis),
          batteryKwh: 20,
          evCharger: profile.ev,
        },
        why: ["Runs your home on your own power most of the year", "Longest backup during outages", "Ready for more electric appliances"],
      },
      essential: {
        tier: "essential",
        config: {
          panelCount: panelsFor(usage, 0.8, analysis),
          batteryKwh: 0,
          evCharger: false,
        },
        why: ["Lowest upfront cost", "Cuts daytime power bills", "Add a battery or charger any time"],
      },
    },
  };
}

export function estimateOutcome(config: SystemConfig, profile: EnergyProfile, price: PriceBreakdown): SystemEstimate {
  const usage = estimateAnnualUsage(profile);
  const solarKw = panelsToKw(config.panelCount);
  const generation = Math.round(solarKw * ASSUMPTIONS.dailyYieldKwhPerKw * 365);

  let selfUse: number = ASSUMPTIONS.baseSelfConsumption;
  if (config.batteryKwh > 0) selfUse += Math.min(0.4, config.batteryKwh / 40);
  if (config.evCharger) selfUse += 0.05;
  selfUse = Math.min(0.9, selfUse);

  const consumedFromSolar = Math.min(usage, generation * selfUse);
  const exported = Math.max(0, generation - consumedFromSolar);
  const annualSavings = Math.round(consumedFromSolar * ASSUMPTIONS.tariffPerKwh + exported * ASSUMPTIONS.feedInPerKwh);

  return {
    solarKw,
    annualGenerationKwh: generation,
    annualSavings,
    paybackYears: annualSavings > 0 ? Math.round((price.total / annualSavings) * 10) / 10 : 0,
    selfPoweredShare: usage > 0 ? Math.min(1, consumedFromSolar / usage) : 0,
  };
}

export function priceSystem(config: SystemConfig, analysis: Pick<HomeAnalysis, "storeys">, addOns: AddOnId[] = []): PriceBreakdown {
  const { prices, rebates } = ASSUMPTIONS;
  const solarKw = panelsToKw(config.panelCount);
  const lines: PriceBreakdown["lines"] = [
    { label: `${solarKw} kW solar (${config.panelCount} panels)`, amount: Math.round(solarKw * prices.solarPerKw) },
  ];
  if (config.batteryKwh > 0) {
    lines.push({ label: `${config.batteryKwh} kWh battery`, amount: Math.round(config.batteryKwh * prices.batteryPerKwh) });
  }
  if (config.evCharger) lines.push({ label: "Smart EV charger", amount: prices.evCharger });
  lines.push({ label: "Energy monitoring", amount: prices.monitoring });
  if (analysis.storeys === "double") lines.push({ label: "Double-storey install", amount: prices.doubleStorey });
  for (const id of addOns) {
    const addOn = ADD_ONS.find((a) => a.id === id);
    if (addOn) lines.push({ label: addOn.name, amount: addOn.price });
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
