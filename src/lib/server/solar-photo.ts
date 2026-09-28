/**
 * Server only. Google Solar's own aerial photo of a home (the Solar API's RGB
 * data layer): the image its panel spots were measured on, so a layout drawn
 * on it lines up, even on multi-storey buildings where the ordinary satellite
 * view leans. It comes as a GeoTIFF on a UTM grid; we turn it into a JPEG and
 * keep it with its grid (GeoFrame) in private storage, because each lookup is charged.
 */
import { fromArrayBuffer } from "geotiff";
import sharp from "sharp";
import { cleanGeoFrame, type GeoFrame } from "@/lib/domain/roof-layout";
import { inAustralia, roofData } from "./google-solar";
import { readFile, readJson, saveFileAt, saveJson, storageConfigured } from "./storage";

export interface RoofPhoto {
  jpeg: Buffer;
  frame: GeoFrame;
}

const memory = new Map<string, RoofPhoto>();
const cacheKey = (lat: number, lng: number) => `roof-photos/v1/${lat.toFixed(5)},${lng.toFixed(5)}`;

/** Enough ground around the home to take in every panel spot, with a margin. */
async function radiusFor(lat: number, lng: number) {
  const model = (await roofData(lat, lng).catch(() => null))?.model;
  if (!model) return 30;
  const mLat = 111_132;
  const mLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const far = Math.max(...model.slots.map((s) => Math.hypot((s.lat - lat) * mLat, (s.lng - lng) * mLng)));
  return Math.round(Math.min(60, Math.max(15, far + 9)));
}

async function fromStorage(key: string): Promise<RoofPhoto | null> {
  if (!storageConfigured()) return null;
  const frame = cleanGeoFrame(await readJson<unknown>(`${key}.json`));
  if (!frame) return null;
  const file = await readFile(`${key}.jpg`);
  if (!file) return null;
  return { jpeg: Buffer.from(await new Response(file.stream).arrayBuffer()), frame };
}

async function fromGoogle(lat: number, lng: number, apiKey: string): Promise<RoofPhoto | null> {
  const radius = await radiusFor(lat, lng);
  let layers: { rgbUrl?: string } | null = null;
  for (const quality of ["MEDIUM", "BASE"]) {
    const params = new URLSearchParams({
      "location.latitude": lat.toFixed(6),
      "location.longitude": lng.toFixed(6),
      radiusMeters: String(radius),
      view: "IMAGERY_LAYERS",
      requiredQuality: quality,
      pixelSizeMeters: radius > 45 ? "0.15" : "0.1",
      key: apiKey,
    });
    const res = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) continue;
    if (!res.ok) {
      console.error(`Solar data layers ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    layers = (await res.json()) as { rgbUrl?: string };
    break;
  }
  if (!layers?.rgbUrl?.startsWith("https://solar.googleapis.com/")) return null;
  const tif = await fetch(`${layers.rgbUrl}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(20_000) });
  if (!tif.ok) {
    console.error(`Solar GeoTIFF ${tif.status}`);
    return null;
  }
  const image = await (await fromArrayBuffer(await tif.arrayBuffer())).getImage();
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const frame = cleanGeoFrame({
    epsg: image.getGeoKeys()?.ProjectedCSTypeGeoKey,
    bbox: [minX, minY, maxX, maxY],
    width: image.getWidth(),
    height: image.getHeight(),
  });
  if (!frame) {
    console.error("Solar GeoTIFF: not on a UTM grid");
    return null;
  }
  const channels = image.getSamplesPerPixel();
  if (channels !== 3 && channels !== 4) return null;
  const pixels = (await image.readRasters({ interleave: true })) as unknown as Uint8Array;
  const jpeg = await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), {
    raw: { width: frame.width, height: frame.height, channels },
  })
    .removeAlpha()
    .jpeg({ quality: 82 })
    .toBuffer();
  return { jpeg, frame };
}

/** The home's Google Solar photo and its grid, or null (no key, no coverage, or Google refused). */
export async function roofPhoto(lat: number, lng: number): Promise<RoofPhoto | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !inAustralia(lat, lng)) return null;
  const key = cacheKey(lat, lng);
  const hit = memory.get(key) ?? (await fromStorage(key).catch(() => null));
  if (hit) {
    memory.set(key, hit);
    return hit;
  }
  const photo = await fromGoogle(lat, lng, apiKey).catch((e) => {
    console.error("Solar photo failed", e instanceof Error ? e.message : e);
    return null;
  });
  if (!photo) return null;
  memory.set(key, photo);
  if (memory.size > 40) memory.delete(memory.keys().next().value!);
  if (storageConfigured()) {
    await Promise.all([saveFileAt(`${key}.jpg`, photo.jpeg, "image/jpeg"), saveJson(`${key}.json`, photo.frame)]).catch(() => undefined);
  }
  return photo;
}
