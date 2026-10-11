import { answer } from "@/lib/server/design-context";
import { imageResponse } from "@/lib/server/design-images";
import { publicImage } from "@/lib/server/design-proposal-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET: a picture on the proposal behind a private link. Only one that proposal was sent with; anything else reads as not there. */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/file/[id]">) {
  return answer(async () => {
    const { token, id } = await ctx.params;
    if (!allow(request, "proposal-file", 600)) return new Response(null, { status: 429 });
    const image = /^img_[a-f0-9]{8,64}$/.test(id) ? await publicImage(token, id) : null;
    return image ? imageResponse(image) : new Response(null, { status: 404 });
  });
}
