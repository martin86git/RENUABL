import { timelineOf } from "@/lib/domain/design/timeline";
import { jobById } from "@/lib/server/design-crm-repo";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { timelineData } from "@/lib/server/design-home-repo";

/** GET → { events }: the deal's proposal timeline, newest first: each publish with what went out, then the rest. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/timeline">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    return Response.json({ ok: true, events: timelineOf(await timelineData(who.member.businessId, id)) });
  });
}
