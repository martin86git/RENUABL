import { answer, requireMember } from "@/lib/server/design-context";
import { pricePoints } from "@/lib/server/design-price-check";

/**
 * GET: the business's published proposals as price points for Sol's price check on a quote (domain/design/price-check.ts).
 * Costs and margins are in them, so only a member who sees costs.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, points: await pricePoints(who.member.businessId) });
  });
}
