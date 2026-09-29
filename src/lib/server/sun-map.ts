/**
 * Server only. The sun map for a home: Google Solar's annual sunlight layer
 * (flux) coloured over the home's own roof (from the roof mask), as a PNG on
 * Google Solar's UTM grid, with a plain-words summary. One Data Layers lookup
 * per home (charged), then kept in private storage.
 */
import { fromArrayBuffer } from "geotiff";
import sharp from "sharp";
import { cleanGeoFrame, project, type GeoFrame } from "@/lib/domain/roof-layout";
import { cleanBox, cleanSunSummary, homeRoof, sunOverlay, sunSummary, type SunSummary } from "@/lib/domain/sun-map";
import { inAustralia, roofData } from "./google-solar";
import { photoFromRgbUrl, radiusFor, rememberPhoto } from "./solar-photo";
import { readFile, readJson, saveFileAt, saveJson, storageConfigured } from "./storage";

export interface SunMap {
  png: Buffer;
  frame: GeoFrame;
  summary: SunSummary;
  /** The home's roof in the overlay's pixels (left, top, right, bottom). */
  box: [number, number, number, number];
}

const memory = new Map<string, SunMap>();
// v2: the roof is picked from the building Google matched, not the nearest roof to the address point.
const cacheKey = (lat: number, lng: number) => `roof-photos/v2/${lat.toFixed(5)},${lng.toFixed(5)}.sun`;

async function geoTiff(url: string, apiKey: string) {
  const res = await fetch(`${url}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GeoTIFF ${res.status}`);
  const image = await (await fromArrayBuffer(await res.arrayBuffer())).getImage();
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const frame = cleanGeoFrame({
    epsg: image.getGeoKeys()?.ProjectedCSTypeGeoKey,
    bbox: [minX, minY, maxX, maxY],
    width: image.getWidth(),
    height: image.getHeight(),
  });
  if (!frame) throw new Error("GeoTIFF not on a UTM grid");
  const [band] = (await image.readRasters()) as unknown as ArrayLike<number>[];
  return { frame, band };
}

async function fromGoogle(lat: number, lng: number, apiKey: string): Promise<SunMap | null> {
  const radius = await radiusFor(lat, lng);
  let layers: { annualFluxUrl?: string; maskUrl?: string; rgbUrl?: string } | null = null;
  for (const quality of ["MEDIUM", "BASE"]) {
    const params = new URLSearchParams({
      "location.latitude": lat.toFixed(6),
      "location.longitude": lng.toFixed(6),
      radiusMeters: String(radius),
      view: "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
      requiredQuality: quality,
      pixelSizeMeters: radius > 45 ? "0.15" : "0.1",
      key: apiKey,
    });
    const res = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) continue;
    if (!res.ok) {
      console.error(`Solar data layers (sun) ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    layers = await res.json();
    break;
  }
  const google = (u?: string) => (u?.startsWith("https://solar.googleapis.com/") ? u : null);
  const fluxUrl = google(layers?.annualFluxUrl);
  const maskUrl = google(layers?.maskUrl);
  if (!fluxUrl || !maskUrl) return null;
  // The same lookup includes the roof photo: keep it for lining up the satellite photo (no second lookup).
  const rgbUrl = google(layers?.rgbUrl);
  if (rgbUrl) {
    const photo = await photoFromRgbUrl(rgbUrl, apiKey).catch(() => null);
    if (photo) await rememberPhoto(lat, lng, photo);
  }
  const [flux, mask] = await Promise.all([geoTiff(fluxUrl, apiKey), geoTiff(maskUrl, apiKey)]);
  const { frame } = flux;
  const { width, height } = frame;
  // The mask can come at a different size: read it at the flux layer's pixels.
  const m = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const my = Math.min(mask.frame.height - 1, Math.floor((y * mask.frame.height) / height));
    for (let x = 0; x < width; x++) {
      const mx = Math.min(mask.frame.width - 1, Math.floor((x * mask.frame.width) / width));
      m[y * width + x] = mask.band[my * mask.frame.width + mx] ? 1 : 0;
    }
  }
  // Start from the building Google matched for the home (the same one as "Your roof"), not the address point, which can sit nearer a neighbour.
  const insights = (await roofData(lat, lng).catch(() => null))?.insights;
  if (!insights) return null;
  const seedAt = insights.center ?? { lat, lng };
  const roof = homeRoof(
    m,
    width,
    height,
    project(seedAt.lat, seedAt.lng, frame),
    Math.round(8 / ((frame.bbox[2] - frame.bbox[0]) / width)),
  );
  const overlay = sunOverlay(Float32Array.from(flux.band), roof, width, height);
  if (!overlay.roofPixels || !overlay.box) return null;
  const png = await sharp(Buffer.from(overlay.rgba), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  const summary = sunSummary(insights, overlay.shadedShare);
  return { png, frame, summary, box: overlay.box };
}

async function fromStorage(key: string): Promise<SunMap | null> {
  if (!storageConfigured()) return null;
  const meta = await readJson<{ frame: unknown; summary: unknown; box: unknown }>(`${key}.json`);
  const frame = cleanGeoFrame(meta?.frame);
  const summary = cleanSunSummary(meta?.summary);
  const box = frame && cleanBox(meta?.box, frame.width, frame.height);
  if (!frame || !summary || !box) return null;
  const file = await readFile(`${key}.png`);
  if (!file) return null;
  return { png: Buffer.from(await new Response(file.stream).arrayBuffer()), frame, summary, box };
}

/** The home's sun map, or null (no key, no coverage, or Google refused). */
export async function sunMap(lat: number, lng: number): Promise<SunMap | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !inAustralia(lat, lng)) return null;
  const key = cacheKey(lat, lng);
  const hit = memory.get(key) ?? (await fromStorage(key).catch(() => null));
  if (hit) {
    memory.set(key, hit);
    return hit;
  }
  const map = await fromGoogle(lat, lng, apiKey).catch((e) => {
    console.error("sun map failed", e instanceof Error ? e.message : e);
    return null;
  });
  if (!map) return null;
  memory.set(key, map);
  if (memory.size > 40) memory.delete(memory.keys().next().value!);
  if (storageConfigured()) {
    await Promise.all([
      saveFileAt(`${key}.png`, map.png, "image/png"),
      saveJson(`${key}.json`, { frame: map.frame, summary: map.summary, box: map.box }),
    ]).catch(() => undefined);
  }
  return map;
}
