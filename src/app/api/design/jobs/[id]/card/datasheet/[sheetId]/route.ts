import { isDatasheetId } from "@/lib/domain/design/proposal-datasheets";
import { datasheetResponse } from "@/lib/server/datasheet-response";
import { jobById } from "@/lib/server/design-crm-repo";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobDatasheet } from "@/lib/server/design-job-card-repo";

/** GET a product's datasheet from a job card, for the business's own people who may see the deal (26 Nov 2026). */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/card/datasheet/[sheetId]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, sheetId } = await ctx.params;
    const ok = isDatasheetId(sheetId) && (await jobById(who.member.businessId, id, viewerOf(who.member)));
    return datasheetResponse(ok ? await jobDatasheet(who.member, id, sheetId) : null);
  });
}
