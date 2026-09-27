/**
 * Rebates, each shown to the customer as its own line:
 * - Federal STCs for solar (Small-scale Renewable Energy Scheme)
 * - Federal STCs for batteries (Cheaper Home Batteries Program)
 * - Solar Victoria's solar panel rebate and interest-free loan (Victorian homes only)
 *
 * The rules come from the Clean Energy Regulator and Solar Victoria. The server
 * reloads them daily (src/lib/server/rebate-rates.ts); VERIFIED_RATES is the
 * copy checked by hand on the date in `asOf`, used when a live read fails.
 */
import { BATTERY } from "./catalogue";
import { arrayKw, batteryModules } from "./costing";
import { zoneRating } from "./zone-ratings";

export interface BatteryFactorPeriod {
  /** Inclusive ISO dates. */
  from: string;
  to: string;
  factor: number;
}

export interface RebateRates {
  asOf: string;
  /** "live" = read from the CER and Solar Victoria today; "verified" = the hand-checked copy. */
  source: "live" | "verified";
  stc: {
    /** $ per certificate RENUABL's installer credits (a market price, not published by the CER). */
    price: number;
    /** Deeming years by installation year. */
    deemingYears: Record<string, number>;
    /** STCs per usable kWh by installation date. */
    batteryFactors: BatteryFactorPeriod[];
    /** The battery factor tapers: each band's share of the factor, up to its kWh. */
    batteryTaper: { upToKwh: number; share: number }[];
  };
  solarVictoria: {
    /** Maximum solar panel rebate ($0 = not currently offered). */
    pvRebateMax: number;
    /** The rebate is at most this share of the solar cost after STCs. */
    pvRebateShare: number;
    /** Interest-free loan, up to the rebate amount. */
    pvLoanMax: number;
    loanMonths: number;
    batteryRebate: number;
    eligibilityUrl: string;
  };
}

/** Checked by hand against cer.gov.au and solar.vic.gov.au on 27 September 2026. */
export const VERIFIED_RATES: RebateRates = {
  asOf: "2026-09-27",
  source: "verified",
  stc: {
    price: 38,
    deemingYears: { "2025": 6, "2026": 5, "2027": 4, "2028": 3, "2029": 2, "2030": 1 },
    batteryFactors: [
      { from: "2026-01-01", to: "2026-04-30", factor: 8.4 },
      { from: "2026-05-01", to: "2026-12-31", factor: 6.8 },
      { from: "2027-01-01", to: "2027-06-30", factor: 5.7 },
      { from: "2027-07-01", to: "2027-12-31", factor: 5.2 },
      { from: "2028-01-01", to: "2028-06-30", factor: 4.6 },
      { from: "2028-07-01", to: "2028-12-31", factor: 4.1 },
      { from: "2029-01-01", to: "2029-06-30", factor: 3.6 },
      { from: "2029-07-01", to: "2029-12-31", factor: 3.1 },
      { from: "2030-01-01", to: "2030-06-30", factor: 2.6 },
      { from: "2030-07-01", to: "2030-12-31", factor: 2.1 },
    ],
    batteryTaper: [
      { upToKwh: 14, share: 1 },
      { upToKwh: 28, share: 0.6 },
      { upToKwh: 50, share: 0.15 },
    ],
  },
  solarVictoria: {
    pvRebateMax: 1400,
    pvRebateShare: 0.5,
    pvLoanMax: 1400,
    loanMonths: 48,
    batteryRebate: 0,
    eligibilityUrl: "https://www.solar.vic.gov.au/solar-panel-rebate",
  },
};

/** Kept for existing imports: the rates the app uses when nothing live has loaded. */
export const REBATE_RATES = VERIFIED_RATES;

export type RebateId = "stc-solar" | "stc-battery" | "sv-solar" | "sv-battery";

export interface RebateLine {
  id: RebateId;
  label: string;
  detail: string;
  amount: number;
}

export interface Incentives {
  /** The home's state and postcode; Solar Victoria only applies in VIC, STC zones come from the postcode. */
  state: string | null;
  postcode?: string | null;
  /** Install date (ISO); sets the deeming years and battery factor. Defaults to today. */
  installDate?: string | null;
  /** The customer says they're eligible for, and wants, the Solar Victoria rebate. */
  solarVicRebate: boolean;
  /** The customer wants the Solar Victoria interest-free loan too. */
  solarVicLoan: boolean;
}

