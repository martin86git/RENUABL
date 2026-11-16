/**
 * Sol's usage this month, for the window in his chat (16 Nov 2026, Martin: a way of seeing his consumption, as Claude's
 * and Grok's show theirs): the business's credits used and left, where they went, when the month's come back, and
 * whether credits top up by themselves. Any member who may ask Sol; buying and settings stay with the owner in Billing.
 */
import { todayInMarket } from "@/lib/domain/market";
import { addMonthsISO } from "@/lib/domain/design/plans";
import { topUpWords } from "@/lib/domain/design/top-up";
import { answer, requireMember } from "@/lib/server/design-context";
import { solBalanceOf, solUseThisMonth } from "@/lib/server/design-billing-repo";
import { topUpSettingsOf } from "@/lib/server/design-top-up";

export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId } = who.member;
    const today = todayInMarket();
    const [balance, uses, topUps] = await Promise.all([
      solBalanceOf(businessId, today),
      solUseThisMonth(businessId, today),
      topUpSettingsOf(businessId),
    ]);
    return Response.json({
      ok: true,
      balance,
      uses,
      resetsOn: addMonthsISO(`${today.slice(0, 7)}-01`, 1),
      topUp: { on: topUps.sol.on, words: topUpWords("sol", topUps.sol) },
      owner: who.member.role === "owner",
    });
  });
}
