import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { callLog } from "@/lib/server/design-call-log-repo";

/** GET → { calls, coming, solOn }: the call log on Today, for the deals this member may see. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, ...(await callLog(who.member.businessId, viewerOf(who.member))) });
  });
}
