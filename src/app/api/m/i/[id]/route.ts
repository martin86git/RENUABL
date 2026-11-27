import { dbConfigured } from "@/lib/server/db";
import { glowLogo } from "@/lib/server/design-images";
import { imageById } from "@/lib/server/marketing-campaigns-repo";

/** Logos already given their glow, kept while the server stays up (a logo is small, and mail apps ask for it often). */
const glowed = new Map<string, Buffer>();
const GLOWED_MAX = 200;

async function withGlow(id: string, img: { bytes: Buffer; contentType: string }): Promise<Buffer> {
  if (img.contentType !== "image/png") return img.bytes;
  const kept = glowed.get(id);
  if (kept) return kept;
  const made = await glowLogo(img.bytes);
  if (glowed.size >= GLOWED_MAX) glowed.clear();
  glowed.set(id, made);
  return made;
}

/**
 * GET a picture shown in RENUABL's marketing emails (public: mail apps load it). Kept for good, so cached long. With
 * `?glow=1` (an email's logo on a light ground) a dark logo on a clear ground comes with a soft white glow, so it
 * still reads when a phone's dark mode darkens the email.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/m/i/[id]">) {
  const { id } = await ctx.params;
  const img = dbConfigured() && /^mimg_[0-9a-f]{24}$/.test(id) ? await imageById(id).catch(() => null) : null;
  if (!img) return new Response("Not found", { status: 404 });
  const bytes = new URL(request.url).searchParams.get("glow") === "1" ? await withGlow(id, img) : img.bytes;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": img.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
