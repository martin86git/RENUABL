/**
 * Server only. Nearmap's picture of a roof for the designer (3 Nov 2026, Martin: "we will already have Nearmap"; the
 * way Primero's designer does it, `NEARMAP_API_KEY`). Google's picture stays the start; Nearmap's is fetched only when
 * a person asks (a picture is some thirty tiles of the plan's calls), kept for the business, and from then on used for
 * that roof at no further cost.
 *
 * The picture is the designer's own window (`ROOF_IMAGE`, 640 × 400 at Web Mercator zoom 20) at twice the pixels,
 * 1280 × 800, which is exactly zoom 21's: stitched from Nearmap's zoom 21 tiles (Tile API `tiles/v3/Vert`, about 6 cm a
 * pixel in Melbourne) and cut to that window, so a design drawn on Google's picture lines up on it.
 *
 * The Coverage API (`coverage/v2/point`) gives each capture's date and **what the key may reach there** (the vertical
 * picture, obliques, heights, true ortho, …), read whole so the designer can say what this subscription includes at a
 * roof: the test of whether a bigger package is needed for designing by itself.
 */
import sharp from "sharp";
import type { LngLatRing } from "@/lib/domain/design/nearmap";
import { dsmSource, terrainFromTiles, tileValues, tilesFor, type DsmTile } from "@/lib/domain/design/nearmap-dsm";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import { packTerrain } from "@/lib/domain/design/shade";

const nearmapKey = () => process.env.NEARMAP_API_KEY?.trim() || null;

/** Whether Nearmap can be asked here. */
export const nearmapReady = () => Boolean(nearmapKey());

export interface NearmapSurvey {
  id: string;
  /** YYYY-MM-DD. */
  captured: string;
  /** What Nearmap offers for this capture with this key, as it names them ("tiles:Vert", "DetailDsm", …). */
  resources: string[];
}

/** Every resource name in Coverage's answer for one survey, however Nearmap nests them. */
function resourcesOf(raw: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === "object" && typeof (item as { type?: unknown }).type === "string")
          out.add(path ? `${path}:${(item as { type: string }).type}` : (item as { type: string }).type);
        else walk(item, path);
      }
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}:${k}` : k);
  };
  walk(raw, "");
  return [...out].sort();
}

/** The captures of a spot, newest first, with what each offers: one Coverage call, no tiles. Null when not set up or not reached. */
export async function nearmapSurveys(lat: number, lng: number): Promise<NearmapSurvey[] | null> {
  const key = nearmapKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.nearmap.com/coverage/v2/point/${lng.toFixed(6)},${lat.toFixed(6)}?apikey=${encodeURIComponent(key)}&limit=30`,
      { signal: AbortSignal.timeout(8_000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { surveys?: { id?: string; captureDate?: string; resources?: unknown }[] };
    return (json.surveys ?? [])
      .filter(
        (x): x is { id: string; captureDate: string; resources?: unknown } =>
          typeof x.id === "string" && /^\d{4}-\d{2}-\d{2}/.test(x.captureDate ?? ""),
      )
      .map((x) => ({ id: x.id, captured: x.captureDate.slice(0, 10), resources: resourcesOf(x.resources) }))
      .sort((x, y) => y.captured.localeCompare(x.captured));
  } catch {
    return null;
  }
}

const TILE = 256;
const ZOOM = ROOF_IMAGE.zoom + 1;

/** The point's place in zoom 21's world of pixels. */
function worldPixel(lat: number, lng: number) {
  const world = TILE * 2 ** ZOOM;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world };
}

/**
 * Nearmap's picture of the designer's window round this point, from one capture (by its survey) or the newest: a JPEG,
 * 1280 × 800. Null when most of the window has no picture (Nearmap hasn't flown there) or Nearmap can't be reached.
 */
