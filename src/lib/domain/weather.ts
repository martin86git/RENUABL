/**
 * Install-day weather from Google's Weather API (daily forecast, up to 10
 * days ahead). Roof work is unsafe in rain, storms and strong wind, so each
 * install day gets a plain call: good, keep an eye on it, or risky. Pure and tested.
 */
import type { ISODate } from "./types";

export const FORECAST_DAYS = 10;

export interface DayForecast {
  date: ISODate;
  summary: string;
  rainChance: number | null;
  rainMm: number | null;
  thunderChance: number | null;
  maxC: number | null;
  minC: number | null;
  windKmh: number | null;
  gustKmh: number | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pad = (n: number) => String(n).padStart(2, "0");

/** Reads a forecast/days:lookup response (metric units). */
export function parseDailyForecast(raw: unknown): DayForecast[] {
  const days = (raw as { forecastDays?: unknown[] } | null)?.forecastDays;
  if (!Array.isArray(days)) return [];
  return days.flatMap((d) => {
    const day = (d ?? {}) as Record<string, unknown>;
    const dd = (day.displayDate ?? {}) as Record<string, unknown>;
    const y = num(dd.year);
    const m = num(dd.month);
    const dn = num(dd.day);
    if (!y || !m || !dn) return [];
    const f = (day.daytimeForecast ?? {}) as Record<string, unknown>;
    const cond = (f.weatherCondition ?? {}) as { description?: { text?: unknown } };
    const precip = (f.precipitation ?? {}) as { probability?: { percent?: unknown }; qpf?: { quantity?: unknown } };
    const wind = (f.wind ?? {}) as { speed?: { value?: unknown }; gust?: { value?: unknown } };
    return [
      {
        date: `${y}-${pad(m)}-${pad(dn)}`,
        summary: typeof cond.description?.text === "string" ? cond.description.text.slice(0, 60) : "",
        rainChance: num(precip.probability?.percent),
        rainMm: num(precip.qpf?.quantity),
        thunderChance: num(f.thunderstormProbability),
        maxC: num((day.maxTemperature as { degrees?: unknown } | undefined)?.degrees),
        minC: num((day.minTemperature as { degrees?: unknown } | undefined)?.degrees),
        windKmh: num(wind.speed?.value),
        gustKmh: num(wind.gust?.value),
      },
    ];
  });
}

export type Outlook = "good" | "watch" | "risky";

/** Roof work: rain, storms and gusts rule a day out; showers, breeze or heat mean keep an eye on it. */
export function installOutlook(f: DayForecast): { outlook: Outlook; reasons: string[] } {
  const risky: string[] = [];
  const watch: string[] = [];
  if ((f.rainChance ?? 0) >= 60 || (f.rainMm ?? 0) >= 5) risky.push("rain likely");
  else if ((f.rainChance ?? 0) >= 30) watch.push("chance of showers");
  if ((f.thunderChance ?? 0) >= 30) risky.push("storms possible");
  if ((f.gustKmh ?? 0) >= 50) risky.push(`gusts to ${Math.round(f.gustKmh!)} km/h`);
  else if ((f.gustKmh ?? 0) >= 35) watch.push(`gusty (${Math.round(f.gustKmh!)} km/h)`);
  if ((f.maxC ?? 0) >= 38) watch.push(`hot (${Math.round(f.maxC!)}°)`);
  if (risky.length) return { outlook: "risky", reasons: [...risky, ...watch] };
  if (watch.length) return { outlook: "watch", reasons: watch };
  return { outlook: "good", reasons: [] };
}

export function forecastFor(days: DayForecast[], date: ISODate) {
  return days.find((d) => d.date === date) ?? null;
}

/** For customers: calm, no jargon. */
export function customerOutlookLine(f: DayForecast) {
  const { outlook } = installOutlook(f);
  const temp = f.maxC !== null ? `, ${Math.round(f.maxC)}°` : "";
  if (outlook === "good") return `${f.summary || "Looking good"}${temp}. Looks good for your installation.`;
  if (outlook === "watch") return `${f.summary || "Mixed weather"}${temp}. Your installation partner is keeping an eye on it.`;
  return `${f.summary || "Wet or windy weather"}${temp}. If it isn't safe to work on your roof, your installation partner will call to move the day.`;
}
