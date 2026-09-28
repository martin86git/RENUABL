import { inAustralia, roofInsights } from "@/lib/server/google-solar";

// Each new home costs a Solar API lookup: a few per visitor per hour is plenty.
const hits = new Map<string, { n: number; since: number }>();
const LIMIT = 20;

/** GET ?lat=&lng=: the home's roof (faces, pitch, panels that fit) from Google's Solar API. */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return Response.json({ ok: false }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const h = hits.get(ip);
  const now = Date.now();
  if (h && now - h.since < 3_600_000) {
    if (++h.n > LIMIT) return Response.json({ ok: false }, { status: 429 });
  } else hits.set(ip, { n: 1, since: now });
  if (hits.size > 5000) hits.clear();

  try {
    const roof = await roofInsights(lat, lng);
    return roof ? Response.json({ ok: true, roof }) : Response.json({ ok: false });
  } catch (e) {
    console.error("roof lookup failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false });
  }
}
