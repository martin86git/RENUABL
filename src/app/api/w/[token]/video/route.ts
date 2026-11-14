import { toVtt } from "@/lib/domain/design/walkthrough";
import { answer } from "@/lib/server/design-context";
import { videoResponse, watchByToken } from "@/lib/server/design-walkthroughs";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET: a walkthrough's video behind its own private link (Range passed on, so it seeks); `?vtt=1` its subtitles as
 * WebVTT. No sign-in: the token is the key. A link never made is a plain 404.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/w/[token]/video">) {
  return answer(async () => {
    if (!allow(request, "watch-video", 600)) return new Response(null, { status: 429 });
    const { token } = await ctx.params;
    const found = await watchByToken(token);
    if (!found) return new Response(null, { status: 404 });
    if (new URL(request.url).searchParams.get("vtt"))
      return new Response(toVtt(found.cues), {
        headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, no-cache" },
      });
    return videoResponse(found.file, request);
  });
}
