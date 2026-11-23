import { cleanKind, billsFor } from "@/lib/domain/design/business-kind";
import { daysLeft, percentUsed, periodEnd } from "@/lib/domain/design/usage";
import { todayInMarket } from "@/lib/domain/market";
import { answer, requireMember } from "@/lib/server/design-context";
import { tokenBalance } from "@/lib/server/design-billing-repo";
import { solDays, usageNow, voiceDays } from "@/lib/server/design-usage-meters";
import { stripeClient } from "@/lib/server/stripe";

/**
 * GET: the business's usage this month (domain/design/usage.ts): its meters, Sol credits bought, Calls & Texts' cap,
 * design credits, and the days for the chart. `?brief=1` answers the meters alone, for the settings menu. For the
 * owner and anyone who may change settings; buying more stays the owner's, in Billing.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { businessId } = who.member;
    const today = todayInMarket();
    const now = await usageNow(businessId, today);
    const meters = now.meters.map((m) => ({ ...m, percent: percentUsed(m) }));
    const kind = cleanKind(who.member.businessKind);
    const params = new URL(request.url).searchParams;
    if (params.has("brief")) return Response.json({ ok: true, meters });
    // The pop-up on Today (usage-pop.tsx): the meters, what can be topped up, and whether this person may buy (the owner).
    if (params.has("pop"))
      return Response.json({
        ok: true,
        meters,
        ends: periodEnd(now.month).words,
        daysLeft: daysLeft(today, now.month),
        solBought: now.solBought,
        solPacks: billsFor(kind, "sol"),
        voice: now.voice,
        designCredits: await tokenBalance(businessId),
        owner: who.member.role === "owner",
        payments: Boolean(stripeClient()),
      });
    const [sol, voice, tokens] = await Promise.all([
      billsFor(kind, "sol") ? solDays(businessId, now.month) : [],
      now.voice.on ? voiceDays(businessId, now.month) : [],
      tokenBalance(businessId),
    ]);
    return Response.json({
      ok: true,
      today,
      month: now.month,
      ends: periodEnd(now.month).words,
      daysLeft: daysLeft(today, now.month),
      meters,
      solBought: now.solBought,
      voice: { ...now.voice, days: voice },
      solDays: sol,
      designCredits: tokens,
      owner: who.member.role === "owner",
    });
  });
}
