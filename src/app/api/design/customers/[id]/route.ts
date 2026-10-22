import { cleanCustomerInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { customerById, customerDetail, deleteCustomer, updateCustomer } from "@/lib/server/design-crm-repo";

const validId = (id: string) => /^cus_[a-f0-9]{8,64}$/.test(id);
/** The same answer for an id that doesn't exist and one that is another business's. */
const notFound = () => Response.json({ ok: false, message: "That customer isn't here." }, { status: 404 });

/** GET: one customer with their jobs (newest first) and what has happened (newest first, the latest 200). */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/customers/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const detail = validId(id) ? await customerDetail(who.member.businessId, id, viewerOf(who.member)) : null;
    return detail ? Response.json({ ok: true, ...detail }) : notFound();
  });
}

/**
 * PUT { name, phone, email, address, lat, lng, source, notes }: changes a
 * customer. Anything left out stays as it is, so one field can be sent alone.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/customers/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const current = validId(id) ? await customerById(who.member.businessId, id) : null;
    if (!current) return notFound();
    const next = cleanCustomerInput(read.body, current);
    if (!next.ok) return Response.json({ ok: false, message: next.message }, { status: 422 });
    const customer = await updateCustomer(who.member.businessId, id, next.value);
    return customer ? Response.json({ ok: true, customer }) : notFound();
  });
}

/** DELETE: removes the customer with their jobs and their record. The business's roof designs are kept. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/customers/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const gone = validId(id) && (await deleteCustomer(who.member.businessId, id));
    return gone ? Response.json({ ok: true }) : notFound();
  });
}
