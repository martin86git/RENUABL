import { can } from "@/lib/domain/design/account";
import { answer, requireMember } from "@/lib/server/design-context";
import { installExtras } from "@/lib/server/design-after-sale-repo";

/**
 * GET: for each signed job, its battery, what is payable, the deposit received and whether its parts are ordered; its
 * gross margin and commission only for a member who sees costs.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const seesCosts = can(who.member.role, "costs", who.member.permissions);
    const extras = (await installExtras(who.member.businessId)).map((e) => {
      if (seesCosts) return e;
      const rest = { ...e };
      delete rest.grossMargin;
      delete rest.grossShare;
      delete rest.commission;
      delete rest.afterCommission;
      return rest;
    });
    return Response.json({ ok: true, extras });
  });
}
