import { answer } from "@/lib/server/design-context";
import { jobCard } from "@/lib/server/design-job-card-repo";
import { siteByToken } from "@/lib/server/design-site-link";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/** GET: the roof picture the site page's panel layout is drawn on. The place comes from the job, never the request. */
export async function GET(request: Request, ctx: RouteContext<"/api/site/[token]/roof">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "site-roof", 60)) return new Response(null, { status: 429 });
    const link = await siteByToken(token);
    const card = link ? await jobCard({ businessId: link.businessId, businessName: link.businessName }, link.jobId, true) : null;
    if (!card?.roof) return new Response(null, { status: 404 });
    try {
      return (
        (await satelliteImage({ line: card.job.address, suburb: "", state: "", postcode: "", ...card.roof }, "designer")) ??
        new Response(null, { status: 404 })
      );
    } catch {
      return new Response(null, { status: 502 });
    }
  });
}
