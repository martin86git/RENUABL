/** Server only. NASA POWER climatology for a location, cached for a month (it's a long-term average). */
import { parseNasaClimatology, type Sunshine } from "@/lib/domain/sunshine";

export async function sunshineAt(lat: number, lng: number): Promise<Sunshine | null> {
  // Round to ~1 km so nearby homes share a cache entry (NASA's grid is far coarser).
  const la = lat.toFixed(2);
  const lo = lng.toFixed(2);
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&latitude=${la}&longitude=${lo}&format=JSON`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`NASA POWER ${res.status}`);
  return parseNasaClimatology(await res.json(), Number(la), Number(lo));
}
