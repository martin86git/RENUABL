import { cleanGridChange } from "@/lib/domain/design/grid-connection";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { changeGridConnection, gridConnectionFor } from "@/lib/server/design-grid-connection";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
/** The same answer for an id that doesn't exist, another business's, and a deal this member doesn't see. */
const notFound = () => Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });

/** GET: the deal's grid connection as its card shows it (who to raise it with, the details to enter, where it stands). */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/grid-connection">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const view = validId(id) ? await gridConnectionFor(who.member, id, viewerOf(who.member)) : null;
    return view ? Response.json({ ok: true, view }) : notFound();
  });
}

/**
 * POST any of { nmi, meterNo, retailer, state, reference }: fills in what the connection needs and records where it
 * stands, on the deal's own fields and its record. Nothing is sent to the network or the retailer.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/grid-connection">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    if (!validId(id)) return notFound();
    const clean = cleanGridChange(read.body);
    if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
    const done = await changeGridConnection(who.member, id, clean.change, viewerOf(who.member));
    if (!done) return notFound();
    if ("refused" in done) return Response.json({ ok: false, message: done.refused }, { status: 422 });
    return Response.json({ ok: true, view: done.view });
  });
}
