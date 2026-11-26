import { cleanPreApprovalChange } from "@/lib/domain/design/preapproval";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { changePreApproval, preApprovalFor } from "@/lib/server/design-preapproval";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
/** The same answer for an id that doesn't exist, another business's, and a deal this member doesn't see. */
const notFound = () => Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });

/** GET: the deal's network pre-approval as its card shows it (the network, its portal, the details to enter, where it stands). */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/preapproval">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const view = validId(id) ? await preApprovalFor(who.member, id, viewerOf(who.member)) : null;
    return view ? Response.json({ ok: true, view }) : notFound();
  });
}

/**
 * POST any of { nmi, meterNo, retailer, phases, status, reference, exportLimit }: fills in what the application needs
 * and records where it stands, on the deal's own Network fields and its record. Nothing is sent to the network.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/preapproval">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    if (!validId(id)) return notFound();
    const clean = cleanPreApprovalChange(read.body);
    if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
    const done = await changePreApproval(who.member, id, clean.change, viewerOf(who.member));
    if (!done) return notFound();
    if ("refused" in done) return Response.json({ ok: false, message: done.refused }, { status: 422 });
    return Response.json({ ok: true, view: done.view });
  });
}
