import { packPerfRows, perfRows } from "@/lib/domain/design/performance";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { listJobs } from "@/lib/server/design-crm-repo";

/**
 * GET: the deals this member may see as the small rows Performance counts from (each deal's days, whether sold,
 * installed or with a battery, its value and kW), so Today's Performance needn't wait for the whole deals list
 * (22 Nov 2026, Martin: it took a second to open on a phone).
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const jobs = await listJobs(who.member.businessId, viewerOf(who.member));
    return Response.json({ ok: true, rows: packPerfRows(perfRows(jobs)) });
  });
}
