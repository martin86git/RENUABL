import { isTeamPicture } from "@/lib/domain/design/team-chat";
import { answer } from "@/lib/server/design-context";
import { dealFile } from "@/lib/server/design-pulse-repo";
import { siteByToken } from "@/lib/server/design-site-link";
import { allow } from "@/lib/server/rate-limit";

const validFile = (id: string) => /^df_[a-f0-9]{16,32}$/.test(id);

/** GET one of the deal's files from its site page's link: only a file on that link's own job. Pictures shown, the rest downloaded. */
export async function GET(request: Request, ctx: RouteContext<"/api/site/[token]/files/[fileId]">) {
  return answer(async () => {
    const { token, fileId } = await ctx.params;
    if (!allow(request, "site-file", 240)) return new Response(null, { status: 429 });
    const link = validFile(fileId) ? await siteByToken(token) : null;
    const file = link ? await dealFile(link.businessId, link.jobId, fileId) : null;
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.type,
        "content-disposition": `${isTeamPicture(file.type) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, max-age=3600",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
      },
    });
  });
}
