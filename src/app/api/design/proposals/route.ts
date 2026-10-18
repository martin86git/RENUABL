import { todayInMarket } from "@/lib/domain/market";
import { answer, requireMember } from "@/lib/server/design-context";
import { listProposals } from "@/lib/server/design-after-sale-repo";

/** GET: each job's newest proposal, sent and signed, for the Proposals lists. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, proposals: await listProposals(who.member.businessId, todayInMarket()) });
  });
}
