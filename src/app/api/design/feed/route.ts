import { after } from "next/server";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { fireDue } from "@/lib/server/design-sol-agents";
import { solAsksForDesigns } from "@/lib/server/design-deal-team-repo";
import { dealFeed, exampleCount, feedExtras } from "@/lib/server/design-feed";

/**
 * GET → { deals, callsOn, team }: the deal feed on Today (deal-feed.ts), every deal this member may see that is being
 * sold or heading to install, whether Sol may ring customers, and the others in the business to bring in.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    // Sol looks over the deals not yet designed whose customers have said what they want, and asks for a design in
    // the deal's team chat (at most every few minutes a business; by rule, no credit).
    await solAsksForDesigns(who.member.businessId).catch((e) => console.error("sol's design requests", e instanceof Error ? e.message : e));
    const [deals, extras, examples] = await Promise.all([
      dealFeed(who.member, viewerOf(who.member)),
      feedExtras(who.member.businessId, who.member.email),
      exampleCount(who.member.businessId).catch(() => null),
    ]);
    // What has come due in Sol's outbox goes after the answer, as when the board is read (not while viewing as someone).
    if (!who.member.viewedBy) {
      const business = { id: who.member.businessId, name: who.member.businessName };
      after(() => fireDue(business).catch((e) => console.error("Sol's outbox couldn't send", e instanceof Error ? e.message : e)));
    }
    return Response.json({ ok: true, deals, ...extras, examples });
  });
}
