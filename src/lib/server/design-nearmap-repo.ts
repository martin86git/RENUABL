/**
 * Server only. The Nearmap pictures a business has fetched for its roofs (server/nearmap.ts), each capture kept once,
 * and which picture each roof uses ("google" or a capture's survey). Business id first, from the signed-in member.
 */
import { query } from "./db";
import { homeOutline } from "@/lib/domain/design/nearmap";
import type { Point } from "@/lib/domain/design/roof-design";
import { nearmapPicture, nearmapRoofOutlines, nearmapSurveys } from "./nearmap";

/** A roof's place, to six decimals, as its key. */
export const spotOf = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

export interface KeptCapture {
  survey: string;
  captured: string | null;
  fetchedAt: string;
}

export interface RoofImagery {
  /** "google", or the survey of a kept capture. */
  use: string;
  kept: KeptCapture[];
}

export async function roofImagery(businessId: string, lat: number, lng: number): Promise<RoofImagery> {
  const spot = spotOf(lat, lng);
  const [kept, use] = await Promise.all([
    query<KeptCapture>(
      `select survey, captured, to_char(fetched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "fetchedAt"
         from design_nearmap where business_id = $1 and spot = $2 order by captured desc nulls last`,
      [businessId, spot],
    ),
    query<{ use: string }>(`select use from design_nearmap_use where business_id = $1 and spot = $2`, [businessId, spot]),
  ]);
  const chosen = use[0]?.use ?? "google";
  return { use: chosen === "google" || kept.some((k) => k.survey === chosen) ? chosen : "google", kept };
}

async function setUse(businessId: string, spot: string, use: string) {
  await query(
    `insert into design_nearmap_use (business_id, spot, use) values ($1, $2, $3)
     on conflict (business_id, spot) do update set use = excluded.use`,
    [businessId, spot, use],
  );
}

/**
 * Fetches Nearmap's picture of the roof (the newest capture, or one by its survey), keeps it and puts it in use.
 * "none" when Nearmap has no picture there; "unknown" for a survey Nearmap doesn't list at this roof.
 */
export async function fetchNearmap(
  businessId: string,
  place: { lat: number; lng: number },
  by: string,
  survey?: string,
): Promise<{ survey: string; captured: string | null } | "none" | "unknown"> {
  const surveys = (await nearmapSurveys(place.lat, place.lng)) ?? [];
  const chosen = survey ? surveys.find((s) => s.id === survey) : surveys[0];
  if (survey && !chosen) return "unknown";
  // Kept only with the capture it is (its survey and date): never as a "latest" a later fetch would write over.
  if (!chosen) return "none";
  const bytes = await nearmapPicture(place.lat, place.lng, chosen?.id);
  if (!bytes) return "none";
  const id = chosen?.id ?? "latest";
  const captured = chosen?.captured ?? null;
  const spot = spotOf(place.lat, place.lng);
  await query(
    `insert into design_nearmap (business_id, spot, survey, captured, bytes, fetched_by) values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id, spot, survey) do update set bytes = excluded.bytes, captured = excluded.captured,
       fetched_by = excluded.fetched_by, fetched_at = now()`,
    [businessId, spot, id, captured, bytes, by],
  );
  await setUse(businessId, spot, id);
  return { survey: id, captured };
}

/** Puts Google's picture, or a capture already kept, in use. Calls no one. */
export async function chooseImagery(businessId: string, place: { lat: number; lng: number }, use: string): Promise<boolean> {
  const spot = spotOf(place.lat, place.lng);
  if (use !== "google") {
    const has = await query(`select 1 from design_nearmap where business_id = $1 and spot = $2 and survey = $3`, [businessId, spot, use]);
    if (!has.length) return false;
  }
  await setUse(businessId, spot, use);
  return true;
}

/** A kept capture's picture, the business's own only. */
export async function keptPicture(businessId: string, lat: number, lng: number, survey: string): Promise<Buffer | null> {
  const rows = await query<{ bytes: Buffer }>(`select bytes from design_nearmap where business_id = $1 and spot = $2 and survey = $3`, [
    businessId,
    spotOf(lat, lng),
    survey,
  ]);
  return rows[0]?.bytes ?? null;
}

/**
 * The home's roof outline in the Nearmap capture this roof uses (domain/design/nearmap.ts `homeOutline`), in the
 * designer's frame: asked of Nearmap once a capture and kept with it. "google" when Google's picture is in use (the
 * outline must match the photo it is drawn on); "unreached" when Nearmap couldn't be asked.
 */
export async function nearmapOutline(
  businessId: string,
  place: { lat: number; lng: number },
): Promise<{ points: Point[] | null; captured: string | null } | "google" | "unreached"> {
  const spot = spotOf(place.lat, place.lng);
  const imagery = await roofImagery(businessId, place.lat, place.lng);
  if (imagery.use === "google") return "google";
  const rows = await query<{ captured: string | null; outline: Point[] | null }>(
    `select captured, outline from design_nearmap where business_id = $1 and spot = $2 and survey = $3`,
    [businessId, spot, imagery.use],
  );
  const row = rows[0];
  if (!row) return "google";
  if (row.outline) return { points: row.outline.length ? row.outline : null, captured: row.captured };
  const rings = await nearmapRoofOutlines(place.lat, place.lng, row.captured);
  if (!rings) return "unreached";
  const points = homeOutline(rings, place);
  await query(`update design_nearmap set outline = $4 where business_id = $1 and spot = $2 and survey = $3`, [
    businessId,
    spot,
    imagery.use,
    JSON.stringify(points ?? []),
  ]);
  return { points, captured: row.captured };
}