export async function nearmapPicture(lat: number, lng: number, survey?: string): Promise<Buffer | null> {
  const key = nearmapKey();
  if (!key) return null;
  const W = ROOF_IMAGE.width * 2;
  const H = ROOF_IMAGE.height * 2;
  const c = worldPixel(lat, lng);
  const left = Math.round(c.x - W / 2);
  const top = Math.round(c.y - H / 2);
  const tx0 = Math.floor(left / TILE);
  const ty0 = Math.floor(top / TILE);
  const tx1 = Math.floor((left + W - 1) / TILE);
  const ty1 = Math.floor((top + H - 1) / TILE);
  const path = survey ? `surveys/${encodeURIComponent(survey)}/Vert/` : "Vert/";
  const jobs: Promise<{ input: Buffer; left: number; top: number } | null>[] = [];
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      jobs.push(
        fetch(`https://api.nearmap.com/tiles/v3/${path}${ZOOM}/${tx}/${ty}.jpg?apikey=${encodeURIComponent(key)}`, {
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        })
          .then(async (r) => (r.ok ? { input: Buffer.from(await r.arrayBuffer()), left: tx * TILE - left, top: ty * TILE - top } : null))
          .catch(() => null),
      );
  const tiles = await Promise.all(jobs);
  const got = tiles.filter((t): t is NonNullable<typeof t> => t !== null);
  if (got.length < tiles.length / 2) return null;
  // Tiles reaching past the window are cut to it before they are laid down.
  const pieces = await Promise.all(
    got.map(async (t) => {
      const x0 = Math.max(0, -t.left);
      const y0 = Math.max(0, -t.top);
      const w = Math.min(TILE, W - t.left) - x0;
      const h = Math.min(TILE, H - t.top) - y0;
      if (w <= 0 || h <= 0) return null;
      const input = await sharp(t.input).extract({ left: x0, top: y0, width: w, height: h }).toBuffer();
      return { input, left: Math.max(0, t.left), top: Math.max(0, t.top) };
    }),
  );
  return sharp({ create: { width: W, height: H, channels: 3, background: "#1b1d21" } })
    .composite(pieces.filter((p): p is NonNullable<typeof p> => p !== null))
    .jpeg({ quality: 88 })
    .toBuffer();
}

/**
 * The roof outlines Nearmap's AI features drew in one capture (by its date, else the newest) round a point: each roof's
 * outer ring as [lng, lat] pairs. One AI features call over a small box (about 35 m across), which uses the plan's AI
 * credits, so the designer keeps the answer with the capture (design-nearmap-repo.ts). Null when not set up or not reached.
 */
export async function nearmapRoofOutlines(lat: number, lng: number, captured?: string | null): Promise<LngLatRing[] | null> {
  const key = nearmapKey();
  if (!key) return null;
  const d = 0.00016;
  const box = [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ]
    .map((p) => p.map((n) => n.toFixed(6)).join(","))
    .join(",");
  const day = captured && /^\d{4}-\d{2}-\d{2}$/.test(captured) ? `&since=${captured}&until=${captured}` : "";
  try {
    const res = await fetch(`https://api.nearmap.com/ai/features/v4/features.json?polygon=${box}${day}&apikey=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { description?: string; geometry?: { type?: string; coordinates?: unknown } }[] };
    const rings: LngLatRing[] = [];
    for (const f of json.features ?? []) {
      if (f.description !== "Roof" || !f.geometry) continue;
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.type === "MultiPolygon"
            ? (f.geometry.coordinates as unknown[])
            : [];
      for (const poly of polys) {
        const outer = Array.isArray(poly) ? poly[0] : null;
        if (!Array.isArray(outer)) continue;
        const ring = outer.filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) as [
          number,
          number,
        ][];
        if (ring.length >= 4) rings.push(ring);
      }
    }
    return rings;
  } catch {
    return null;
  }
}

/**
 * Nearmap's heights round a point on the designer's picture (domain/design/nearmap-dsm.ts): the newest capture with
 * the detailed DSM (zoom 20, about 12 tiles), else the standard one (zoom 18), stitched and set on the shade
 * analysis's grid. Packed for the browser (`packTerrain`) with the capture it came from. Null when not set up, nothing
 * measured there, or not reached.
 */
export async function nearmapHeights(
  lat: number,
  lng: number,
): Promise<{ terrain: Buffer; survey: string; captured: string; layer: string } | null> {
  const key = nearmapKey();
  if (!key) return null;
  const surveys = await nearmapSurveys(lat, lng);
  const source = surveys ? dsmSource(surveys) : null;
  if (!source) return null;
  const { survey, layer } = source;
  const tiles = await Promise.all(
    tilesFor(lat, lng, layer.zoom).map(({ x, y }) =>
      fetch(
        `https://api.nearmap.com/tiles/v3/surveys/${encodeURIComponent(survey.id)}/${layer.type}/${layer.zoom}/${x}/${y}.png?apikey=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(10_000), cache: "no-store" },
      )
        .then(async (r) => {
          if (!r.ok) return null;
          const { data, info } = await sharp(Buffer.from(await r.arrayBuffer()))
            .raw()
            .toBuffer({ resolveWithObject: true });
          if (info.width !== info.height || info.channels < 3) return null;
          return { x, y, size: info.width, values: tileValues(data, info.channels, info.width) } satisfies DsmTile;
        })
        .catch(() => null),
    ),
  );
  const terrain = terrainFromTiles(
    lat,
    lng,
    layer.zoom,
    tiles.filter((t): t is DsmTile => t !== null),
  );
  if (!terrain) return null;
  return { terrain: Buffer.from(packTerrain(terrain)), survey: survey.id, captured: survey.captured, layer: layer.type };
}

