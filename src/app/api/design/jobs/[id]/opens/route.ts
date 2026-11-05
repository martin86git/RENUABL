import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { openCountsForJob, opensForJob } from "@/lib/server/design-pulse-repo";

/**
 * GET → { opens, counts }: the deal's tracked emails by the record line they were written as, each with when it was
 * opened (the latest times) and how many times in all. Only the customer's copy is counted.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/opens">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const opens = await opensForJob(who.member.businessId, id, viewerOf(who.member));
    if (!opens) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    return Response.json({ ok: true, opens, counts: await openCountsForJob(who.member.businessId, id) });
  });
}
