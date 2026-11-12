/**
 * Server only. How far Nearmap's heights sit from the picture in use when the two are from different flights
 * (domain/design/heights-shift.ts): the heights' own flight's picture matched against the picture in use, over the
 * middle of the picture, by normalised cross-correlation (`bestShift`). Kept by place and pair of flights for every
 * business (both are Nearmap's pictures of the same place), so each pair is worked out once.
 */
import sharp from "sharp";
import { ALIGN, shiftInMetres, type HeightsShift } from "@/lib/domain/design/heights-shift";
import { metresPerPixel } from "@/lib/domain/design/roof-design";
import { bestShift, trustworthy, type Grey } from "@/lib/domain/image-align";
import { query } from "./db";
import { nearmapPicture } from "./nearmap";

/** A picture as greys at a quarter size, softened a little so the two flights compare fairly. */
async function grey(jpeg: Buffer): Promise<Grey> {
  const meta = await sharp(jpeg).metadata();
  const width = Math.round((meta.width ?? 1280) / ALIGN.shrink);
  const height = Math.round((meta.height ?? 800) / ALIGN.shrink);
  const { data } = await sharp(jpeg)
    .greyscale()
    .resize(width, height, { fit: "fill" })
    .blur(0.8)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width, height, data: Float32Array.from(data) };
}

/** The shift between two pictures of the same window (the heights' flight's, then the one in use), or null when unclear. */
export async function shiftBetween(heightsPicture: Buffer, inUse: Buffer, lat: number): Promise<HeightsShift | null> {
  const [a, b] = await Promise.all([grey(heightsPicture), grey(inUse)]);
  if (a.width !== b.width || a.height !== b.height) return null;
  // Picture pixels at zoom 21 (the picture is ROOF_IMAGE at twice the size), shrunk.
  const mpp = metresPerPixel(lat) / 2;
  const half = ALIGN.across / 2 / (mpp * ALIGN.shrink);
  const region = {
    x0: Math.max(0, Math.round(a.width / 2 - half)),
    y0: Math.max(0, Math.round(a.height / 2 - half)),
    x1: Math.min(a.width, Math.round(a.width / 2 + half)),
    y1: Math.min(a.height, Math.round(a.height / 2 + half)),
  };
  const s = bestShift(a, b, ALIGN.maxShift, region);
  if (!trustworthy(s)) return null;
  const by = shiftInMetres(s.dx, s.dy, mpp);
  return Math.hypot(by.x, by.y) < ALIGN.least ? { x: 0, y: 0 } : by;
}

/**
 * The shift for the heights from flight `heights` onto the picture from flight `picture` at this place: kept, else
 * worked out (the heights' flight's picture asked of Nearmap once) and kept. Null when the match isn't clear (the
 * heights are then used as they are, as before) or Nearmap couldn't be reached.
 */
export async function heightsShift(
  spot: string,
  place: { lat: number; lng: number },
  heights: string,
  picture: string,
  inUse: () => Promise<Buffer | null>,
): Promise<HeightsShift | null> {
  if (heights === picture) return null;
  const kept = await query<{ x: number | null; y: number | null }>(
    `select x, y from nearmap_heights_shift where spot = $1 and heights_survey = $2 and picture_survey = $3`,
    [spot, heights, picture],
  );
  if (kept[0]) return kept[0].x === null || kept[0].y === null ? null : { x: kept[0].x, y: kept[0].y };
  const [own, used] = await Promise.all([nearmapPicture(place.lat, place.lng, heights), inUse()]);
  if (!own || !used) return null; // not reached: asked again next time
  const by = await shiftBetween(own, used, place.lat).catch(() => null);
  await query(
    `insert into nearmap_heights_shift (spot, heights_survey, picture_survey, x, y) values ($1, $2, $3, $4, $5)
     on conflict (spot, heights_survey, picture_survey) do update set x = excluded.x, y = excluded.y, found_at = now()`,
    [spot, heights, picture, by?.x ?? null, by?.y ?? null],
  );
  return by;
}
