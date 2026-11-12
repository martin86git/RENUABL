import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { callTranscriptsFor } from "@/lib/server/call-transcripts";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/** GET → { transcripts }: the deal's call transcripts for its timeline, for members who may see the deal. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call-transcripts">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const transcripts = await callTranscriptsFor(who.member.businessId, id);
    return Response.json({ ok: true, transcripts }, { headers: { "cache-control": "private, no-store" } });
  });
}
