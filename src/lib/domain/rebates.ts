/**
 * Rebates, each shown to the customer as its own line:
 * - Federal STCs for solar (Small-scale Renewable Energy Scheme)
 * - Federal STCs for batteries (Cheaper Home Batteries Program)
 * - Solar Victoria's solar panel rebate and interest-free loan (Victorian homes only)
 *
 * RATES are the inputs. They are placeholders until they're loaded live from the
 * Clean Energy Regulator and Solar Victoria (see docs/DEPLOY.md); `verified`
 * says which.
 */
import { BATTERY } from "./catalogue";
import { arrayKw, batteryModules } from "./costing";

export interface RebateRates {
  asOf: string;
  verified: boolean;
  stc: {
    /** $ per certificate. */
    price: number;
    /** MWh per kW for the home's postcode zone (Melbourne: zone 4). */
    zoneRating: number;
    /** Years of generation credited for an install this year (falls each year to 2030). */
    deemingYears: number;
    /** Certificates per usable kWh of battery. */
    batteryStcsPerKwh: number;
    source: string;
  };
  solarVictoria: {
    /** Solar panel rebate for an eligible home ($0 = not currently offered). */
    pvRebate: number;
    /** Interest-free loan available alongside the panel rebate. */
    pvLoan: number;
    batteryRebate: number;
    eligibilityUrl: string;
  };
}

/** PLACEHOLDER values: confirm (or load live) before launch. */
export const REBATE_RATES: RebateRates = {
  asOf: "2026-09",
  verified: false,
  stc: { price: 38, zoneRating: 1.185, deemingYears: 5, batteryStcsPerKwh: 8.4, source: "https://cer.gov.au" },
  solarVictoria: { pvRebate: 1400, pvLoan: 1400, batteryRebate: 0, eligibilityUrl: "https://www.solar.vic.gov.au" },
};

export type RebateId = "stc-solar" | "stc-battery" | "sv-solar" | "sv-battery";

export interface RebateLine {
  id: RebateId;
  label: string;
  detail: string;
  amount: number;
}

export interface Incentives {
  /** The home's state; Solar Victoria only applies in VIC. */
  state: string | null;
  /** The customer says they're eligible for, and wants, the Solar Victoria rebate. */
  solarVicRebate: boolean;
  /** The customer wants the Solar Victoria interest-free loan too. */
  solarVicLoan: boolean;
}

export const NO_INCENTIVES: Incentives = { state: null, solarVicRebate: false, solarVicLoan: false };

export function solarVictoriaApplies(state: string | null) {
  return state === "VIC";
}

export function solarStcs(panelCount: number, rates: RebateRates = REBATE_RATES) {
  return Math.floor(arrayKw(panelCount) * rates.stc.zoneRating * rates.stc.deemingYears);
}

export function batteryStcs(batteryKwh: number, rates: RebateRates = REBATE_RATES) {
  return Math.floor(batteryModules(batteryKwh) * BATTERY.module.kwh * rates.stc.batteryStcsPerKwh);
}

/** Each rebate as its own line, plus any Solar Victoria loan (which lowers the upfront cost, not the price). */
export function rebatesFor(
  config: { panelCount: number; batteryKwh: number; existingSolar?: boolean },
  incentives: Incentives = NO_INCENTIVES,
  rates: RebateRates = REBATE_RATES,
): { lines: RebateLine[]; total: number; loan: number } {
  const lines: RebateLine[] = [];
  const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pv = solarStcs(config.panelCount, rates);
  if (pv > 0) {
    lines.push({
      id: "stc-solar",
      label: "Federal solar rebate (STCs)",
      detail: `${pv} certificates × ${money(rates.stc.price)}`,
      amount: Math.round(pv * rates.stc.price),
    });
  }
  const bat = batteryStcs(config.batteryKwh, rates);
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
    if (config.panelCount > 0 && !config.existingSolar && sv.pvRebate > 0) {
      lines.push({ id: "sv-solar", label: "Solar Victoria solar panel rebate", detail: "If eligible", amount: sv.pvRebate });
      if (incentives.solarVicLoan) loan += sv.pvLoan;
    }
    if (config.batteryKwh > 0 && sv.batteryRebate > 0) {
      lines.push({ id: "sv-battery", label: "Solar Victoria battery rebate", detail: "If eligible", amount: sv.batteryRebate });
    }
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), loan };
}
