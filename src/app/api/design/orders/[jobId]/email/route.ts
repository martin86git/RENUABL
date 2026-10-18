import { DEFAULT_PO_INTRO, purchaseOrderEmail } from "@/lib/domain/design/orders";
import { longDay } from "@/lib/domain/design/schedule";
import { allow } from "@/lib/server/rate-limit";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { NOT_SIGNED, jobOrder, noteOrderSent } from "@/lib/server/design-after-sale-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const EMAIL = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,24}$/i;
const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * POST { list, to, intro }: emails one supplier the part of a signed job's
 * order bought from them. The lines are worked out again here from the
 * signed version and the saved changes (never taken from the browser), and
 * carry no prices. It goes from RENUABL's sender under the business's name,
 * with replies to the member who sent it, and is written on the job's record.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/orders/[jobId]/email">) {
  return answer(async () => {
    const { jobId } = await ctx.params;
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-po", 30)) return fail("That's a lot of orders at once. Try again in a minute.", 429);
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    if (!emailProvider())
      return fail("Email isn't set up on this site yet, so orders can't be sent from here. Copy the order instead.", 503);
    if (!validId(jobId)) return fail("There's no such job.", 404);
    const to = typeof read.body.to === "string" ? read.body.to.trim() : "";
    if (!EMAIL.test(to)) return fail("Add the supplier's email address to send the order.", 422);
    const found = await jobOrder(who.member.businessId, jobId);
    if (found === "missing") return fail("There's no such job.", 404);
    if (found === "unsigned") return fail(NOT_SIGNED, 409);
    const list = typeof read.body.list === "string" ? read.body.list : null;
    const group = found.groups.find((g) => g.list === list);
    if (!group?.items.length) return fail("There's nothing on this order for that supplier.", 422);
    const intro =
      typeof read.body.intro === "string" && read.body.intro.trim() ? read.body.intro.replace(/\r/g, "").slice(0, 1500) : DEFAULT_PO_INTRO;
    const email = purchaseOrderEmail({
      business: who.member.businessName,
      reference: found.order.reference,
      address: found.address,
      wanted: found.order.wanted ? longDay(found.order.wanted) : found.installDate ? longDay(found.installDate) : null,
      deliverTo: found.order.deliverTo,
      notes: found.order.notes,
      intro,
      items: group.items,
    });
    await sendEmail({ to, ...email, replyTo: who.member.email });
    await noteOrderSent(who.member.businessId, jobId, found.customerId, group.supplier ?? "a supplier", to, who.member.email);
    return Response.json({ ok: true, message: `Order sent to ${to}. Replies go to ${who.member.email}.` });
  });
}
