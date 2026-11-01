import { gateCounts, gateOf } from "@/lib/domain/design/approvals";
import { answer, requireMember } from "@/lib/server/design-context";
import { listJobs } from "@/lib/server/design-crm-repo";

/**
 * GET → { counts, jobs }: every sold job with no installation date, at the first approval gate it hasn't passed (the
 * whole team's, like the install calendar); `?count=1` answers the counts alone, for the sections' badges.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const jobs = await listJobs(who.member.businessId);
    const counts = gateCounts(jobs);
    if (new URL(request.url).searchParams.get("count") === "1") return Response.json({ ok: true, counts });
    return Response.json({ ok: true, counts, jobs: jobs.filter((j) => gateOf(j)) });
  });
}
