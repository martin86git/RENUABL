/**
 * Server only. Daily forecasts from Google's Weather API (up to 10 days).
 * Needs GOOGLE_MAPS_API_KEY with the Weather API enabled. Kept for an hour
 * per area, so busy pages don't repeat the call.
 */
import { FORECAST_DAYS, parseDailyForecast, type DayForecast } from "@/lib/domain/weather";

const HOUR = 3_600_000;
const memory = new Map<string, { days: DayForecast[]; at: number }>();

export async function dailyForecast(lat: number, lng: number): Promise<DayForecast[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return [];
  // About 1 km squares: the same forecast for neighbours.
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < HOUR) return hit.days;
  const params = new URLSearchParams({
    "location.latitude": lat.toFixed(4),
    "location.longitude": lng.toFixed(4),
    days: String(FORECAST_DAYS),
    pageSize: String(FORECAST_DAYS),
    key: apiKey,
  });
  try {
    const res = await fetch(`https://weather.googleapis.com/v1/forecast/days:lookup?${params}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      console.error(`Weather API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    const days = parseDailyForecast(await res.json());
    memory.set(key, { days, at: Date.now() });
    if (memory.size > 1000) memory.delete(memory.keys().next().value!);
    return days;
  } catch {
    return [];
  }
}
