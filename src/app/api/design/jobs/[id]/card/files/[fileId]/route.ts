import { isJobFileId } from "@/lib/domain/design/job-card";
import { jobById } from "@/lib/server/design-crm-repo";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { fileResponse } from "@/lib/server/design-job-card";
import { jobFile } from "@/lib/server/design-job-card-repo";

/** GET a photo or PDF from a job card, for the business's own people who may see the deal. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/card/files/[fileId]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, fileId } = await ctx.params;
    const ok = isJobFileId(fileId) && (await jobById(who.member.businessId, id, viewerOf(who.member)));
    const file = ok ? await jobFile(who.member.businessId, id, fileId) : null;
    return file ? fileResponse(file) : new Response("Not found", { status: 404 });
  });
}
