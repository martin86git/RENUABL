/**
 * Sunshine for a home's location, from NASA POWER (long-term averages of
 * solar energy reaching the ground). Turned into expected panel output with a
 * tilt gain for a typical pitched roof and a performance ratio for real-world
 * losses (heat, wiring, inverter, dust).
 */

export interface Sunshine {
  /** Average daily solar energy on flat ground, kWh/m²/day. */
  annual: number;
  /** Jan–Dec averages, kWh/m²/day. */
  monthly: number[];
  lat: number;
  lng: number;
  source: "NASA POWER";
}

/**
 * PLACEHOLDERS to confirm: a north-ish roof (or tilt frame) at ~10–25° in
 * Victoria gains ~8% over flat ground; panels laid flat on a flat roof get
 * none. Plus typical system losses.
 */
export const YIELD_MODEL = { tiltGain: 1.08, flatGain: 1, performanceRatio: 0.8 } as const;

/** Expected daily output per kW of panels at this location (laidFlat: panels flat on a flat roof). */
export function yieldPerKw(sun: Pick<Sunshine, "annual">, laidFlat = false): number {
  const gain = laidFlat ? YIELD_MODEL.flatGain : YIELD_MODEL.tiltGain;
  return Math.round(sun.annual * gain * YIELD_MODEL.performanceRatio * 100) / 100;
}

/** Parses NASA POWER's climatology response; null if it isn't usable. */
export function parseNasaClimatology(json: unknown, lat: number, lng: number): Sunshine | null {
  const p = (json as { properties?: { parameter?: { ALLSKY_SFC_SW_DWN?: Record<string, number> } } })?.properties?.parameter
    ?.ALLSKY_SFC_SW_DWN;
  if (!p) return null;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((m) => p[m]);
  const ok = (v: unknown): v is number => typeof v === "number" && v > 0 && v < 15; // NASA uses -999 for missing
  if (!ok(p.ANN) || !months.every(ok)) return null;
  return { annual: p.ANN, monthly: months, lat, lng, source: "NASA POWER" };
}

/**
 * Google's Solar API measures sunshine on the home's own roof faces (so it
 * includes shading from trees and buildings, and which way the roof faces);
 * NASA gives the area's long-term sunshine. When both are known the estimate
 * leans on the roof (60%) and steadies it with NASA (40%), and the roof figure
 * is kept within a sensible range of NASA's so one odd reading can't swing the
 * price. Returns kWh a day per kW of panels.
 */
export const ROOF_BLEND = { roofWeight: 0.6, minRatio: 0.6, maxRatio: 1.25 } as const;

export function blendedYieldPerKw(
  sun: Pick<Sunshine, "annual"> | null | undefined,
  roofSunHoursPerYear: number | null | undefined,
  laidFlat = false,
): number | null {
  const nasa = sun ? yieldPerKw(sun, laidFlat) : null;
  const roof = roofSunHoursPerYear && roofSunHoursPerYear > 0 ? (roofSunHoursPerYear / 365) * YIELD_MODEL.performanceRatio : null;
  if (nasa === null && roof === null) return null;
  if (roof === null) return nasa;
  if (nasa === null) return Math.round(roof * 100) / 100;
  const bounded = Math.min(Math.max(roof, nasa * ROOF_BLEND.minRatio), nasa * ROOF_BLEND.maxRatio);
  return Math.round((bounded * ROOF_BLEND.roofWeight + nasa * (1 - ROOF_BLEND.roofWeight)) * 100) / 100;
}
