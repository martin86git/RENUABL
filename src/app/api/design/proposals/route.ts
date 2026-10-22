import { todayInMarket } from "@/lib/domain/market";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { listProposals } from "@/lib/server/design-after-sale-repo";
import { listJobs } from "@/lib/server/design-crm-repo";

/** GET: each job's newest proposal, sent and signed, for the Proposals lists: only on the deals the member sees. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const viewer = viewerOf(who.member);
    const [all, jobs] = await Promise.all([
      listProposals(who.member.businessId, todayInMarket()),
      viewer.all ? Promise.resolve(null) : listJobs(who.member.businessId, viewer),
    ]);
    const seen = jobs && new Set(jobs.map((j) => j.id));
    return Response.json({ ok: true, proposals: seen ? all.filter((p) => seen.has(p.jobId)) : all });
  });
}
