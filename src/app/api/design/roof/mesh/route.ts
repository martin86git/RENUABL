import { answer, requireMember } from "@/lib/server/design-context";
import { inAustralia } from "@/lib/server/google-solar";
import { nearmapMesh, nearmapReady } from "@/lib/server/nearmap";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET ?lat=&lng= → { ok, root, captured }: where Nearmap's 3D model of the roof is, as an address on RENUABL's own
 * server (`/api/design/roof/mesh/part/…`), which reads it from Nearmap with RENUABL's key; and the capture's day.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!nearmapReady()) return Response.json({ ok: false, message: "Nearmap isn't set up on RENUABL yet." }, { status: 503 });
    const u = new URL(request.url);
    const p = { lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inAustralia(p.lat, p.lng))
      return Response.json({ ok: false, message: "That roof isn't in Australia." }, { status: 400 });
    if (!allow(request, "nearmap-mesh-root", 120)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const mesh = await nearmapMesh(p.lat, p.lng);
    if (!mesh) return Response.json({ ok: false, message: "Nearmap has no 3D model of this roof." }, { status: 404 });
    return Response.json({
      ok: true,
      root: `/api/design/roof/mesh/part${mesh.root.replace(/[{}]/g, encodeURIComponent)}`,
      captured: mesh.captured,
    });
  });
}
