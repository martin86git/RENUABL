import { groundMap } from "@/lib/server/ground-map";
import { inAustralia } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * GET ?lat=&lng=: the ground around the roof as a plain drawing (lawn, trees,
 * paving and buildings), on the roof designer's own picture (640 × 400). For
 * the designer's drawing mode. 404 when there is no data for the place.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return new Response(null, { status: 400 });
  if (!allow(request, "design-ground", 20)) return new Response(null, { status: 429 });
  try {
    const png = await groundMap(lat, lng);
    if (!png) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
