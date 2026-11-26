import { isDatasheetId } from "@/lib/domain/design/proposal-datasheets";
import { datasheetResponse } from "@/lib/server/datasheet-response";
import { answer, requireMember } from "@/lib/server/design-context";
import { inspectionDatasheet } from "@/lib/server/design-inspections-repo";

/** GET a product's datasheet from the job card, for the inspector of a live inspection on that job only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/inspections/[id]/datasheet/[sheetId]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, sheetId } = await ctx.params;
    const file = isDatasheetId(sheetId) ? await inspectionDatasheet(who.member.businessId, id.slice(0, 60), sheetId) : null;
    return datasheetResponse(file);
  });
}
