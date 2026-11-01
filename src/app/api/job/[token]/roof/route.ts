import { isJobToken } from "@/lib/domain/design/job-card";
import { answer } from "@/lib/server/design-context";
import { cardByToken, jobCard } from "@/lib/server/design-job-card-repo";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/** GET: the roof picture the job's drawings are drawn on, behind an installer's link. The place comes from the job. */
export async function GET(request: Request, ctx: RouteContext<"/api/job/[token]/roof">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "job-card-roof", 60)) return new Response(null, { status: 429 });
    const link = isJobToken(token) ? await cardByToken(token) : null;
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
