import { isTeamPicture } from "@/lib/domain/design/team-chat";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { dealFile, removeDealFile } from "@/lib/server/design-pulse-repo";

const validFile = (id: string) => /^df_[a-f0-9]{16,32}$/.test(id);

/** GET a file kept on a deal (pictures shown, the rest downloaded, never run as a page); DELETE takes it off. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/files/[fileId]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, fileId } = await ctx.params;
    const file = validFile(fileId) ? await dealFile(who.member.businessId, id, fileId, viewerOf(who.member)) : null;
    if (!file) return new Response("Not found", { status: 404 });
    const disposition = isTeamPicture(file.type) ? "inline" : "attachment";
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.type,
        "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
      },
    });
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/files/[fileId]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, fileId } = await ctx.params;
    const gone = validFile(fileId) && (await removeDealFile(who.member.businessId, id, fileId, viewerOf(who.member)));
    if (!gone) return Response.json({ ok: false, message: "That file isn't there any more." }, { status: 404 });
    return Response.json({ ok: true });
  });
}
