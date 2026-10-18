import { answer, requireMember } from "@/lib/server/design-context";
import { installExtras } from "@/lib/server/design-after-sale-repo";

/** GET: for each signed job, its battery, what is payable, the deposit received and whether its parts are ordered. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, extras: await installExtras(who.member.businessId) });
  });
}
