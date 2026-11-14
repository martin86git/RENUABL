import { answer } from "@/lib/server/design-context";
import { publicRoof } from "@/lib/server/design-proposal-repo";
import { keptPicture } from "@/lib/server/design-nearmap-repo";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/**
 * GET: the picture from above of the roof on the proposal behind a private
 * link: the same picture, at the same size, the design was drawn on, so the
 * panels sit where they were placed. Where the place is comes from the
 * proposal, never from the request. When the picture can't be had, the page
 * draws the layout on a plain ground.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/roof">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "proposal-roof", 60)) return new Response(null, { status: 429 });
    const roof = await publicRoof(token);
    if (!roof) return new Response(null, { status: 404 });
    try {
      // The Nearmap capture the design was drawn on, when it was (the same window and scale as Google's picture),
      // so the panels sit where they were placed.
      if (roof.picture) {
        const bytes = await keptPicture(roof.businessId, roof.lat, roof.lng, roof.picture).catch(() => null);
        if (bytes)
          return new Response(new Uint8Array(bytes), {
            headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400", "referrer-policy": "no-referrer" },
          });
      }
      return (
        (await satelliteImage({ line: "", suburb: "", state: "", postcode: "", lat: roof.lat, lng: roof.lng }, "designer")) ??
        new Response(null, { status: 404 })
      );
    } catch {
      return new Response(null, { status: 502 });
    }
  });
}
