import { answer, requireMember } from "@/lib/server/design-context";
import { addPhotos, itemDetail, removePhoto } from "@/lib/server/design-trade-repo";
import { allow } from "@/lib/server/rate-limit";

/** POST (a form of files): photos for the seller's own item, each redrawn before it is kept (nothing but the picture). */
export async function POST(request: Request, ctx: RouteContext<"/api/design/trade/[id]/photos">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "trade-photos", 120)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const { id } = await ctx.params;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ ok: false, message: "Those photos couldn't be read." }, { status: 400 });
    }
    const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
    const added = await addPhotos(
      who.member.businessId,
      id.slice(0, 80),
      await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer()))),
    );
    if (!added.ok) return Response.json(added, { status: 422 });
    const detail = await itemDetail(who.member.businessId, id.slice(0, 80));
    return Response.json({ ok: true, ...detail });
  });
}

/** DELETE ?photo=<id>: takes a photo off the seller's own item. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/design/trade/[id]/photos">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const photo = new URL(request.url).searchParams.get("photo") ?? "";
    if (!(await removePhoto(who.member.businessId, id.slice(0, 80), photo.slice(0, 80))))
      return Response.json({ ok: false, message: "That photo isn't there." }, { status: 404 });
    const detail = await itemDetail(who.member.businessId, id.slice(0, 80));
    return Response.json({ ok: true, ...detail });
  });
}
