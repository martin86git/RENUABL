import { can } from "@/lib/domain/design/account";
import { insightsView } from "@/lib/domain/design/insights";
import { todayInMarket } from "@/lib/domain/market";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { loadPrefs } from "@/lib/server/design-after-sale-repo";
import { insightDeals } from "@/lib/server/design-insights-repo";
import { agentSettings } from "@/lib/server/design-routine-settings";

/**
 * GET: Today's Business view (for anyone who may change settings) and My month (for everyone who owns deals, and
 * every salesperson), read by rule from the deals the member may see (domain/design/insights.ts). No Sol credit.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, email, role, permissions } = who.member;
    const business = can(role, "prices", permissions);
    const [deals, prefs, settings] = await Promise.all([
      insightDeals(businessId, viewerOf(who.member)),
      business ? loadPrefs(businessId) : null,
      business ? agentSettings(businessId) : null,
    ]);
    const base = { deals, me: email, today: todayInMarket(), now: new Date() };
    const views = [];
    if (business)
      views.push(insightsView({ ...base, scope: "business", targets: prefs!.targets, leadsAgentOn: settings!.on.includes("lead") }));
    const mine = deals.some((d) => (d.owner ?? "").toLowerCase() === email.toLowerCase());
    if (!business || mine) views.push(insightsView({ ...base, scope: "me" }));
    return Response.json({ ok: true, views });
  });
}
