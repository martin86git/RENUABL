import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { dealFeed, exampleCount, feedExtras } from "@/lib/server/design-feed";

/**
 * GET → { deals, callsOn, team }: the deal feed on Today (deal-feed.ts), every deal this member may see that is being
 * sold or heading to install, whether Sol may ring customers, and the others in the business to bring in.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [deals, extras, examples] = await Promise.all([
      dealFeed(who.member, viewerOf(who.member)),
      feedExtras(who.member.businessId, who.member.email),
      exampleCount(who.member.businessId).catch(() => null),
    ]);
    return Response.json({ ok: true, deals, ...extras, examples });
  });
}
