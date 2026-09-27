import { sunshineAt } from "@/lib/server/nasa-power";

/** GET ?lat=&lng= → NASA POWER sunshine for that location (Australia only). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat > -9 || lat < -44 || lng < 112 || lng > 154) {
    return Response.json({ sunshine: null }, { status: 400 });
  }
  try {
    return Response.json({ sunshine: await sunshineAt(lat, lng) });
  } catch (e) {
    console.error("sunshine lookup failed", e instanceof Error ? e.message : e);
    return Response.json({ sunshine: null }, { status: 502 });
  }
}
