/**
 * Server only. The ground around a roof as a plain drawing, for the roof
 * designer's drawing mode: lawn, trees, paving and buildings in flat
 * colours, on the designer's own picture (640 × 400, the same place and
 * scale as its satellite photo, so everything drawn on the roof sits where
 * it did).
 *
 * It is worked out from Google Solar's data layers for the place: surface
 * heights (so a tree is told from a lawn and a roof from a drive), the
 * building outline, and the aerial photo's colours. One Data Layers lookup
 * for each roof (charged), then kept in the database. A picture to design
 * and present on, never a survey.
 */
import { fromArrayBuffer } from "geotiff";
import sharp from "sharp";
import { GROUND_COLOURS, groundAt, groundLevel, tidyGround, type Ground } from "@/lib/domain/design/drawing";
import { ROOF_IMAGE, metresPerPixel } from "@/lib/domain/design/roof-design";
import { cleanGeoFrame, project, type GeoFrame } from "@/lib/domain/roof-layout";
import { dbConfigured, query } from "./db";
import { inAustralia } from "./google-solar";

// v2: paving only where it is pale and colourless; larger plain shapes.
const cacheKey = (lat: number, lng: number) => `ground/v3/${lat.toFixed(5)},${lng.toFixed(5)}`;
const memory = new Map<string, Buffer | null>();

interface Layer {
  frame: GeoFrame;
  bands: ArrayLike<number>[];
}

