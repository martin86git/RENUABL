/**
 * Server only. Roof data from Google's Solar API (buildingInsights), for the
 * home at these coordinates. Needs GOOGLE_MAPS_API_KEY with the Solar API
 * enabled. Each home is looked up once and kept (in the database when there
 * is one), because every lookup is charged; homes Google has no roof for are
 * remembered too.
 */
import { parseRoofModel, type RoofModel } from "@/lib/domain/roof-layout";
import { parseBuildingInsights, type RoofInsights } from "@/lib/domain/solar-roof";
import { dbConfigured, query } from "./db";

const KEEP_DAYS = 180;
/** The roof's figures and its panel spots, from one lookup. */
export interface RoofData {
  insights: RoofInsights;
  model: RoofModel | null;
}

const memory = new Map<string, { data: RoofData | null; at: number }>();

export function inAustralia(lat: number, lng: number) {
  return lat >= -44 && lat <= -9 && lng >= 112 && lng <= 154;
}

const cacheKey = (lat: number, lng: number) => `v3:${lat.toFixed(5)},${lng.toFixed(5)}`;

async function cached(key: string): Promise<{ data: RoofData | null } | null> {
  const m = memory.get(key);
  if (m && Date.now() - m.at < KEEP_DAYS * 86_400_000) return m;
  if (!dbConfigured()) return null;
  const rows = await query<{ data: RoofData | null }>(
    `select data from roof_cache where key = $1 and fetched_at > now() - ($2 || ' days')::interval`,
    [key, String(KEEP_DAYS)],
  );
  return rows[0] ?? null;
}

async function remember(key: string, data: RoofData | null) {
  memory.set(key, { data, at: Date.now() });
  if (memory.size > 2000) memory.delete(memory.keys().next().value!);
  if (dbConfigured()) {
    await query(
      `insert into roof_cache (key, data) values ($1, $2) on conflict (key) do update set data = excluded.data, fetched_at = now()`,
      [key, data === null ? null : JSON.stringify(data)],
    ).catch(() => undefined);
  }
}

/** The roof at these coordinates, or null (no key, outside Australia, or no roof data from Google). */
export async function roofInsights(lat: number, lng: number): Promise<RoofInsights | null> {
  return (await roofData(lat, lng))?.insights ?? null;
}

/** The roof's figures and panel spots (one charged lookup per home, then kept). */
export async function roofData(lat: number, lng: number): Promise<RoofData | null> {
  return (await roofLookup(lat, lng)).data;
}

/** Why there's no roof: no key, no Google coverage for the home, or Google refused (e.g. the Solar API isn't enabled for the key). */
export type RoofMissing = "no-key" | "outside-australia" | "no-coverage" | `google-${number}: ${string}`;

/** The roof, or why there isn't one (for preview diagnostics). Tries medium-quality imagery, then base. */
export async function roofLookup(lat: number, lng: number): Promise<{ data: RoofData | null; reason?: RoofMissing }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return { data: null, reason: "no-key" };
  if (!inAustralia(lat, lng)) return { data: null, reason: "outside-australia" };
  const key = cacheKey(lat, lng);
  const hit = await cached(key).catch(() => null);
  if (hit) return hit.data ? { data: hit.data } : { data: null, reason: "no-coverage" };
  for (const quality of ["MEDIUM", "BASE"]) {
    const params = new URLSearchParams({
      "location.latitude": lat.toFixed(6),
      "location.longitude": lng.toFixed(6),
      requiredQuality: quality,
      key: apiKey,
    });
    const res = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) continue;
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      console.error(`Solar API ${res.status}: ${text}`);
      return { data: null, reason: `google-${res.status}: ${googleMessage(text)}` };
    }
    const json = await res.json();
    const insights = parseBuildingInsights(json);
    const data = insights ? { insights, model: parseRoofModel(json) } : null;
    await remember(key, data);
    return data ? { data } : { data: null, reason: "no-coverage" };
  }
  await remember(key, null);
  return { data: null, reason: "no-coverage" };
}

/** Google's error message, without anything that could echo the key. */
function googleMessage(text: string) {
  try {
    const m = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? "";
    return m.replace(/key=[^&\s]+/gi, "key=…").slice(0, 160);
  } catch {
    return "unexpected reply";
  }
}
