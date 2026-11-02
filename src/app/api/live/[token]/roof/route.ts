import { isLiveToken } from "@/lib/domain/design/live";
import { liveByToken } from "@/lib/server/design-live-repo";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/** GET: the roof picture behind the customer's live view (the designer's own, 640 × 400), only while the link exists. */
export async function GET(request: Request, ctx: RouteContext<"/api/live/[token]/roof">) {
  const { token } = await ctx.params;
  if (!allow(request, "live-roof", 60)) return new Response(null, { status: 429 });
  const live = isLiveToken(token) ? await liveByToken(token) : null;
  if (!live) return new Response(null, { status: 404 });
  try {
    return (
      (await satelliteImage({ line: "", suburb: "", state: "", postcode: "", lat: live.lat, lng: live.lng }, "designer")) ??
      new Response(null, { status: 404 })
    );
  } catch {
    return new Response(null, { status: 502 });
  }
}
