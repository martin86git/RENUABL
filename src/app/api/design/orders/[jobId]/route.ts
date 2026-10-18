import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { NOT_SIGNED, jobOrder, saveOrder } from "@/lib/server/design-after-sale-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const why = (r: "missing" | "unsigned") =>
  Response.json({ ok: false, message: r === "missing" ? "There's no such job." : NOT_SIGNED }, { status: r === "missing" ? 404 : 409 });

/** GET: one signed job's order, worked out from the version the customer signed, with the business's hand changes. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/orders/[jobId]">) {
  return answer(async () => {
    const { jobId } = await ctx.params;
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    if (!validId(jobId)) return why("missing");
    const found = await jobOrder(who.member.businessId, jobId);
    return typeof found === "string" ? why(found) : Response.json({ ok: true, order: found });
  });
}

/** PUT { order }: the hand changes and the order's details; the server stamps who marked it ordered and when. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/orders/[jobId]">) {
  return answer(async () => {
    const { jobId } = await ctx.params;
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 60_000);
    if ("refuse" in read) return read.refuse;
    if (!validId(jobId)) return why("missing");
    const saved = await saveOrder(who.member.businessId, jobId, read.body.order, who.member.email);
    return typeof saved === "string" ? why(saved) : Response.json({ ok: true, order: saved });
  });
}
