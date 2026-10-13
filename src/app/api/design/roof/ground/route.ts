import { groundData } from "@/lib/server/ground-map";
import { inAustralia } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * GET ?lat=&lng=: what Google's data layers give for the ground around a
 * roof, on the roof designer's own picture. By default the plain drawing
 * (lawn, trees, paving and buildings; PNG). With &part=terrain, the heights
 * of everything there as a grid (bytes: `unpackTerrain`), for the shade
 * analysis and the 3D view; with &part=aerial, Google Solar's own aerial
 * photo (JPEG), for the 3D view. One lookup serves all three and is kept.
 * 404 when there is no data for the place.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const part = u.searchParams.get("part");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return new Response(null, { status: 400 });
  if (!allow(request, "design-ground", 60)) return new Response(null, { status: 429 });
  try {
    const data = await groundData(lat, lng);
    if (!data) return new Response(null, { status: 404 });
    const [body, type] =
      part === "terrain"
        ? [data.terrain, "application/octet-stream"]
        : part === "aerial"
          ? [data.aerial, "image/jpeg"]
          : [data.png, "image/png"];
    return new Response(new Uint8Array(body), { headers: { "content-type": type, "cache-control": "private, max-age=86400" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
