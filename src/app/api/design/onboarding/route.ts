import { answer, requireMember } from "@/lib/server/design-context";
import { markDealTourSeen, markWelcomed } from "@/lib/server/design-repo";

/**
 * POST: the signed-in person has been through the welcome on Today, or skipped it (welcome.ts); with `{tour: "deal"}`,
 * they have seen the tour of a deal (deal-tour.ts). Only their own row. Not while viewing as someone.
 */
export async function POST(req: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: true });
    const body = (await req.json().catch(() => ({}))) as { tour?: unknown };
    if (body.tour === "deal") await markDealTourSeen(who.member.businessId, who.member.email);
    else await markWelcomed(who.member.businessId, who.member.email);
    return Response.json({ ok: true });
  });
}