/** A 3D model's root in Nearmap's mesh store, as Coverage gives it (`rootPath`). Nothing else is ever fetched for 3D. */
export const MESH_ROOT = /^\/meshes\/v1\/stores\/[\w-]{1,40}\/[\w-]{1,60}\/meshes\/\{[\w-]{1,60}\}\/Mesh\/[\w.-]{1,80}\.json$/;

/**
 * Nearmap's 3D model of the place (9 Nov 2026, Martin): the newest capture with a textured mesh, as the address of its
 * 3D Tiles root in Nearmap's mesh store (Cesium 3D Tiles, draco), and the capture's day. Null when not set up, there is
 * no mesh there, or not reached. The mesh is read through RENUABL's server (`nearmapMeshPart`), never with the key in
 * the browser.
 */
export async function nearmapMesh(lat: number, lng: number): Promise<{ root: string; captured: string } | null> {
  const key = nearmapKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.nearmap.com/coverage/v2/point/${lng.toFixed(6)},${lat.toFixed(6)}?apikey=${encodeURIComponent(key)}&limit=30`,
      { signal: AbortSignal.timeout(8_000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      surveys?: { captureDate?: string; resources?: { "3d"?: { type?: string; properties?: { rootPath?: unknown } }[] } }[];
    };
    const found = (json.surveys ?? [])
      .flatMap((s) =>
        (s.resources?.["3d"] ?? [])
          .filter((r) => r.type === "mesh" && typeof r.properties?.rootPath === "string" && MESH_ROOT.test(r.properties.rootPath))
          .map((r) => ({ root: r.properties!.rootPath as string, captured: (s.captureDate ?? "").slice(0, 10) })),
      )
      .sort((a, b) => b.captured.localeCompare(a.captured));
    return found[0] ?? null;
  } catch {
    return null;
  }
}

/** Whether a path is a part of a mesh in Nearmap's store: under `meshes/v1/stores/`, no way out of it. */
export function meshPartAllowed(path: string): boolean {
  return /^\/meshes\/v1\/stores\/[\w\-./{}]+$/.test(path) && !path.includes("..") && !path.includes("//") && path.length < 400;
}

/** One part of a Nearmap mesh (its tileset JSON or a b3dm/glb tile), fetched with RENUABL's key. Null when refused. */
export async function nearmapMeshPart(path: string): Promise<Response | null> {
  const key = nearmapKey();
  if (!key || !meshPartAllowed(path)) return null;
  const res = await fetch(`https://api.nearmap.com${path}?apikey=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  }).catch(() => null);
  return res && res.ok ? res : null;
}
