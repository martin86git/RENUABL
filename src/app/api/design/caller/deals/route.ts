import { cleanCallerKey } from "@/lib/domain/install-call";
import { assistantDealCalls, assistantDeals } from "@/lib/server/design-call-log-repo";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";

const PRIVATE = { "cache-control": "private, no-store" };
const validJob = (id: unknown): id is string => typeof id === "string" && /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * GET: the deals the phone assistant is across, as this member may see them (domain/design/assistant-deals.ts).
 * GET ?job=<id>: its calls on that one deal, as they were said.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const job = new URL(request.url).searchParams.get("job");
    // `?role=admin`: the post-sale assistant's own calls (booking installs), else the sales assistant's.
    const role = cleanCallerKey(new URL(request.url).searchParams.get("role"));
    if (job === null) {
      const deals = await assistantDeals(who.member.businessId, viewerOf(who.member), role);
      return Response.json({ ok: true, deals }, { headers: PRIVATE });
    }
    const found = validJob(job) ? await jobById(who.member.businessId, job, viewerOf(who.member)) : null;
    if (!found) return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const calls = await assistantDealCalls(who.member.businessId, found.job.id, role);
    return Response.json({ ok: true, calls }, { headers: PRIVATE });
  });
}
