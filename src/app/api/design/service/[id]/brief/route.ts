import { answer, requireMember } from "@/lib/server/design-context";
import { caseBrief } from "@/lib/server/design-service-brief";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * GET: a service case at a glance: what the customer said, what the team has done, and Sol's issue, solution and what
 * it waits on (domain/design/service-brief.ts). Sol is asked only when the case has changed since he last summed it up;
 * past the hour's limit the brief is read by rule. The service pipeline is the whole team's.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/design/service/[id]/brief">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const missing = Response.json({ ok: false, message: "There's no such case." }, { status: 404 });
    if (!/^svc_[A-Za-z0-9_-]{8,64}$/.test(id)) return missing;
    const got = await caseBrief(who.member, id, allow(request, "service-brief", 120));
    return got ? Response.json({ ok: true, ...got }) : missing;
  });
}
