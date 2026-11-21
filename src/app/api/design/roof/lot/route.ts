import { inAustralia } from "@/lib/server/google-solar";
import { keptPropertyLot } from "@/lib/server/property-lot";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 45;

/**
 * GET ?address=&lat=&lng=: the lot the address is registered to on Victoria's land register, in metres on the
 * designer's picture (centred on lat/lng), with the homes round about. 404 when none is found (outside Victoria, or the
 * register can't be reached): Sol still asks "Is this the home?", on the picture alone.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const address = (u.searchParams.get("address") ?? "").slice(0, 200);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng) || !address.trim())
    return new Response(null, { status: 400 });
  if (!allow(request, "design-lot", 60)) return new Response(null, { status: 429 });
  const lot = await keptPropertyLot(address, { lat, lng });
  if (!lot) return new Response(null, { status: 404 });
  return Response.json(lot, { headers: { "cache-control": "private, max-age=86400" } });
}
