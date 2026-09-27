import type { BillBand, EnergyProfile, PriceBreakdown, Recommendation, SystemConfig, SystemEstimate } from "./types";

/** Assumptions used by the first-pass sizing model. Tune with real data later. */
export const ASSUMPTIONS = {
  panelWatts: 440,
  minPanels: 12,
  maxPanels: 36,
  tariffPerKwh: 0.32,
  feedInPerKwh: 0.05,
  quarterlySupplyCharge: 95,
  dailyYieldKwhPerKw: 4.0,
  evAnnualKwh: 2500,
  batterySizes: [0, 10, 13.5, 20] as const,
  prices: {
    solarPerKw: 1050,
    batteryPerKwh: 850,
    evCharger: 1650,
    doubleStorey: 650,
  },
  rebates: {
    solarPerKw: 370,
    batteryShare: 0.3,
  },
  deposit: 199,
} as const;

const BILL_MIDPOINT: Record<BillBand, number> = {
  "under-400": 320,
  "400-700": 550,
  "700-1000": 850,
  "over-1000": 1200,
};

const SELF_CONSUMPTION: Record<EnergyProfile["daytime"], number> = {
  "mostly-home": 0.55,
  sometimes: 0.4,
  "mostly-away": 0.28,
};

export function estimateAnnualUsage(profile: EnergyProfile): number {
  const quarterlyUsage = (BILL_MIDPOINT[profile.bill] - ASSUMPTIONS.quarterlySupplyCharge) / ASSUMPTIONS.tariffPerKwh;
  const ev = profile.ev === "none" ? 0 : ASSUMPTIONS.evAnnualKwh;
  return Math.round(quarterlyUsage * 4 + ev);
}

export function panelsToKw(panelCount: number): number {
  return Math.round(((panelCount * ASSUMPTIONS.panelWatts) / 1000) * 100) / 100;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function recommendSystem(profile: EnergyProfile): Recommendation {
  const usage = estimateAnnualUsage(profile);
  const reasons: string[] = [];

  // Size solar to cover ~110% of annual usage, within practical roof limits.
  const targetKw = (usage * 1.1) / (ASSUMPTIONS.dailyYieldKwhPerKw * 365);
  const panelCount = clamp(Math.ceil((targetKw * 1000) / ASSUMPTIONS.panelWatts), ASSUMPTIONS.minPanels, ASSUMPTIONS.maxPanels);
  reasons.push(
    `${panelsToKw(panelCount)} kW of solar covers roughly all of the ${usage.toLocaleString("en-AU")} kWh your home uses each year.`,
  );

  // Battery when most generation would otherwise be exported, or backup matters.
  let batteryKwh = 0;
  const awayByDay = profile.daytime !== "mostly-home";
  if (profile.backup === "important" || (awayByDay && usage > 5000) || profile.ev === "have") {
    batteryKwh = usage > 9000 || profile.household === "5+" ? 13.5 : 10;
    if (profile.backup === "important") {
      reasons.push("A battery keeps essentials running during outages, which you told us matters.");
    } else {
      reasons.push("A battery stores daytime sunshine for the evening, when your home uses the most.");
    }
  }

  const evCharger = profile.ev !== "none";
  if (evCharger) {
    reasons.push("A smart charger fills your car from surplus solar first.");
  }

  return {
    recommended: { panelCount, batteryKwh, evCharger },
    reasons,
    estimatedAnnualUsageKwh: usage,
  };
}

export function estimateOutcome(config: SystemConfig, profile: EnergyProfile, price: PriceBreakdown): SystemEstimate {
  const usage = estimateAnnualUsage(profile);
  const solarKw = panelsToKw(config.panelCount);
  const generation = Math.round(solarKw * ASSUMPTIONS.dailyYieldKwhPerKw * 365);

  let selfUse = SELF_CONSUMPTION[profile.daytime];
  if (config.batteryKwh > 0) selfUse += Math.min(0.35, config.batteryKwh / 40);
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

export function priceSystem(config: SystemConfig, profile: Pick<EnergyProfile, "storeys">): PriceBreakdown {
  const { prices, rebates } = ASSUMPTIONS;
  const solarKw = panelsToKw(config.panelCount);
  const lines: PriceBreakdown["lines"] = [
    { label: `${solarKw} kW solar (${config.panelCount} panels)`, amount: Math.round(solarKw * prices.solarPerKw) },
  ];
  if (config.batteryKwh > 0) {
    lines.push({ label: `${config.batteryKwh} kWh battery`, amount: Math.round(config.batteryKwh * prices.batteryPerKwh) });
  }
  if (config.evCharger) lines.push({ label: "Smart EV charger", amount: prices.evCharger });
  if (profile.storeys === "double") lines.push({ label: "Double-storey install", amount: prices.doubleStorey });

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

export function isSameConfig(a: SystemConfig, b: SystemConfig) {
  return a.panelCount === b.panelCount && a.batteryKwh === b.batteryKwh && a.evCharger === b.evCharger;
}
