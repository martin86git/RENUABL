import { answer, requireMember } from "@/lib/server/design-context";
import { inspectionOfJob } from "@/lib/server/design-inspections-repo";

/** GET → { inspection }: the inspection the installer nominated on this job, as the retailer sees it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/inspection">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    return Response.json({ ok: true, inspection: await inspectionOfJob(who.member.businessId, id.slice(0, 80)) });
  });
}
