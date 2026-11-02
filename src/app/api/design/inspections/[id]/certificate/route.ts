import { answer, requireMember } from "@/lib/server/design-context";
import { fileResponse } from "@/lib/server/design-job-card";
import { certificateFor } from "@/lib/server/design-inspections-repo";

/** GET the inspection's certificate: for the retailer, the installer or the inspector of that inspection only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/inspections/[id]/certificate">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const cert = await certificateFor(who.member.businessId, id.slice(0, 60));
    return cert ? fileResponse(cert) : new Response("Not found", { status: 404 });
  });
}
