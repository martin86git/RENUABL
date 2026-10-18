import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { assignInvoice, deleteInvoice } from "@/lib/server/design-after-sale-repo";

const validId = (id: string) => /^inv_[a-f0-9]{8,64}$/.test(id);

/** PATCH { jobId | null }: puts an invoice against one of the business's jobs, or back to waiting. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/design/invoices/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const jobId = typeof read.body.jobId === "string" && /^job_[a-f0-9]{8,64}$/.test(read.body.jobId) ? read.body.jobId : null;
    if (read.body.jobId && !jobId) return Response.json({ ok: false, message: "There's no such job." }, { status: 404 });
    const ok = validId(id) && (await assignInvoice(who.member.businessId, id, jobId, who.member.email));
    return ok ? Response.json({ ok: true }) : Response.json({ ok: false, message: "There's no such invoice." }, { status: 404 });
  });
}

/** DELETE: takes an invoice off (one added by mistake). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/invoices/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    const ok = validId(id) && (await deleteInvoice(who.member.businessId, id));
    return ok ? Response.json({ ok: true }) : Response.json({ ok: false, message: "There's no such invoice." }, { status: 404 });
  });
}
