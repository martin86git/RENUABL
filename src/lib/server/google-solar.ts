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

const cacheKey = (lat: number, lng: number) => `v2:${lat.toFixed(5)},${lng.toFixed(5)}`;

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
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !inAustralia(lat, lng)) return null;
  const key = cacheKey(lat, lng);
  const hit = await cached(key).catch(() => null);
  if (hit) return hit.data;
  const params = new URLSearchParams({
    "location.latitude": lat.toFixed(6),
    "location.longitude": lng.toFixed(6),
    requiredQuality: "MEDIUM",
    key: apiKey,
  });
  const res = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) {
    await remember(key, null);
    return null;
  }
  if (!res.ok) {
    console.error(`Solar API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const json = await res.json();
  const insights = parseBuildingInsights(json);
  const data = insights ? { insights, model: parseRoofModel(json) } : null;
  await remember(key, data);
  return data;
}
