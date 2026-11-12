import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { liveCallFor } from "@/lib/server/voice-calls";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * GET → { call }: the phone assistant's latest call on this deal as it happens (how long it has run, what has been said),
 * for members who may see the deal. Asked every moment or two by the window that opens when the call is handed over.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call/live">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const call = await liveCallFor(who.member.businessId, id);
    return Response.json({ ok: true, call }, { headers: { "cache-control": "private, no-store" } });
  });
}
