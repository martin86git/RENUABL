import { answer, requireMember } from "@/lib/server/design-context";
import { imageResponse } from "@/lib/server/design-images";
import { postPicture, readerOf } from "@/lib/server/design-feed-posts-repo";
import { staffBehind } from "@/lib/server/design-staff-view";

/** GET `?which=photo|link`: a post's own photo or its link's picture, both redrawn by us, while the reader may see the post. */
export async function GET(request: Request, ctx: RouteContext<"/api/design/posts/[id]/picture">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const which = new URL(request.url).searchParams.get("which") === "link" ? "link" : "photo";
    const staff = Boolean(await staffBehind().catch(() => null));
    const pic = /^post_[0-9a-f]{16}$/.test(id) ? await postPicture(id, which, readerOf(who.member, staff)) : null;
    return pic ? imageResponse({ bytes: pic, contentType: "image/jpeg" }) : new Response("Not found", { status: 404 });
  });
}
