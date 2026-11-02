import { handleOf } from "@/lib/domain/design/mentions";
import { answer, requireMember } from "@/lib/server/design-context";
import { openShared } from "@/lib/server/design-job-shares-repo";

/**
 * GET → { token, from, person }: the job card's link for an accepted job of this installer's, while still connected,
 * and who the signed-in member is on its notes (their email's handle: known here, so the card doesn't ask for a name).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/installer-jobs/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const open = await openShared(who.member.businessId, id.slice(0, 60));
    return open
      ? Response.json({ ok: true, ...open, person: handleOf(who.member.email) })
      : Response.json({ ok: false, message: "This job isn't open to you. Accept it first, or ask the retailer." }, { status: 404 });
  });
}
