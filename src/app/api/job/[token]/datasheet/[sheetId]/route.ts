import { isDatasheetId } from "@/lib/domain/design/proposal-datasheets";
import { isJobToken } from "@/lib/domain/design/job-card";
import { datasheetResponse } from "@/lib/server/datasheet-response";
import { answer } from "@/lib/server/design-context";
import { cardByToken, jobDatasheet } from "@/lib/server/design-job-card-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET a product's datasheet from the job card behind an installer's link: only a product on that job's design. */
export async function GET(request: Request, ctx: RouteContext<"/api/job/[token]/datasheet/[sheetId]">) {
  return answer(async () => {
    const { token, sheetId } = await ctx.params;
    if (!allow(request, "job-card-datasheet", 120)) return new Response(null, { status: 429 });
    const link = isJobToken(token) && isDatasheetId(sheetId) ? await cardByToken(token) : null;
    return datasheetResponse(link ? await jobDatasheet(link, link.jobId, sheetId) : null);
  });
}
