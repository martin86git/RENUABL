import { isTeamFileId, isTeamPicture } from "@/lib/domain/design/team-chat";
import { answer, requireMember } from "@/lib/server/design-context";
import { teamFile } from "@/lib/server/design-team-repo";

/**
 * GET a file sent in the team chat, for a member who may read the room it was sent in (anyone else gets the same 404).
 * Pictures show in the chat; anything else downloads. Never cached by anyone else, never run as a page.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/team/files/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const file = isTeamFileId(id) ? await teamFile({ businessId: who.member.businessId, email: who.member.email }, id) : null;
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
