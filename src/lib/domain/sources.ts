/**
 * "How we worked this out": the data behind a customer's recommendation and
 * price, naming only sources actually used for their home. Wording is
 * deliberately "based on" and "estimate", never "exact": figures are
 * confirmed on the 15-minute call.
 */
import type { BillSummary } from "./bill";
import { solarVictoriaApplies, type RebateRates } from "./rebates";
import type { Sunshine } from "./sunshine";
import type { Address } from "./types";

export interface DataSource {
  id: "bill" | "google" | "nasa" | "sunshine-typical" | "cer" | "solar-vic" | "supplier";
  name: string;
  detail: string;
  url?: string;
}

export const SOURCES_FOOTNOTE =
  "These are estimates based on the sources above. We confirm your system and price with you on your 15-minute call.";

function asOfLabel(rates: RebateRates, today: string) {
  if (rates.source === "live" && rates.asOf === today) return "checked today";
  const [y, m, d] = rates.asOf.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `checked ${date}`;
}

export function dataSources(input: {
  bill: BillSummary | null;
  address: Address | null;
  sunshine: Sunshine | null;
  rates: RebateRates;
  /** A new solar system (not an expansion) with panels: Solar Victoria's rebate can apply. */
  newSolar: boolean;
  /** ISO date in the launch market. */
  today: string;
}): DataSource[] {
  const out: DataSource[] = [];
  const { bill, address, sunshine, rates } = input;

  if (bill && !bill.sample) {
    out.push({ id: "bill", name: "Your electricity bill", detail: "How much power your home uses, when, and what you pay for it." });
  }
  if (address?.placeId && address.lat !== undefined && address.lng !== undefined) {
    out.push({
      id: "google",
      name: "Google Maps",
      detail: "Pinpoints your home, so the sunshine and rebate figures are for where you live.",
    });
  }
  out.push(
    sunshine
      ? {
          id: "nasa",
          name: "NASA POWER",
          detail: "Decades of satellite sunshine records for your home's location, used to estimate what your panels will make.",
          url: "https://power.larc.nasa.gov",
        }
      : {
          id: "sunshine-typical",
          name: "Typical local sunshine",
          detail: "Long-term averages for your area, used to estimate what your panels will make.",
        },
  );
  out.push({
    id: "cer",
    name: "Clean Energy Regulator",
    detail: `Federal solar and battery rebates for your postcode and install date (${asOfLabel(rates, input.today)}).`,
    url: "https://cer.gov.au",
  });
  if (solarVictoriaApplies(address?.state ?? null) && input.newSolar && rates.solarVictoria.pvRebateMax > 0) {
    out.push({
      id: "solar-vic",
      name: "Solar Victoria",
      detail: "The Victorian solar panel rebate and interest-free loan, if you're eligible.",
      url: rates.solarVictoria.eligibilityUrl,
    });
  }
  out.push({
    id: "supplier",
    name: "Current supplier prices",
    detail: "Your price is built from today's costs for the panels, inverter, battery and parts your home needs, plus installation.",
  });
  return out;
}
