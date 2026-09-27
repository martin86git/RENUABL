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

/** PLACEHOLDERS to confirm: a north-ish roof at ~20–25° in Victoria, and typical system losses. */
export const YIELD_MODEL = { tiltGain: 1.08, performanceRatio: 0.8 } as const;

/** Expected daily output per kW of panels at this location. */
export function yieldPerKw(sun: Pick<Sunshine, "annual">): number {
  return Math.round(sun.annual * YIELD_MODEL.tiltGain * YIELD_MODEL.performanceRatio * 100) / 100;
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
