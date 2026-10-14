/**
 * Server only. What Google Solar's data layers say about the ground around a
 * roof, set on the roof designer's own picture (640 × 400, the same place
 * and scale as its satellite photo, so everything drawn on the roof sits
 * where it did). Three things come of one Data Layers lookup (charged), and
 * are kept in the database for the roof:
 *
 * - the ground as a plain drawing (lawn, trees, paving and buildings in flat
 *   colours), for the designer's drawing mode;
 * - the heights of everything there (roofs, treetops, the ground), as a
 *   grid, for the shade analysis and the 3D view;
 * - Google Solar's own aerial photo of the place, which is the photo those
 *   heights were measured from, for the 3D view.
 *
 * Google's data can be older than the satellite photo the designer shows.
 * These are pictures and estimates to design and present on, never a survey.
 */
import { fromArrayBuffer } from "geotiff";
import sharp from "sharp";
import { GROUND_COLOURS, groundAt, groundLevel, tidyGround, type Ground } from "@/lib/domain/design/drawing";
import { ROOF_IMAGE, metresPerPixel } from "@/lib/domain/design/roof-design";
import { buildingsFrom, cleanScene, treesFrom, type Scene } from "@/lib/domain/design/scene";
import { TERRAIN_CELL, packTerrain, type Terrain } from "@/lib/domain/design/shade";
import { cleanGeoFrame, project, type GeoFrame } from "@/lib/domain/roof-layout";
import { dbConfigured, query } from "./db";
import { inAustralia } from "./google-solar";
import { satelliteImage } from "./roof-view";

export interface GroundData {
  /** The plain drawing, PNG, 640 × 400. */
  png: Buffer;
  /** The heights, packed (`packTerrain`). */
  terrain: Buffer;
  /** Google Solar's aerial photo on the same picture, JPEG. */
  aerial: Buffer;
  /** The buildings and trees around the roof as clean shapes, for the 3D view (`Scene`). */
  scene: Scene;
}

// v7: the ground's colours are read from the designer's own (sharper, newer) satellite photo.
const cacheKey = (lat: number, lng: number) => `ground/v8/${lat.toFixed(5)},${lng.toFixed(5)}`;
const memory = new Map<string, GroundData | null>();
/** Lookups under way, so two asks at once for one roof make one lookup. */
const pending = new Map<string, Promise<GroundData | null>>();

interface Layer {
  frame: GeoFrame;
  bands: ArrayLike<number>[];
}

