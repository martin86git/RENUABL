import sharp from "sharp";
import { SOCIAL_NETWORKS, type SocialNetwork } from "@/lib/domain/marketing/edm";
import { iconColour, socialIconSvg } from "@/lib/domain/marketing/social-glyphs";

/**
 * GET a social network's icon for a marketing email, `?c=` its colour as six hex digits (public: mail apps load it).
 * The same address always draws the same picture, so it is cached for good.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/m/s/[network]">) {
  const { network } = await ctx.params;
  const name = network.replace(/\.png$/, "");
  const colour = iconColour(new URL(request.url).searchParams.get("c"));
  if (!(SOCIAL_NETWORKS as readonly string[]).includes(name) || !colour) return new Response("Not found", { status: 404 });
  const png = await sharp(Buffer.from(socialIconSvg(name as SocialNetwork, colour)))
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
