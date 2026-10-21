import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { updateCase } from "@/lib/server/design-service-repo";

/** PUT { state?, text? }: moves a service case on, adds a note, or both; written on the deal's record. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/service/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const missing = Response.json({ ok: false, message: "There's no such case." }, { status: 404 });
    if (!/^svc_[A-Za-z0-9_-]{8,64}$/.test(id)) return missing;
    const done = await updateCase(who.member.businessId, id, { state: read.body.state, text: read.body.text }, who.member.email);
    if (done === "missing") return missing;
    if ("refused" in done) return Response.json({ ok: false, message: done.refused }, { status: 422 });
    return Response.json({ ok: true, case: done });
  });
}
