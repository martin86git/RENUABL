import { PREVIEW_MODE } from "@/lib/config";
import { inAustralia, roofLookup } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET ?lat=&lng=: the home's roof from Google's Solar API: its figures (faces,
 * pitch, panels that fit) and the panel spots for drawing a layout.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return Response.json({ ok: false }, { status: 400 });
  // Each new home costs a Solar API lookup: a few per visitor per hour is plenty.
  if (!allow(request, "roof", 20)) return Response.json({ ok: false }, { status: 429 });
  try {
    const { data, reason } = await roofLookup(lat, lng);
    if (data) return Response.json({ ok: true, roof: data.insights, model: data.model });
    // "no-coverage" is a real answer; anything else is a setup problem worth showing in preview.
    return Response.json({
      ok: false,
      reason: reason === "no-coverage" || reason === "not-this-home" || PREVIEW_MODE ? reason : undefined,
    });
  } catch (e) {
    console.error("roof lookup failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, reason: PREVIEW_MODE ? "lookup failed" : undefined });
  }
}