export const NO_INCENTIVES: Incentives = { state: null, solarVicRebate: false, solarVicLoan: false };

/** Melbourne's zone, used when a postcode isn't known. */
const DEFAULT_ZONE = { zone: 4, rating: 1.185 };

export function solarVictoriaApplies(state: string | null) {
  return state === "VIC";
}

export function deemingYears(date: string, rates: RebateRates = VERIFIED_RATES) {
  return rates.stc.deemingYears[date.slice(0, 4)] ?? 0;
}

export function batteryFactor(date: string, rates: RebateRates = VERIFIED_RATES) {
  return rates.stc.batteryFactors.find((p) => date >= p.from && date <= p.to)?.factor ?? 0;
}

/** kWh that attract STCs after the taper (e.g. 24 kWh → 14 + 10 × 0.6 = 20). */
export function taperedKwh(usableKwh: number, rates: RebateRates = VERIFIED_RATES) {
  let counted = 0;
  let floor = 0;
  for (const band of rates.stc.batteryTaper) {
    const inBand = Math.max(0, Math.min(usableKwh, band.upToKwh) - floor);
    counted += inBand * band.share;
    floor = band.upToKwh;
  }
  return counted;
}

export function solarStcs(panelCount: number, postcode: string | null | undefined, date: string, rates: RebateRates = VERIFIED_RATES) {
  const zone = (postcode && zoneRating(postcode)) || DEFAULT_ZONE;
  return Math.floor(arrayKw(panelCount) * zone.rating * deemingYears(date, rates));
}

export function batteryStcs(batteryKwh: number, date: string, rates: RebateRates = VERIFIED_RATES) {
  const usable = batteryModules(batteryKwh) * BATTERY.module.kwh;
  return Math.floor(taperedKwh(usable, rates) * batteryFactor(date, rates));
}

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Each rebate as its own line, plus any Solar Victoria loan (which lowers the
 * upfront cost, not the price). `solarPrice` is the customer's solar line, for
 * Solar Victoria's 50% cap.
 */
export function rebatesFor(
  config: { panelCount: number; batteryKwh: number; existingSolar?: boolean },
  incentives: Incentives = NO_INCENTIVES,
  rates: RebateRates = VERIFIED_RATES,
  solarPrice = Infinity,
): { lines: RebateLine[]; total: number; loan: number } {
  const lines: RebateLine[] = [];
  const date = incentives.installDate || today();

  const pv = solarStcs(config.panelCount, incentives.postcode, date, rates);
  const pvAmount = Math.round(pv * rates.stc.price);
  if (pv > 0) {
    lines.push({
      id: "stc-solar",
      label: "Federal solar rebate (STCs)",
      detail: `${pv} certificates × ${money(rates.stc.price)}`,
      amount: pvAmount,
    });
  }
  const bat = batteryStcs(config.batteryKwh, date, rates);
  if (bat > 0) {
    lines.push({
      id: "stc-battery",
      label: "Federal battery rebate (Cheaper Home Batteries)",
      detail: `${bat} certificates × ${money(rates.stc.price)}`,
      amount: Math.round(bat * rates.stc.price),
    });
  }

  let loan = 0;
  if (solarVictoriaApplies(incentives.state) && incentives.solarVicRebate) {
    const sv = rates.solarVictoria;
    // The panel rebate is for new solar systems, not extra panels on an existing one.
    if (config.panelCount > 0 && !config.existingSolar && sv.pvRebateMax > 0) {
      const amount = Math.round(Math.min(sv.pvRebateMax, Math.max(0, (solarPrice - pvAmount) * sv.pvRebateShare)));
      if (amount > 0) {
        lines.push({ id: "sv-solar", label: "Solar Victoria solar panel rebate", detail: "If eligible", amount });
        if (incentives.solarVicLoan) loan += Math.min(sv.pvLoanMax, amount);
      }
    }
    if (config.batteryKwh > 0 && sv.batteryRebate > 0) {
      lines.push({ id: "sv-battery", label: "Solar Victoria battery rebate", detail: "If eligible", amount: sv.batteryRebate });
    }
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), loan };
}
