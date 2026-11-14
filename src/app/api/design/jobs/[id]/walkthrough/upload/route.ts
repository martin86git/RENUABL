import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAX_BYTES, VIDEO_TYPES, isWalkthroughPath } from "@/lib/domain/design/walkthrough";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { blobToken } from "@/lib/server/design-walkthroughs";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST (Vercel Blob's client upload) → a short-lived token for the browser to put a walkthrough's video straight into
 * private storage, under this business and deal only (`isWalkthroughPath`), a video only, at most `MAX_BYTES`. The
 * file never passes through our servers (a recording is far over a function's request limit). Nothing is kept until
 * the browser says it has arrived (../route.ts, `keep`).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/walkthrough/upload">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const token = blobToken();
    if (!token) return Response.json({ ok: false, message: "Storage for recordings isn't set up." }, { status: 503 });
    if (!allow(request, `design-walkthrough-upload:${who.member.businessId}`, 30))
      return Response.json({ ok: false, message: "That's a lot of recordings this hour: try again shortly." }, { status: 429 });
    const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
    if (!body) return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    try {
      const result = await handleUpload({
        body,
        request,
        token,
        onBeforeGenerateToken: async (pathname) => {
          if (!isWalkthroughPath(pathname, who.member.businessId, id)) throw new Error("Not this deal's recording");
          return {
            allowedContentTypes: [...VIDEO_TYPES],
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: false,
            validUntil: Date.now() + 30 * 60_000,
          };
        },
      });
      return Response.json(result);
    } catch {
      return Response.json({ ok: false, message: "The recording couldn't be sent." }, { status: 400 });
    }
  });
}
