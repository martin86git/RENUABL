import { answer, requireMember } from "@/lib/server/design-context";
import { cardByToken, jobCard } from "@/lib/server/design-job-card-repo";
import { openShared } from "@/lib/server/design-job-shares-repo";
import { satelliteImage } from "@/lib/server/roof-view";

/**
 * GET: the roof picture of an accepted job, for My Jobs (the same picture its job card's drawings are drawn on). Only
 * for the installer it was sent to, while the job is still theirs and the two are connected; the place comes from the job.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/installer-jobs/[id]/roof">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const open = await openShared(who.member.businessId, id.slice(0, 60));
    const link = open ? await cardByToken(open.token) : null;
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