async function layer(url: string, apiKey: string): Promise<Layer> {
  const res = await fetch(`${url}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(30_000) });
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

async function fromGoogle(lat: number, lng: number, apiKey: string): Promise<GroundData | null> {
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
      pixelSizeMeters: "0.1",
      key: apiKey,
    });
    const res = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) continue;
    if (!res.ok) {
      console.error(`Solar data layers (ground) ${res.status}: ${(await res.text()).slice(0, 300)}`);
      throw new Error("data layers refused");
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
  const level = groundLevel(dsm.bands[0], dsm.frame.width, dsm.frame.height, cell, 12);

  // Where a point on the designer's picture (in its pixels) falls on one of Google's grids: from three corners,
  // since over a block it is a straight-line mapping to well under a pixel.
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
  const groundUnder = (p: { x: number; y: number }) =>
    inside(p, dsm.frame)
      ? level.level[Math.min(level.rows - 1, Math.floor(p.y / cell)) * level.cols + Math.min(level.cols - 1, Math.floor(p.x / cell))]
      : NaN;

  // --- the plain drawing
  // Colours come from the designer's own satellite photo where it can be had: it is sharper and truer in colour than
  // Google Solar's aerial (a lawn is plainly green in it, a road plainly grey), and it is the same picture, place and
  // scale. Heights and the building outline still come from the data layers. Without it, Solar's aerial stands in.
  const sharpPhoto = await satelliteImage({ line: "", suburb: "", state: "", postcode: "", lat, lng }, "designer")
    .then(async (res) =>
      res
        ? sharp(Buffer.from(await res.arrayBuffer()))
            .resize(W, H, { fit: "fill" })
            .removeAlpha()
            .raw()
            .toBuffer()
        : null,
    )
    .catch(() => null);
  const colourAt = (px: number, py: number): [number, number, number] | null => {
    if (sharpPhoto && sharpPhoto.length === W * H * 3) {
      const o = (py * W + px) * 3;
      return [sharpPhoto[o], sharpPhoto[o + 1], sharpPhoto[o + 2]];
    }
    const c = toRgb(px + 0.5, py + 0.5);
    if (!inside(c, rgb.frame)) return null;
    const at = c.y * rgb.frame.width + c.x;
    return [rgb.bands[0][at], rgb.bands[1][at], rgb.bands[2][at]];
  };
  const cells = new Array<Ground>(W * H);
  const relief = new Float32Array(W * H);
  const reach = Math.max(1, Math.round(0.5 / dsmPx));
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const d = toDsm(px + 0.5, py + 0.5);
      const top = surface(d);
      const ground = groundUnder(d);
      const height = Number.isFinite(top) && Number.isFinite(ground) ? top - ground : 0;
      const m = toMask(px + 0.5, py + 0.5);
      const building = inside(m, mask.frame) && Boolean(mask.bands[0][m.y * mask.frame.width + m.x]);
      const colour = colourAt(px, py);
      cells[i] = colour ? groundAt(colour[0], colour[1], colour[2], height, building) : "lawn";
      // How the surface leans here, lit from the north-west: what makes a roof read as planes and a canopy as round.
      const a = surface({ x: d.x - reach, y: d.y - reach });
      const b = surface({ x: d.x + reach, y: d.y + reach });
      relief[i] = Number.isFinite(a) && Number.isFinite(b) ? b - a : 0;
    }
  const tidy = tidyGround(cells, W, H, 3, 3);
  const flat = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const kind = tidy[i];
    const [r, g, b] = GROUND_COLOURS[kind];
    // Only what stands up is shaded; the flat ground stays flat colour.
    const shade =
      kind === "built" ? Math.max(-20, Math.min(20, relief[i] * 26)) : kind === "tree" ? Math.max(-12, Math.min(12, relief[i] * 9)) : 0;
    flat[i * 3] = Math.max(0, Math.min(255, r + shade));
    flat[i * 3 + 1] = Math.max(0, Math.min(255, g + shade));
    flat[i * 3 + 2] = Math.max(0, Math.min(255, b + shade));
  }
  const png = await sharp(flat, { raw: { width: W, height: H, channels: 3 } })
    .blur(0.7)
    .png()
    .toBuffer();

  // --- the heights, on a grid of the designer's own metres
  const widthM = W * mpp;
  const heightM = H * mpp;
  const cols = Math.ceil(widthM / TERRAIN_CELL);
  const rows = Math.ceil(heightM / TERRAIN_CELL);
  const heights = new Float32Array(cols * rows);
  // For the scene: the building outline, and how far each cell stands above the ground, on the same grid.
  const outline = new Uint8Array(cols * rows);
  const above = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const d = toDsm(((c + 0.5) * TERRAIN_CELL) / mpp, ((r + 0.5) * TERRAIN_CELL) / mpp);
      const top = surface(d);
      const ground = groundUnder(d);
      const m = toMask(((c + 0.5) * TERRAIN_CELL) / mpp, ((r + 0.5) * TERRAIN_CELL) / mpp);
      outline[r * cols + c] = inside(m, mask.frame) && mask.bands[0][m.y * mask.frame.width + m.x] ? 1 : 0;
      above[r * cols + c] = Number.isFinite(top) && Number.isFinite(ground) ? Math.max(0, top - ground) : 0;
      // Where the surface has no reading, the ground's own level stands in; where neither has, the last one read.
      heights[r * cols + c] = Number.isFinite(top) ? top : Number.isFinite(ground) ? ground : c > 0 ? heights[r * cols + c - 1] : 0;
    }
  const terrain: Terrain = { cols, rows, cell: TERRAIN_CELL, widthM, heightM, heights };
  const outlineGrid = { cols, rows, cell: TERRAIN_CELL, values: outline };
  const aboveGrid = { cols, rows, cell: TERRAIN_CELL, values: above };
  const scene: Scene = { buildings: buildingsFrom(outlineGrid, aboveGrid), trees: treesFrom(outlineGrid, aboveGrid) };

  // --- Google Solar's own aerial photo, on the same picture at twice its size
  const AW = W * 2;
  const AH = H * 2;
  const photo = Buffer.alloc(AW * AH * 3);
  for (let py = 0; py < AH; py++)
    for (let px = 0; px < AW; px++) {
      const c = toRgb((px + 0.5) / 2, (py + 0.5) / 2);
      const at = inside(c, rgb.frame) ? c.y * rgb.frame.width + c.x : -1;
      const o = (py * AW + px) * 3;
      photo[o] = at < 0 ? 60 : rgb.bands[0][at];
      photo[o + 1] = at < 0 ? 70 : rgb.bands[1][at];
      photo[o + 2] = at < 0 ? 60 : rgb.bands[2][at];
    }
  const aerial = await sharp(photo, { raw: { width: AW, height: AH, channels: 3 } })
    .jpeg({ quality: 82 })
    .toBuffer();

  return { png, terrain: Buffer.from(packTerrain(terrain)), aerial, scene };
}

async function fromDb(key: string): Promise<GroundData | null | undefined> {
  if (!dbConfigured()) return undefined;
  const rows = await query<{ png: Buffer | null; terrain: Buffer | null; aerial: Buffer | null; scene: unknown }>(
    `select png, terrain, aerial, scene from ground_cache where key = $1`,
    [key],
  );
  if (!rows.length) return undefined;
  const { png, terrain, aerial, scene } = rows[0];
  return png && terrain && aerial ? { png, terrain, aerial, scene: cleanScene(scene) } : null;
}

/** What Google's data layers give for the roof at this place, or null (no key, no coverage, or Google refused). */
export async function groundData(lat: number, lng: number): Promise<GroundData | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !inAustralia(lat, lng)) return null;
  const key = cacheKey(lat, lng);
  if (memory.has(key)) return memory.get(key) ?? null;
  const running = pending.get(key);
  if (running) return running;
  const work = (async () => {
    const kept = await fromDb(key).catch(() => undefined);
    if (kept !== undefined) {
      memory.set(key, kept);
      return kept;
    }
    let failed = false;
    const data = await fromGoogle(lat, lng, apiKey).catch((e) => {
      console.error("ground data failed", e instanceof Error ? e.message : e);
      failed = true;
      return null;
    });
    // A place Google has no data for is remembered (so it isn't asked again); a failure on the way isn't.
    if (!failed) {
      memory.set(key, data);
      if (memory.size > 30) memory.delete(memory.keys().next().value!);
      if (dbConfigured())
        await query(
          `insert into ground_cache (key, png, terrain, aerial, scene) values ($1, $2, $3, $4, $5)
           on conflict (key) do update set png = excluded.png, terrain = excluded.terrain, aerial = excluded.aerial,
             scene = excluded.scene, fetched_at = now()`,
          [key, data?.png ?? null, data?.terrain ?? null, data?.aerial ?? null, data ? JSON.stringify(data.scene) : null],
        ).catch(() => undefined);
    }
    return data;
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
