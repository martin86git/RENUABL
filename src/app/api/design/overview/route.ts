import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { overview } from "@/lib/server/design-crm-repo";

/**
 * GET: the business at a glance: how many jobs sit at each stage, the prices
 * of the jobs still being sold and of those won added up, how many customers,
 * and the latest 12 things that happened.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, ...(await overview(who.member.businessId, viewerOf(who.member))) });
  });
}
