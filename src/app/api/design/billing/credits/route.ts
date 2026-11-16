/**
 * The business's design credits, for the chip in the designer and on the design home (16 Nov 2026, Martin: "we will
 * need reference to the credit amount in the designer"): any member who designs may read it. Buying stays with the
 * owner in Settings → Billing.
 */
import { todayInMarket } from "@/lib/domain/market";
import { answer, requireMember } from "@/lib/server/design-context";
import { designPoolOf, tokenBalance } from "@/lib/server/design-billing-repo";

export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId } = who.member;
    const [credits, trial] = await Promise.all([tokenBalance(businessId), designPoolOf(businessId, todayInMarket())]);
    return Response.json({ ok: true, credits: Math.max(0, Math.floor(credits)), trial, owner: who.member.role === "owner" });
  });
}
