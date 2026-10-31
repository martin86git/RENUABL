import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { DealFileRefusal, addDealFiles, listDealFiles } from "@/lib/server/design-pulse-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET → { files }: the files kept on the deal, newest first. POST a form of `file`s → { files }: keeps them on it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/files">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const files = await listDealFiles(who.member.businessId, id, viewerOf(who.member));
    if (!files) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    return Response.json({ ok: true, files });
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/files">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-deal-files", 120))
      return Response.json({ ok: false, message: "That's a lot of files this hour: try again shortly." }, { status: 429 });
    const { id } = await ctx.params;
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ ok: false, message: "Those files couldn't be read." }, { status: 400 });
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    try {
      const kept = await addDealFiles(who.member.businessId, id, files, who.member.email, viewerOf(who.member));
      if (!kept) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
      return Response.json({ ok: true, files: kept });
    } catch (e) {
      if (e instanceof DealFileRefusal) return Response.json({ ok: false, message: e.message }, { status: 422 });
      throw e;
    }
  });
}
