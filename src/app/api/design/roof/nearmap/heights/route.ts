import { answer, requireMember } from "@/lib/server/design-context";
import { roofHeights } from "@/lib/server/design-nearmap-repo";
import { inAustralia } from "@/lib/server/google-solar";
import { nearmapReady } from "@/lib/server/nearmap";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * GET ?lat=&lng=: Nearmap's heights round the roof on the designer's picture (bytes: `unpackTerrain`), with the
 * capture in `x-nearmap-captured` and the layer in `x-nearmap-layer`, while the roof's picture is a Nearmap capture.
 * 409 while Google's picture is in use; 404 when Nearmap measured nothing there. Asked of Nearmap once a place, then kept.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!nearmapReady()) return new Response(null, { status: 503 });
    const u = new URL(request.url);
    const p = { lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inAustralia(p.lat, p.lng)) return new Response(null, { status: 400 });
    if (!allow(request, "nearmap-heights", 60)) return new Response(null, { status: 429 });
    const got = await roofHeights(who.member.businessId, p);
    if (got === "google") return new Response(null, { status: 409 });
    if (!got) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(got.terrain), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "private, no-store",
        "x-nearmap-captured": got.captured ?? "",
        "x-nearmap-layer": got.layer ?? "",
      },
    });
  });
}
