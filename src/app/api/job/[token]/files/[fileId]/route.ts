import { isJobFileId, isJobToken } from "@/lib/domain/design/job-card";
import { answer } from "@/lib/server/design-context";
import { fileResponse } from "@/lib/server/design-job-card";
import { cardByToken, jobFile } from "@/lib/server/design-job-card-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET a photo from the job card behind an installer's link: only a file on that job. */
export async function GET(request: Request, ctx: RouteContext<"/api/job/[token]/files/[fileId]">) {
  return answer(async () => {
    const { token, fileId } = await ctx.params;
    if (!allow(request, "job-card-file", 240)) return new Response(null, { status: 429 });
    const link = isJobToken(token) && isJobFileId(fileId) ? await cardByToken(token) : null;
    const file = link ? await jobFile(link.businessId, link.jobId, fileId) : null;
    return file ? fileResponse(file) : new Response("Not found", { status: 404 });
  });
}
