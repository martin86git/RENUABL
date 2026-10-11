import { answer, requireMember } from "@/lib/server/design-context";
import { imageResponse } from "@/lib/server/design-images";
import { imageFile, listImages, removeImage } from "@/lib/server/design-proposal-repo";

const validId = (id: string) => /^img_[a-f0-9]{8,64}$/.test(id);

/** GET: one of the business's own pictures, for its own screens. Another business's reads as not there. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/brand/files/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const image = validId(id) ? await imageFile(who.member.businessId, id) : null;
    return image ? imageResponse(image) : new Response(null, { status: 404 });
  });
}

/** DELETE: takes a picture out of the brand kit. Proposals already sent keep it. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/brand/files/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const gone = validId(id) && (await removeImage(who.member.businessId, id));
    if (!gone) return Response.json({ ok: false, message: "That picture isn't here." }, { status: 404 });
    return Response.json({ ok: true, images: await listImages(who.member.businessId) });
  });
}
