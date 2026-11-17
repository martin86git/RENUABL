import { helloPath } from "@/lib/domain/design/first-contact";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { helloFor } from "@/lib/server/design-hello";

/**
 * POST → { path }: the deal's page for its lead (`/hello/<token>`), made the first time it is asked for and the same
 * link after. Only a member who may publish, and only for a deal they may see.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/hello">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const token = await helloFor(who.member.businessId, id, who.member.email);
    if (!token) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    return Response.json({ ok: true, path: helloPath(token) });
  });
}
