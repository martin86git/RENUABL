import { answer } from "@/lib/server/design-context";
import { helloRoof } from "@/lib/server/design-hello";
import { keptPicture, roofImagery } from "@/lib/server/design-nearmap-repo";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/**
 * GET: the picture from above of the home behind a lead's link: the picture the design was drawn on (a kept Nearmap
 * capture when that is in use, else Google's), at the designer's size, so the panels sit where they were placed.
 * Where it is comes from the deal, never the request.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/hello/[token]/roof">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "hello-roof", 60)) return new Response(null, { status: 429 });
    const roof = await helloRoof(token);
    if (!roof) return new Response(null, { status: 404 });
    try {
      if (roof.drawn) {
        const imagery = await roofImagery(roof.businessId, roof.lat, roof.lng).catch(() => null);
        if (imagery && imagery.use !== "google") {
          const bytes = await keptPicture(roof.businessId, roof.lat, roof.lng, imagery.use).catch(() => null);
          if (bytes)
            return new Response(new Uint8Array(bytes), {
              headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600", "referrer-policy": "no-referrer" },
            });
        }
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
