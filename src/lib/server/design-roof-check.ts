/**
 * Server only. What is already on a roof (existing panels, vents, skylights), found on the picture the designer shows
 * (Google's, or the Nearmap capture in use) by the obstruction check (`obstruction-check.ts`, Claude), set on the roof
 * in metres (`roof-check.ts`) and kept for the business once a picture, so opening the roof again costs nothing.
 * Business id first, from the signed-in member.
 */
import sharp from "sharp";
import { HOME_BOX, roofThings, type RoofCheck } from "@/lib/domain/design/roof-check";
import { query } from "./db";
import { keptPicture, roofImagery, spotOf } from "./design-nearmap-repo";
import { checkObstructions } from "./obstruction-check";
import { satelliteImage } from "./roof-view";

/** The model that looks, by default: quick enough for a roof as it opens, and sharp enough on a roof photo. */
const ROOF_CHECK_MODEL = "claude-sonnet-5-5";
/** The instructions the check was made with: older checks are made again. */
const CHECK_VERSION = 2;

/** The roof's check for the picture in use: kept, else made now. Null when there is no picture or no key to ask with. */
export async function roofCheck(businessId: string, place: { lat: number; lng: number }): Promise<RoofCheck | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const spot = spotOf(place.lat, place.lng);
  const picture = (await roofImagery(businessId, place.lat, place.lng)).use;
  const kept = await query<{ check_json: RoofCheck & { v?: number } }>(
    `select check_json from design_roof_checks where business_id = $1 and spot = $2 and picture = $3`,
    [businessId, spot, picture],
  );
  // A check made with older instructions is made again once (v2: fixtures on the roof only, 9 Nov 2026).
  if (kept[0] && kept[0].check_json.v === CHECK_VERSION) return kept[0].check_json;
  if (!apiKey) return null;
  let image: { data: ArrayBuffer; mediaType: "image/jpeg" | "image/png" } | null = null;
  if (picture === "google") {
    const res = await satelliteImage({ line: "", suburb: "", state: "", postcode: "", lat: place.lat, lng: place.lng }, "designer");
    if (res?.ok)
      image = { data: await res.arrayBuffer(), mediaType: res.headers.get("content-type")?.includes("png") ? "image/png" : "image/jpeg" };
  } else {
    const bytes = await keptPicture(businessId, place.lat, place.lng, picture);
    if (bytes) image = { data: new Uint8Array(bytes).buffer, mediaType: "image/jpeg" };
  }
  if (!image) return null;
  // Smaller and to the quicker model: the whole picture at 1280 wide kept the deeper model past the reader's time limit.
  const small = await sharp(Buffer.from(image.data)).resize({ width: 960 }).jpeg({ quality: 85 }).toBuffer();
  const found = await checkObstructions({ data: new Uint8Array(small).buffer, mediaType: "image/jpeg" }, HOME_BOX, apiKey, {
    model: process.env.ROOF_CHECK_MODEL?.trim() || ROOF_CHECK_MODEL,
  });
  const check: RoofCheck = { things: roofThings(found.items, place.lat), summary: found.summary, picture, checkedAt: found.checkedAt };
  await query(
    `insert into design_roof_checks (business_id, spot, picture, check_json) values ($1, $2, $3, $4)
     on conflict (business_id, spot, picture) do update set check_json = excluded.check_json, checked_at = now()`,
    [businessId, spot, picture, JSON.stringify({ ...check, v: CHECK_VERSION })],
  );
  return check;
}
