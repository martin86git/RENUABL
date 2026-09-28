import { inAustralia } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";
import { roofPhoto } from "@/lib/server/solar-photo";

export const maxDuration = 60;

/**
 * GET ?lat=&lng=: Google Solar's aerial photo of the home (JPEG), the one its
 * panel spots were measured on. With &frame=1: the photo's grid (GeoFrame) as
 * JSON, for placing panels on it. 404 when there's none (use the satellite view).
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const wantsFrame = u.searchParams.get("frame") === "1";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return Response.json({ ok: false }, { status: 400 });
  if (!allow(request, wantsFrame ? "roof-photo-frame" : "roof-photo", 30)) return Response.json({ ok: false }, { status: 429 });
  const photo = await roofPhoto(lat, lng);
  if (!photo) return wantsFrame ? Response.json({ ok: false }, { status: 404 }) : new Response(null, { status: 404 });
  if (wantsFrame) return Response.json({ ok: true, frame: photo.frame });
  return new Response(new Uint8Array(photo.jpeg), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
  });
}
