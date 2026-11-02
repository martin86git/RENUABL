import { isJobFileId } from "@/lib/domain/design/job-card";
import { answer, requireMember } from "@/lib/server/design-context";
import { fileResponse } from "@/lib/server/design-job-card";
import { inspectionFile } from "@/lib/server/design-inspections-repo";

/** GET a photo from the job card, for the inspector of a live inspection on that job only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/inspections/[id]/files/[fileId]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, fileId } = await ctx.params;
    const file = isJobFileId(fileId) ? await inspectionFile(who.member.businessId, id.slice(0, 60), fileId) : null;
    return file ? fileResponse(file) : new Response("Not found", { status: 404 });
  });
}