async function layer(url: string, apiKey: string): Promise<Layer> {
  const res = await fetch(`${url}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(25_000) });
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
  return { frame, bands: (await image.readRasters()) as unknown as ArrayLike<number>[] };
}

async function fromGoogle(lat: number, lng: number, apiKey: string): Promise<Buffer | null> {
  const mpp = metresPerPixel(lat);
  // Enough ground to cover the designer's whole picture, corner to corner.
  const radius = Math.min(100, Math.ceil(Math.hypot(ROOF_IMAGE.width, ROOF_IMAGE.height) * mpp * 0.5 + 3));
  let urls: { dsmUrl?: string; maskUrl?: string; rgbUrl?: string } | null = null;
  for (const quality of ["MEDIUM", "BASE"]) {
    const params = new URLSearchParams({
      "location.latitude": lat.toFixed(6),
      "location.longitude": lng.toFixed(6),
      radiusMeters: String(radius),
      view: "IMAGERY_LAYERS",
      requiredQuality: quality,
      pixelSizeMeters: "0.25",
      key: apiKey,
    });
    const res = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) continue;
    if (!res.ok) {
      console.error(`Solar data layers (ground) ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    urls = await res.json();
    break;
  }
  const google = (u?: string) => (u?.startsWith("https://solar.googleapis.com/") ? u : null);
  const dsmUrl = google(urls?.dsmUrl);
  const maskUrl = google(urls?.maskUrl);
  const rgbUrl = google(urls?.rgbUrl);
  if (!dsmUrl || !maskUrl || !rgbUrl) return null;
  const [dsm, mask, rgb] = await Promise.all([layer(dsmUrl, apiKey), layer(maskUrl, apiKey), layer(rgbUrl, apiKey)]);
  if (rgb.bands.length < 3) return null;

  // The ground's own level under the surface heights: metre cells, opened over about 25 m.
  const dsmPx = (dsm.frame.bbox[2] - dsm.frame.bbox[0]) / dsm.frame.width;
  const cell = Math.max(1, Math.round(1 / dsmPx));
  const terrain = groundLevel(dsm.bands[0], dsm.frame.width, dsm.frame.height, cell, 12);

  // Where each of the designer's pixels falls on Google's grid: from three corners, since over a block it is a
  // straight-line mapping to well under a pixel.
  const W = ROOF_IMAGE.width;
  const H = ROOF_IMAGE.height;
  const mLat = 111_132.954 - 559.822 * Math.cos((2 * lat * Math.PI) / 180);
  const mLng = 111_412.84 * Math.cos((lat * Math.PI) / 180);
  const on = (px: number, py: number, frame: GeoFrame) =>
    project(lat - ((py - H / 2) * mpp) / mLat, lng + ((px - W / 2) * mpp) / mLng, frame);
  const mapping = (frame: GeoFrame) => {
    const o = on(0, 0, frame);
    const x = on(W, 0, frame);
    const y = on(0, H, frame);
    return (px: number, py: number) => ({
      x: Math.floor(o.x + ((x.x - o.x) * px) / W + ((y.x - o.x) * py) / H),
      y: Math.floor(o.y + ((x.y - o.y) * px) / W + ((y.y - o.y) * py) / H),
    });
  };
  const toDsm = mapping(dsm.frame);
  const toMask = mapping(mask.frame);
  const toRgb = mapping(rgb.frame);
  const inside = (p: { x: number; y: number }, f: GeoFrame) => p.x >= 0 && p.y >= 0 && p.x < f.width && p.y < f.height;
  const surface = (p: { x: number; y: number }) => {
    if (!inside(p, dsm.frame)) return NaN;
    const v = dsm.bands[0][p.y * dsm.frame.width + p.x];
    return Number.isFinite(v) && v > -1000 ? v : NaN;
  };

  const cells = new Array<Ground>(W * H);
  const relief = new Float32Array(W * H);
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const d = toDsm(px + 0.5, py + 0.5);
      const top = surface(d);
      const ground = inside(d, dsm.frame)
        ? terrain.level[
            Math.min(terrain.rows - 1, Math.floor(d.y / cell)) * terrain.cols + Math.min(terrain.cols - 1, Math.floor(d.x / cell))
          ]
        : NaN;
      const height = Number.isFinite(top) && Number.isFinite(ground) ? top - ground : 0;
      const m = toMask(px + 0.5, py + 0.5);
      const building = inside(m, mask.frame) && Boolean(mask.bands[0][m.y * mask.frame.width + m.x]);
      const c = toRgb(px + 0.5, py + 0.5);
      const at = inside(c, rgb.frame) ? c.y * rgb.frame.width + c.x : -1;
      cells[i] = at < 0 ? "lawn" : groundAt(rgb.bands[0][at], rgb.bands[1][at], rgb.bands[2][at], height, building);
      // How the surface leans here, lit from the north-west: what makes a roof read as planes and a canopy as round.
      const a = surface({ x: d.x - 2, y: d.y - 2 });
      const b = surface({ x: d.x + 2, y: d.y + 2 });
      relief[i] = Number.isFinite(a) && Number.isFinite(b) ? b - a : 0;
    }

  const tidy = tidyGround(cells, W, H, 3, 3);
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const kind = tidy[i];
    const [r, g, b] = GROUND_COLOURS[kind];
    // Only what stands up is shaded; the flat ground stays flat colour.
    const shade =
      kind === "built" ? Math.max(-20, Math.min(20, relief[i] * 26)) : kind === "tree" ? Math.max(-12, Math.min(12, relief[i] * 9)) : 0;
    out[i * 3] = Math.max(0, Math.min(255, r + shade));
    out[i * 3 + 1] = Math.max(0, Math.min(255, g + shade));
    out[i * 3 + 2] = Math.max(0, Math.min(255, b + shade));
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .blur(0.7)
    .png()
    .toBuffer();
}

async function fromDb(key: string): Promise<Buffer | null | undefined> {
  if (!dbConfigured()) return undefined;
  const rows = await query<{ png: Buffer | null }>(`select png from ground_cache where key = $1`, [key]);
  return rows.length ? rows[0].png : undefined;
}

/** The ground around the roof at this place as a PNG on the designer's picture, or null (no key, no coverage, or Google refused). */
export async function groundMap(lat: number, lng: number): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !inAustralia(lat, lng)) return null;
  const key = cacheKey(lat, lng);
  if (memory.has(key)) return memory.get(key) ?? null;
  const kept = await fromDb(key).catch(() => undefined);
  if (kept !== undefined) {
    memory.set(key, kept);
    return kept;
  }
  let failed = false;
  const png = await fromGoogle(lat, lng, apiKey).catch((e) => {
    console.error("ground map failed", e instanceof Error ? e.message : e);
    failed = true;
    return null;
  });
  memory.set(key, png);
  if (memory.size > 60) memory.delete(memory.keys().next().value!);
  // A place Google has no data for is remembered too (so it isn't asked again); a failure on the way isn't.
  if (!failed && dbConfigured()) {
    await query(
      `insert into ground_cache (key, png) values ($1, $2) on conflict (key) do update set png = excluded.png, fetched_at = now()`,
      [key, png],
    ).catch(() => undefined);
  }
  return png;
}
