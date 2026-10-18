import { answer, requireMember } from "@/lib/server/design-context";
import { listOrders } from "@/lib/server/design-after-sale-repo";

/** GET: the Ordering Station: every signed job's order, with what it comes to. For a member who sees costs. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, orders: await listOrders(who.member.businessId) });
  });
}
