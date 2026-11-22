import sharp from "sharp";
import { sniffImage } from "@/lib/domain/design/brand";
import { hexOf } from "@/lib/domain/marketing/countdown";
import { VIDEO_STILL, cleanStillKey, playButtonSvg, youTubeStill } from "@/lib/domain/marketing/edm-video";
import { dbConfigured } from "@/lib/server/db";
import { imageById } from "@/lib/server/marketing-campaigns-repo";
import { safeFetch } from "@/lib/server/safe-fetch";

/**
 * GET a video block's still for a marketing email (`/api/m/v/<key>.jpg?c=<six hex digits>`; public: mail apps load it):
 * the business's uploaded picture, or a YouTube video's own thumbnail, cut to 16:9 with a play button in the colour.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/m/v/[key]">) {
  const { key: raw } = await ctx.params;
  const key = cleanStillKey(raw);
  const colour = hexOf(new URL(request.url).searchParams.get("c"));
  if (!key || !colour) return new Response("Not found", { status: 404 });
  let bytes: Buffer | null = null;
  if (key.startsWith("mimg_")) {
    const img = dbConfigured() ? await imageById(key).catch(() => null) : null;
    bytes = img?.bytes ?? null;
  } else {
    const got = await safeFetch(youTubeStill(key.slice(3)), 2_000_000, "picture");
    bytes = got && sniffImage(new Uint8Array(got.bytes)) ? got.bytes : null;
  }
  if (!bytes) return new Response("Not found", { status: 404 });
  try {
    const jpeg = await sharp(bytes, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: VIDEO_STILL.width, height: VIDEO_STILL.height, fit: "cover" })
      .composite([{ input: Buffer.from(playButtonSvg(colour)) }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "content-type": "image/jpeg",
        // An uploaded picture never changes under its id; YouTube's still can, so a day.
        "cache-control": key.startsWith("mimg_") ? "public, max-age=31536000, immutable" : "public, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
