import { DEAL_MAIL_MAX, dealMailFrom, searchableAddress } from "@/lib/domain/design/deal-mail";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { customerDetail, jobById } from "@/lib/server/design-crm-repo";
import { mailWith } from "@/lib/server/gmail";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET → { mail, connected }: the customer's emails to and from them in the signed-in member's own connected mailboxes,
 * for the deal's Notes timeline (23 Nov 2026, Martin). Read fresh each time, never kept; only for a deal the member
 * may see, and never while viewing as someone (it would be their mailbox).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/mail">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    if (member.viewedBy) return Response.json({ ok: true, mail: [], connected: false });
    const { id } = await ctx.params;
    const found = await jobById(member.businessId, id, viewerOf(member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const address = searchableAddress(found.customer.email);
    if (!address) return Response.json({ ok: true, mail: [], connected: true });
    if (!allow(request, "deal-mail", 240)) return Response.json({ ok: true, mail: [], connected: true });
    const messages = await mailWith(member, address, DEAL_MAIL_MAX);
    const record = ((await customerDetail(member.businessId, found.customer.id))?.activity ?? []).filter((a) => a.kind === "email");
    return Response.json({ ok: true, mail: dealMailFrom(messages, address, record), connected: true });
  });
}
