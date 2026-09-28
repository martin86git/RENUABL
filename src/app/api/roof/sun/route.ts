import { PREVIEW_MODE } from "@/lib/config";
import { inAustralia } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";
import { satelliteShift } from "@/lib/server/roof-align";
import { sunMap } from "@/lib/server/sun-map";

export const maxDuration = 60;

/**
 * GET ?lat=&lng=: the home's sun map overlay (PNG on Google Solar's grid).
 * With &frame=1: JSON with its grid, the summary, and `shift` for the sharp
 * satellite photo underneath (null: draw it on Google Solar's photo).
 * Preview only until it's been checked on real homes.
 */
export async function GET(request: Request) {
  if (!PREVIEW_MODE) return Response.json({ ok: false }, { status: 404 });
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const wantsFrame = u.searchParams.get("frame") === "1";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return Response.json({ ok: false }, { status: 400 });
  if (!allow(request, wantsFrame ? "roof-sun-frame" : "roof-sun", 30)) return Response.json({ ok: false }, { status: 429 });
  const map = await sunMap(lat, lng);
  if (!map) return wantsFrame ? Response.json({ ok: false }, { status: 404 }) : new Response(null, { status: 404 });
  if (wantsFrame)
    return Response.json({ ok: true, frame: map.frame, summary: map.summary, box: map.box, shift: await satelliteShift(lat, lng) });
  return new Response(new Uint8Array(map.png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
}
