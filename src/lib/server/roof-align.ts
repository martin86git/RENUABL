/**
 * Server only. Lines the sharp Maps Static satellite photo up with Google
 * Solar's own photo (whose geometry matches the panel spots): on taller
 * buildings the satellite view leans, so the roof sits a metre or more off.
 * Worked out once per home and kept; when the match isn't clear, there's no
 * shift and the layout is drawn on Google Solar's photo instead.
 */
import sharp from "sharp";
import { bestShift, trustworthy, type Grey } from "@/lib/domain/image-align";
import { designView, framing, fromPixel, project, type GeoFrame } from "@/lib/domain/roof-layout";
import { roofData } from "./google-solar";
import { satelliteImage } from "./roof-view";
import { roofPhoto } from "./solar-photo";
import { readJson, saveJson, storageConfigured } from "./storage";

/** Where to draw the satellite photo (its top-left, in its own pixels) so its roof lines up. */
export interface SatelliteShift {
  x: number;
  y: number;
}

/** Work at a quarter of the photo's 1280 px (about 24 cm a pixel). */
const F = 4;
/** Search up to 20 small pixels (about 5 m) each way. */
const MAX_SHIFT = 20;

const memory = new Map<string, SatelliteShift | null>();
const cacheKey = (lat: number, lng: number) => `roof-photos/v1/${lat.toFixed(5)},${lng.toFixed(5)}.shift.json`;

/** Google Solar's photo resampled onto the (small) satellite photo's pixels. */
function solarOnSatellite(
  solar: { data: Buffer; width: number; height: number },
  frame: GeoFrame,
  view: ReturnType<typeof designView>,
): Grey {
  const w = (view.size * view.scale) / F;
  const data = new Float32Array(w * w);
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const ll = fromPixel(i * F + F / 2, j * F + F / 2, view);
      const p = project(ll.lat, ll.lng, frame);
      const x = p.x - 0.5;
      const y = p.y - 0.5;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= solar.width || y0 + 1 >= solar.height) {
        data[j * w + i] = NaN;
        continue;
      }
      const fx = x - x0;
      const fy = y - y0;
      const v = (xx: number, yy: number) => solar.data[yy * solar.width + xx];
      data[j * w + i] =
        v(x0, y0) * (1 - fx) * (1 - fy) + v(x0 + 1, y0) * fx * (1 - fy) + v(x0, y0 + 1) * (1 - fx) * fy + v(x0 + 1, y0 + 1) * fx * fy;
    }
  }
  return { width: w, height: w, data };
}

async function compute(lat: number, lng: number): Promise<SatelliteShift | null> {
  const photo = await roofPhoto(lat, lng);
  if (!photo) return null;
  const res = await satelliteImage({ line: "", suburb: "", state: "", postcode: "", lat, lng }, "design");
  if (!res) return null;
  const view = designView({ lat, lng });
  const w = (view.size * view.scale) / F;
  // Soften the sharp photo a little so it compares fairly with Google Solar's softer one.
  const sat = await sharp(Buffer.from(await res.arrayBuffer()))
    .greyscale()
    .resize(w, w, { fit: "fill" })
    .blur(1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const solar = await sharp(photo.jpeg).greyscale().raw().toBuffer({ resolveWithObject: true });
  const a = solarOnSatellite({ data: solar.data, width: solar.info.width, height: solar.info.height }, photo.frame, view);
  const b: Grey = { width: w, height: w, data: Float32Array.from(sat.data) };
  // Compare over the roof (where the panel spots are), not the street around it.
  const model = (await roofData(lat, lng).catch(() => null))?.model;
  const f = model ? framing(model, view, 3) : { x: 320, y: 320, w: 640, h: 640 };
  const region = {
    x0: Math.max(0, Math.floor(f.x / F)),
    y0: Math.max(0, Math.floor(f.y / F)),
    x1: Math.min(w, Math.ceil((f.x + f.w) / F)),
    y1: Math.min(w, Math.ceil((f.y + f.h) / F)),
  };
  const s = bestShift(a, b, MAX_SHIFT, region);
  if (!trustworthy(s)) {
    console.info(`satellite alignment not trusted (score ${s.score.toFixed(2)}, margin ${s.margin.toFixed(2)})`);
    return null;
  }
  // A true point p shows at p + d on the satellite photo: draw the photo d back.
  return { x: Math.round(-s.dx * F * 10) / 10, y: Math.round(-s.dy * F * 10) / 10 };
}

/** The shift for this home's satellite photo, or null (use Google Solar's photo, or no shift). */
export async function satelliteShift(lat: number, lng: number): Promise<SatelliteShift | null> {
  const key = cacheKey(lat, lng);
  if (memory.has(key)) return memory.get(key)!;
  if (storageConfigured()) {
    const kept = await readJson<{ shift: SatelliteShift | null }>(key).catch(() => null);
    if (kept) {
      memory.set(key, kept.shift);
      return kept.shift;
    }
  }
  const shift = await compute(lat, lng).catch((e) => {
    console.error("satellite alignment failed", e instanceof Error ? e.message : e);
    return undefined;
  });
  if (shift === undefined) return null; // failed: try again next time
  memory.set(key, shift);
  if (memory.size > 500) memory.delete(memory.keys().next().value!);
  // Only keep an answer when Google Solar's photo was there to compare with.
  if (storageConfigured() && (shift || (await roofPhoto(lat, lng)))) await saveJson(key, { shift }).catch(() => undefined);
  return shift;
}
