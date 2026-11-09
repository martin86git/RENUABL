import { requireMember } from "@/lib/server/design-context";
import { nearmapMeshPart } from "@/lib/server/nearmap";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET: one part of Nearmap's 3D model (its tileset JSON or a mesh tile), read from Nearmap with RENUABL's key for a
 * signed-in member, so the key never reaches a browser. Only paths in Nearmap's mesh store (`meshPartAllowed`).
 */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const who = await requireMember("design");
  if ("refuse" in who) return who.refuse;
  // A model is some hundreds of parts: generous, but not open-ended.
  if (!allow(request, "nearmap-mesh-part", 6000)) return new Response(null, { status: 429 });
  const { path } = await ctx.params;
  const res = await nearmapMeshPart(`/${path.map((s) => decodeURIComponent(s)).join("/")}`);
  if (!res) return new Response(null, { status: 404 });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, max-age=86400",
    },
  });
}
