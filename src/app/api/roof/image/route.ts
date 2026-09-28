import { inAustralia } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/** GET ?lat=&lng=: the satellite image under a panel layout, for the home a customer is getting a system for. */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng)) return new Response(null, { status: 400 });
  if (!allow(request, "roof-image", 20)) return new Response(null, { status: 429 });
  try {
    return (
      (await satelliteImage({ line: "", suburb: "", state: "", postcode: "", lat, lng }, "design")) ?? new Response(null, { status: 404 })
    );
  } catch {
    return new Response(null, { status: 502 });
  }
}
