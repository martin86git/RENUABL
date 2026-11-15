import { dbConfigured } from "@/lib/server/db";
import { imageById } from "@/lib/server/marketing-campaigns-repo";

/** GET a picture shown in RENUABL's marketing emails (public: mail apps load it). Kept for good, so cached long. */
export async function GET(_request: Request, ctx: RouteContext<"/api/m/i/[id]">) {
  const { id } = await ctx.params;
  const img = dbConfigured() && /^mimg_[0-9a-f]{24}$/.test(id) ? await imageById(id).catch(() => null) : null;
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "content-type": img.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
