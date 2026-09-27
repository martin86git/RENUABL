/**
 * Server only. Today's rebate rules, read from the Clean Energy Regulator and
 * Solar Victoria (cached for a day). Anything that can't be read reliably
 * falls back to the hand-checked VERIFIED_RATES.
 */
import { pageText, parseBatteryFactors, parseBatteryTaper, parseDeeming, parseSolarVictoria } from "@/lib/domain/rebate-parsing";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";

export const SOURCES = {
  entitlements:
    "https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme/small-scale-technology-certificates/calculate-small-scale-technology-certificate-entitlements",
  batteries:
    "https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme/small-scale-renewable-energy-systems/solar-batteries",
  solarVictoria: "https://www.solar.vic.gov.au/solar-panel-rebate",
} as const;

async function text(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "RENUABL rebate check" },
    });
    return res.ok ? pageText(await res.text()) : null;
  } catch {
    return null;
  }
}

/**
 * The STC price isn't published by the CER (it's a market price; the CER's
 * clearing house is fixed at $40 ex GST). Set STC_PRICE to what the installer
 * credits customers.
 */
function stcPrice() {
  const v = Number(process.env.STC_PRICE);
  return v > 0 && v <= 40 ? v : VERIFIED_RATES.stc.price;
}

export async function getRebateRates(): Promise<{ rates: RebateRates; problems: string[] }> {
  const [entitlements, batteries, sv] = await Promise.all([
    text(SOURCES.entitlements),
    text(SOURCES.batteries),
    text(SOURCES.solarVictoria),
  ]);
  const problems: string[] = [];
  const pick = <T>(label: string, value: T | null, fallback: T): T => {
    if (value === null) problems.push(label);
    return value ?? fallback;
  };

  const deeming = pick("deeming years", entitlements ? parseDeeming(entitlements) : null, VERIFIED_RATES.stc.deemingYears);
  const factors = pick(
    "battery factors",
    (batteries && parseBatteryFactors(batteries)) || (entitlements && parseBatteryFactors(entitlements)) || null,
    VERIFIED_RATES.stc.batteryFactors,
  );
  const taper = pick("battery taper", (batteries && parseBatteryTaper(batteries)) || null, VERIFIED_RATES.stc.batteryTaper);
  const solarVic = pick("Solar Victoria", sv ? parseSolarVictoria(sv) : null, {});

  const rates: RebateRates = {
    asOf: new Date().toISOString().slice(0, 10),
    source: problems.length === 0 ? "live" : "verified",
    stc: { price: stcPrice(), deemingYears: deeming, batteryFactors: factors, batteryTaper: taper },
    solarVictoria: { ...VERIFIED_RATES.solarVictoria, ...solarVic },
  };
  if (problems.length) console.warn("rebate rates: using verified figures for", problems.join(", "));
  return { rates, problems };
}
