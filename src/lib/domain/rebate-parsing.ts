/**
 * Pulls rebate rules out of the text of the CER and Solar Victoria pages.
 * Each parser returns null when the page doesn't look as expected, so the
 * caller keeps the verified figures instead of trusting a bad read.
 */
import type { BatteryFactorPeriod, RebateRates } from "./rebates";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Page HTML → plain text. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/[​⁠]/g, "")
    .replace(/\s+/g, " ");
}

/** "Installation year Deeming period in years 2021 10 2022 9 …" */
export function parseDeeming(text: string): Record<string, number> | null {
  const block = text.match(/Deeming period in years((?:\s+20\d\d\s+\d{1,2})+)/i)?.[1];
  if (!block) return null;
  const out: Record<string, number> = {};
  for (const [, year, years] of block.matchAll(/(20\d\d)\s+(\d{1,2})/g)) out[year] = Number(years);
  const ok = Object.keys(out).length >= 5 && Object.values(out).every((v) => v >= 1 && v <= 15);
  return ok ? out : null;
}

function lastDay(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

/** "2026 May – December 6.8 2027 January – June 5.7 …" */
export function parseBatteryFactors(text: string): BatteryFactorPeriod[] | null {
  const out: BatteryFactorPeriod[] = [];
  const re =
    /(20\d\d)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*[–-]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}(?:\.\d+)?)/gi;
  for (const [, y, fromM, toM, factor] of text.matchAll(re)) {
    const year = Number(y);
    const from = MONTHS.indexOf(fromM.toLowerCase());
    const to = MONTHS.indexOf(toM.toLowerCase());
    const f = Number(factor);
    if (to < from || f <= 0 || f > 20) return null;
    const period = { from: `${y}-${String(from + 1).padStart(2, "0")}-01`, to: lastDay(year, to), factor: f };
    if (!out.some((p) => p.from === period.from)) out.push(period);
  }
  return out.length >= 3 ? out.sort((a, b) => a.from.localeCompare(b.from)) : null;
}

/** "From 0 kWh up to 14 kWh (inclusive): STC factor applied at 100%. Every kWh greater than 14 and up to 28 kWh …" */
export function parseBatteryTaper(text: string): RebateRates["stc"]["batteryTaper"] | null {
  const out: RebateRates["stc"]["batteryTaper"] = [];
  for (const [, kwh, pct] of text.matchAll(/up to (\d{1,3}) kWh \(inclusive\): STC factor applied at (\d{1,3})%/gi)) {
    out.push({ upToKwh: Number(kwh), share: Number(pct) / 100 });
  }
  const ok = out.length >= 2 && out.every((b, i) => b.share > 0 && b.share <= 1 && (i === 0 || b.upToKwh > out[i - 1].upToKwh));
  return ok ? out : null;
}

/** Solar Victoria solar panel (PV) rebate page. */
export function parseSolarVictoria(text: string): Partial<RebateRates["solarVictoria"]> | null {
  const rebate = text.match(/rebate of up to \$([\d,]+) towards the cost of installing solar panel/i)?.[1];
  const loan = text.match(/interest-free loan of up to \$([\d,]+)/i)?.[1];
  const share = text.match(/discount of up to (\d{1,3}) per ?cent of the purchase cost/i)?.[1];
  const money = (s?: string) => (s ? Number(s.replace(/,/g, "")) : NaN);
  const pvRebateMax = money(rebate);
  if (!(pvRebateMax > 0 && pvRebateMax < 10_000)) return null;
  const out: Partial<RebateRates["solarVictoria"]> = { pvRebateMax };
  const pvLoanMax = money(loan);
  if (pvLoanMax > 0 && pvLoanMax < 10_000) out.pvLoanMax = pvLoanMax;
  if (share && Number(share) > 0 && Number(share) <= 100) out.pvRebateShare = Number(share) / 100;
  return out;
}
